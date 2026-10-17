from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, ProjectMember, Task, User


def membership(db: Session, project_id: int, user: User, *, lock: bool = False) -> ProjectMember:
    # All project mutations lock the parent first, serializing membership and assignment changes.
    if lock:
        db.scalar(select(Project).where(Project.id == project_id).with_for_update())
    member = db.scalar(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
    )
    if not member:
        raise HTTPException(404, "NOT_FOUND")
    return member


def require_role(member: ProjectMember, *roles: str) -> None:
    if member.role not in roles:
        raise HTTPException(403, "FORBIDDEN")


def task_in_project(db: Session, project_id: int, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(404, "NOT_FOUND")
    return task


def can_edit_task(member: ProjectMember, task: Task, user: User, fields: set[str]) -> None:
    if member.role in {"OWNER", "ADMIN"} or task.creator_id == user.id:
        return
    if task.assigned_to_id == user.id and fields <= {"status"}:
        return
    raise HTTPException(403, "FORBIDDEN")


def validate_assignee(db: Session, project_id: int, user_id: int | None) -> None:
    if user_id is not None and not db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    ):
        raise HTTPException(400, "INVALID_ASSIGNEE")
