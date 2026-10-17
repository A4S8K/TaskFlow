"""Exercise PostgreSQL behavior using only a dedicated loopback test database."""

import os
import secrets

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, TimeoutError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from app.db import session as session_module
from app.db.engine import build_engine
from app.models import Project, User

TABLES = ("users", "projects", "project_members", "tasks", "alembic_version")
SEQUENCES = ("users_id_seq", "projects_id_seq", "project_members_id_seq", "tasks_id_seq")


@pytest.fixture
def database_settings():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a disposable loopback PostgreSQL database ending in _test")
    parsed = make_url(url)
    if (
        parsed.get_backend_name() != "postgresql"
        or parsed.host not in {"127.0.0.1", "::1", "localhost"}
        or not (parsed.database or "").endswith("_test")
        or url == os.environ.get("DATABASE_URL")
        or set(parsed.query) & {"host", "hostaddr", "port", "dbname", "user", "service", "servicefile"}
    ):
        pytest.fail("Database checks require a separate, explicitly isolated loopback test database")
    return Settings(
        _env_file=None,
        app_env="test",
        database_url=url,
        jwt_secret_key=secrets.token_urlsafe(48),
        db_pool_size=1,
        db_max_overflow=0,
        db_pool_timeout_seconds=1,
        db_statement_timeout_ms=3000,
        db_lock_timeout_ms=1000,
    )


@pytest.fixture
def database_engine(database_settings):
    engine = build_engine(database_settings)
    try:
        yield engine
    finally:
        engine.dispose()


def test_database_timeouts_and_pool_capacity_are_enforced(database_engine):
    with database_engine.connect() as connection:
        assert connection.scalar(text("SHOW statement_timeout")) == "3s"
        assert connection.scalar(text("SHOW lock_timeout")) == "1s"
        assert connection.scalar(text("SHOW application_name")) == "taskflow-api"
        # A second request queues and fails instead of creating unbounded sessions.
        with pytest.raises(TimeoutError), database_engine.connect():
            pytest.fail("Connection pool exceeded its configured capacity")


def test_migrations_release_each_postgresql_connection(database_settings):
    engine = build_engine(database_settings, migration=True)
    try:
        assert isinstance(engine.pool, NullPool)
        assert engine.hide_parameters
        with engine.connect() as connection:
            first_pid = connection.scalar(text("SELECT pg_backend_pid()"))
            assert connection.scalar(text("SHOW application_name")) == "taskflow-migrations"
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT pg_backend_pid()")) != first_pid
    finally:
        engine.dispose()


def test_request_writes_commit_together_and_failures_roll_back(database_engine, monkeypatch):
    with database_engine.connect() as connection:
        outer = connection.begin()
        monkeypatch.setattr(
            session_module,
            "SessionLocal",
            sessionmaker(connection, expire_on_commit=False, join_transaction_mode="create_savepoint"),
        )
        try:
            successful_name = "commit_" + secrets.token_hex(6)
            request_db = session_module.get_db()
            db = next(request_db)
            user = User(
                username=successful_name,
                email=f"{successful_name}@example.com",
                hashed_password="inert-test-hash-no-password",
            )
            db.add(user)
            db.flush()
            db.add(Project(name="Committed together", owner_id=user.id))
            with pytest.raises(StopIteration):
                next(request_db)
            assert connection.scalar(select(func.count(User.id)).where(User.id == user.id)) == 1
            assert connection.scalar(select(func.count(Project.id)).where(Project.owner_id == user.id)) == 1

            failed_name = "rollback_" + secrets.token_hex(6)
            failed_db = session_module.get_db()
            db = next(failed_db)
            failed_user = User(
                username=failed_name,
                email=f"{failed_name}@example.com",
                hashed_password="inert-test-hash-no-password",
            )
            db.add(failed_user)
            db.flush()
            failed_id = failed_user.id
            db.add(Project(name="Must roll back", owner_id=failed_id))
            db.flush()
            with pytest.raises(RuntimeError, match="failure before response"):
                failed_db.throw(RuntimeError("failure before response"))
            assert connection.scalar(select(func.count(User.id)).where(User.id == failed_id)) == 0
            assert connection.scalar(select(func.count(Project.id)).where(Project.owner_id == failed_id)) == 0
            assert connection.scalar(select(func.count(User.id)).where(User.id == user.id)) == 1
        finally:
            outer.rollback()


def test_migrated_tables_have_rls_and_no_public_data_api_grants(database_engine):
    with database_engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM public.alembic_version")) == "0002"
        tables = connection.execute(
            text(
                "SELECT relname, relrowsecurity FROM pg_class c "
                "JOIN pg_namespace n ON n.oid=c.relnamespace "
                "WHERE n.nspname='public' AND c.relname = ANY(:tables)"
            ),
            {"tables": list(TABLES)},
        ).all()
        assert dict(tables) == dict.fromkeys(TABLES, True)
        assert not connection.execute(
            text("SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename = ANY(:tables)"),
            {"tables": list(TABLES)},
        ).all()
        assert not connection.execute(
            text(
                "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                "CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl "
                "WHERE n.nspname='public' AND c.relname = ANY(:tables) AND acl.grantee=0"
            ),
            {"tables": list(TABLES)},
        ).all()
        roles = connection.scalars(
            text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")
        ).all()
        for role in roles:
            for table in TABLES:
                assert not connection.scalar(
                    text("SELECT has_table_privilege(:role, :table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')"),
                    {"role": role, "table": f"public.{table}"},
                )
            for sequence in SEQUENCES:
                assert not connection.scalar(
                    text("SELECT has_sequence_privilege(:role, :sequence, 'USAGE,SELECT,UPDATE')"),
                    {"role": role, "sequence": f"public.{sequence}"},
                )


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_data_api_roles_cannot_read_backend_tables(database_engine, role):
    with database_engine.connect() as connection:
        can_set_role = connection.scalar(
            text(
                "SELECT rolsuper OR pg_has_role(current_user, oid, 'MEMBER') "
                "FROM pg_roles WHERE rolname=:role"
            ),
            {"role": role},
        )
        if can_set_role is None:
            pytest.skip("This PostgreSQL instance has no Supabase Data API roles")
        # A superuser can SET ROLE regardless of membership. The role itself is
        # unprivileged; checking current_user avoids relying on its rolsuper flag.
        superuser = connection.scalar(text("SELECT rolsuper FROM pg_roles WHERE rolname=current_user"))
        if not can_set_role and not superuser:
            pytest.skip("The test owner cannot SET ROLE to the local Data API role")
        for table in TABLES:
            savepoint = connection.begin_nested()
            try:
                connection.execute(text(f"SET LOCAL ROLE {role}"))
                with pytest.raises(DBAPIError) as denied:
                    connection.execute(text(f"SELECT 1 FROM public.{table} LIMIT 1"))
                assert getattr(denied.value.orig, "sqlstate", None) == "42501"
            finally:
                savepoint.rollback()
