from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.base import utcnow
from app.models import Project, ProjectMember, Task, User
from app.schemas import MemberCreate, MemberUpdate, ProjectCreate, ProjectUpdate
from app.services.permissions import membership, require_role


def create_project(db: Session, body: ProjectCreate, user: User) -> Project:
    project = Project(**body.model_dump(), owner_id=user.id)
    db.add(project)
    db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role="OWNER"))
    db.flush()
    return project


def update_project(db: Session, project_id: int, body: ProjectUpdate, user: User) -> Project:
    require_role(membership(db, project_id, user, lock=True), "OWNER", "ADMIN")
    project = db.get(Project, project_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.flush()
    return project


def delete_project(db: Session, project_id: int, user: User) -> None:
    require_role(membership(db, project_id, user, lock=True), "OWNER")
    db.delete(db.get(Project, project_id))
    db.flush()


def add_member(db: Session, project_id: int, body: MemberCreate, user: User) -> ProjectMember:
    actor = membership(db, project_id, user, lock=True)
    require_role(actor, "OWNER", "ADMIN")
    if body.role == "ADMIN":
        require_role(actor, "OWNER")
    target = db.scalar(select(User).where(User.email == str(body.email).lower(), User.is_active.is_(True)))
    if not target:
        raise HTTPException(404, "NOT_FOUND")
    if db.scalar(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == target.id
        )
    ):
        raise HTTPException(409, "CONFLICT")
    member = ProjectMember(project_id=project_id, user_id=target.id, role=body.role)
    db.add(member)
    db.flush()
    return member


def change_member(db: Session, project_id: int, user_id: int, body: MemberUpdate | None, user: User):
    actor = membership(db, project_id, user, lock=True)
    require_role(actor, "OWNER", "ADMIN")
    target = db.scalar(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    if not target:
        raise HTTPException(404, "NOT_FOUND")
    if target.role == "OWNER":
        raise HTTPException(403, "FORBIDDEN")
    if body is not None or target.role == "ADMIN":
        require_role(actor, "OWNER")
    if body:
        target.role = body.role
    else:
        db.execute(
            update(Task)
            .where(Task.project_id == project_id, Task.assigned_to_id == user_id)
            .values(assigned_to_id=None, updated_at=utcnow())
        )
        db.delete(target)
    db.flush()
    return target
