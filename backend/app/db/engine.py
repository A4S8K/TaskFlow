"""Database connections shared by the API and Alembic, without connecting on import."""

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from app.core.config import Settings


def build_engine(settings: Settings, *, migration: bool = False) -> Engine:
    options = {
        "hide_parameters": True,
        "connect_args": {
            "connect_timeout": settings.db_connect_timeout_seconds,
            "application_name": "taskflow-migrations" if migration else "taskflow-api",
        },
    }
    if migration:
        # A migration owns one session; do not leave idle pooled connections behind.
        options["poolclass"] = NullPool
    else:
        options.update(
            pool_pre_ping=True,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout_seconds,
            pool_recycle=settings.db_pool_recycle_seconds,
        )
    engine = create_engine(settings.database_url, **options)

    @event.listens_for(engine, "connect")
    def configure_session(dbapi_connection, connection_record):
        # Session poolers need SQL SET commands rather than arbitrary startup
        # options. Autocommit keeps these settings across transaction rollbacks.
        previous_autocommit = dbapi_connection.autocommit
        try:
            dbapi_connection.autocommit = True
            with dbapi_connection.cursor() as cursor:
                cursor.execute(
                    "SELECT set_config('statement_timeout', %s, false), "
                    "set_config('lock_timeout', %s, false)",
                    (str(settings.db_statement_timeout_ms), str(settings.db_lock_timeout_ms)),
                )
        finally:
            dbapi_connection.autocommit = previous_autocommit

    return engine
