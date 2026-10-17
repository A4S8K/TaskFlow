"""Create users, projects, memberships, and tasks.

Revision ID: 0001
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamps():
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("preferred_language", sa.String(2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
        sa.CheckConstraint("preferred_language IN ('en','ru','kk')"),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        *timestamps(),
    )
    for column in ("name", "owner_id"):
        op.create_index(f"ix_projects_{column}", "projects", [column])
    op.create_table(
        "project_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "user_id", name="uq_membership"),
        sa.CheckConstraint("role IN ('OWNER','ADMIN','MEMBER')"),
    )
    for column in ("project_id", "user_id"):
        op.create_index(f"ix_project_members_{column}", "project_members", [column])
    op.create_index(
        "uq_project_owner",
        "project_members",
        ["project_id"],
        unique=True,
        postgresql_where=sa.text("role = 'OWNER'"),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(15), nullable=False),
        sa.Column("priority", sa.String(10), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.CheckConstraint("status IN ('TODO','IN_PROGRESS','DONE')"),
        sa.CheckConstraint("priority IN ('LOW','MEDIUM','HIGH','URGENT')"),
    )
    for column in ("title", "project_id", "assigned_to_id", "due_date"):
        op.create_index(f"ix_tasks_{column}", "tasks", [column])
    op.create_index("ix_task_project_status", "tasks", ["project_id", "status"])
    op.create_index("ix_task_project_priority", "tasks", ["project_id", "priority"])


def downgrade():
    for table in ("tasks", "project_members", "projects", "users"):
        op.drop_table(table)
