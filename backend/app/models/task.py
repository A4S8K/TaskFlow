from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps


class Task(Timestamps, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('TODO','IN_PROGRESS','DONE')"),
        CheckConstraint("priority IN ('LOW','MEDIUM','HIGH','URGENT')"),
        Index("ix_task_project_status", "project_id", "status"),
        Index("ix_task_project_priority", "project_id", "priority"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    assigned_to_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(String(15), default="TODO")
    priority: Mapped[str] = mapped_column(String(10), default="MEDIUM")
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    project = relationship("Project", overlaps="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to_id])
