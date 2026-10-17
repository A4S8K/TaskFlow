from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.base import utcnow
from app.models import Project, ProjectMember, Task, User
from app.schemas import TaskCreate, TaskUpdate
from app.services.permissions import can_edit_task, membership, task_in_project, validate_assignee


def task_query(
    user: User,
    project_id: int | None = None,
    *,
    mine=False,
    search=None,
    status=None,
    priority=None,
    assigned_to_id=None,
    due_before=None,
    due_after=None,
    sort="updated_at",
    direction="desc",
):
    statement = (
        select(Task)
        .join(ProjectMember, ProjectMember.project_id == Task.project_id)
        .where(ProjectMember.user_id == user.id)
        .options(joinedload(Task.project), joinedload(Task.assignee))
    )
    for condition, value in (
        (Task.project_id, project_id),
        (Task.status, status),
        (Task.priority, priority),
        (Task.assigned_to_id, assigned_to_id),
    ):
        if value is not None:
            statement = statement.where(condition == value)
    if mine:
        statement = statement.where(Task.assigned_to_id == user.id)
    if search:
        statement = statement.where(Task.title.ilike(f"%{search}%", escape="\\"))
    if due_before:
        statement = statement.where(Task.due_date <= due_before)
    if due_after:
        statement = statement.where(Task.due_date >= due_after)
    column = getattr(Task, sort)
    return statement.order_by((column.asc() if direction == "asc" else column.desc()).nullslast(), Task.id)


def create_task(db: Session, project_id: int, body: TaskCreate, user: User) -> Task:
    membership(db, project_id, user, lock=True)
    validate_assignee(db, project_id, body.assigned_to_id)
    task = Task(**body.model_dump(), project_id=project_id, creator_id=user.id)
    db.add(task)
    db.get(Project, project_id).updated_at = utcnow()
    db.flush()
    return task


def update_task(db: Session, project_id: int, task_id: int, body: TaskUpdate, user: User) -> Task:
    actor = membership(db, project_id, user, lock=True)
    task = task_in_project(db, project_id, task_id)
    fields = body.model_dump(exclude_unset=True)
    can_edit_task(actor, task, user, set(fields))
    if "assigned_to_id" in fields:
        validate_assignee(db, project_id, fields["assigned_to_id"])
    for key, value in fields.items():
        setattr(task, key, value)
    db.get(Project, project_id).updated_at = utcnow()
    db.flush()
    return task


def delete_task(db: Session, project_id: int, task_id: int, user: User) -> None:
    actor = membership(db, project_id, user, lock=True)
    task = task_in_project(db, project_id, task_id)
    if actor.role not in {"OWNER", "ADMIN"} and task.creator_id != user.id:
        raise HTTPException(403, "FORBIDDEN")
    db.delete(task)
    db.flush()


def normalize_filter_date(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        raise HTTPException(422, "VALIDATION_ERROR")
    return value.astimezone(UTC) if value else None
