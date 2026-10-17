from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request
from sqlalchemy import select

from app.dependencies import DB, CurrentUser
from app.i18n.translator import response
from app.models import Project, ProjectMember
from app.schemas import ProjectCreate, ProjectUpdate
from app.services import project_service as service
from app.services.permissions import membership
from app.services.serialization import paginate, project_data

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("")
def list_projects(
    db: DB,
    user: CurrentUser,
    search: Annotated[str | None, Query(max_length=150)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 12,
    sort: Literal["name", "created_at", "updated_at"] = "updated_at",
    direction: Literal["asc", "desc"] = "desc",
):
    statement = select(Project).join(ProjectMember).where(ProjectMember.user_id == user.id)
    if search:
        statement = statement.where(Project.name.ilike(f"%{search}%"))
    column = getattr(Project, sort)
    statement = statement.order_by(column.asc() if direction == "asc" else column.desc(), Project.id)
    return paginate(db, statement, page, page_size, lambda p: project_data(db, p, user.id))


@router.post("", status_code=201)
def create(body: ProjectCreate, request: Request, db: DB, user: CurrentUser):
    return response(
        request, "PROJECT_CREATED", project_data(db, service.create_project(db, body, user), user.id)
    )


@router.get("/{project_id}")
def get(project_id: int, db: DB, user: CurrentUser):
    membership(db, project_id, user)
    return project_data(db, db.get(Project, project_id), user.id)


@router.patch("/{project_id}")
def update(project_id: int, body: ProjectUpdate, request: Request, db: DB, user: CurrentUser):
    return response(
        request,
        "PROJECT_UPDATED",
        project_data(db, service.update_project(db, project_id, body, user), user.id),
    )


@router.delete("/{project_id}")
def delete(project_id: int, request: Request, db: DB, user: CurrentUser):
    service.delete_project(db, project_id, user)
    return response(request, "PROJECT_DELETED")
