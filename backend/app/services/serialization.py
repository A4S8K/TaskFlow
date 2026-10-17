from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Project, ProjectMember, Task, User


def user_data(user: User) -> dict:
    return {
        key: getattr(user, key)
        for key in ("id", "username", "email", "preferred_language", "is_active", "created_at", "updated_at")
    }


def project_data(db: Session, project: Project, user_id: int) -> dict:
    total = db.scalar(select(func.count()).select_from(Task).where(Task.project_id == project.id)) or 0
    done = (
        db.scalar(
            select(func.count()).select_from(Task).where(Task.project_id == project.id, Task.status == "DONE")
        )
        or 0
    )
    return {
        **{
            key: getattr(project, key)
            for key in ("id", "name", "description", "owner_id", "created_at", "updated_at")
        },
        "task_count": total,
        "completed_tasks": done,
        "completion_percentage": round(done / total * 100) if total else 0,
        "member_count": db.scalar(
            select(func.count()).select_from(ProjectMember).where(ProjectMember.project_id == project.id)
        ),
        "role": db.scalar(
            select(ProjectMember.role).where(
                ProjectMember.project_id == project.id, ProjectMember.user_id == user_id
            )
        ),
    }


def task_data(task: Task) -> dict:
    return {
        **{
            key: getattr(task, key)
            for key in (
                "id",
                "title",
                "description",
                "project_id",
                "creator_id",
                "assigned_to_id",
                "status",
                "priority",
                "due_date",
                "created_at",
                "updated_at",
            )
        },
        "project_name": task.project.name,
        "assignee_username": task.assignee.username if task.assignee else None,
    }


def member_data(member: ProjectMember) -> dict:
    return {
        "id": member.id,
        "user_id": member.user_id,
        "project_id": member.project_id,
        "role": member.role,
        "joined_at": member.joined_at,
        "username": member.user.username,
        "email": member.user.email,
    }


def paginate(db: Session, statement, page: int, page_size: int, serializer) -> dict:
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    rows = db.scalars(statement.offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [serializer(row) for row in rows], "page": page, "page_size": page_size, "total": total}
