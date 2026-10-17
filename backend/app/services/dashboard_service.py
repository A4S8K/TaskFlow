from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.models import Project, ProjectMember, Task, User
from app.services.serialization import project_data, task_data
from app.services.task_service import task_query


def summary(db: Session, user: User) -> dict:
    ids = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
    counts = dict(
        db.execute(
            select(Task.status, func.count()).where(Task.project_id.in_(ids)).group_by(Task.status)
        ).all()
    )
    recent = db.scalars(task_query(user).limit(6)).all()
    upcoming = db.scalars(
        task_query(
            user,
            due_after=utcnow(),
            due_before=utcnow() + timedelta(days=14),
            sort="due_date",
            direction="asc",
        )
        .where(Task.status != "DONE")
        .limit(6)
    ).all()
    projects = db.scalars(
        select(Project).where(Project.id.in_(ids)).order_by(Project.updated_at.desc()).limit(6)
    )
    return {
        "total_projects": db.scalar(select(func.count()).select_from(Project).where(Project.id.in_(ids))),
        "total_tasks": sum(counts.values()),
        "completed_tasks": counts.get("DONE", 0),
        "in_progress_tasks": counts.get("IN_PROGRESS", 0),
        "pending_tasks": counts.get("TODO", 0),
        "upcoming_deadlines": [task_data(task) for task in upcoming],
        "recent_tasks": [task_data(task) for task in recent],
        "recent_projects": [project_data(db, project, user.id) for project in projects],
    }
