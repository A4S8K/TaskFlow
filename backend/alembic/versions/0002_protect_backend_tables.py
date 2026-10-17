"""Keep TaskFlow tables accessible only through the trusted backend.

Revision ID: 0002
Revises: 0001
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = ("users", "projects", "project_members", "tasks", "alembic_version")
SEQUENCES = ("users_id_seq", "projects_id_seq", "project_members_id_seq", "tasks_id_seq")


def upgrade():
    # FastAPI owns authorization and uses a trusted table-owner connection. The
    # Supabase Data API roles have no policies and must not reach password hashes
    # or tenant data, including on projects with legacy automatic public grants.
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")

    tables = ", ".join(f"public.{table}" for table in TABLES)
    sequences = ", ".join(f"public.{sequence}" for sequence in SEQUENCES)
    op.execute(f"REVOKE ALL PRIVILEGES ON TABLE {tables} FROM PUBLIC")
    op.execute(f"REVOKE ALL PRIVILEGES ON SEQUENCE {sequences} FROM PUBLIC")
    # Plain PostgreSQL installations need not define Supabase's roles. Resolve
    # their existence on the server so offline SQL generation stays reproducible.
    op.execute(
        f"""
        DO $taskflow$
        DECLARE target_role text;
        BEGIN
            FOR target_role IN
                SELECT rolname FROM pg_catalog.pg_roles
                WHERE rolname IN ('anon', 'authenticated')
            LOOP
                EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE {tables} FROM %I', target_role);
                EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE {sequences} FROM %I', target_role);
            END LOOP;
        END
        $taskflow$;
        """
    )


def downgrade():
    # Prior grants cannot be reconstructed safely. A downgrade intentionally
    # retains this access boundary; reverting to 0001 must not expose user data.
    pass
