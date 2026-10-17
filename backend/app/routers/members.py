from typing import Annotated

from fastapi import APIRouter, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.dependencies import DB, CurrentUser
from app.i18n.translator import response
from app.models import ProjectMember
from app.schemas import MemberCreate, MemberUpdate
from app.services import project_service as service
from app.services.permissions import membership
from app.services.serialization import member_data, paginate

router = APIRouter(prefix="/projects/{project_id}/members", tags=["Members"])


@router.get("")
def list_members(
    project_id: int,
    db: DB,
    user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
):
    membership(db, project_id, user)
    return paginate(
        db,
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .options(joinedload(ProjectMember.user))
        .order_by(ProjectMember.id),
        page,
        page_size,
        member_data,
    )


@router.post("", status_code=201)
def add(project_id: int, body: MemberCreate, request: Request, db: DB, user: CurrentUser):
    return response(request, "MEMBER_ADDED", member_data(service.add_member(db, project_id, body, user)))


@router.patch("/{user_id}")
def update(project_id: int, user_id: int, body: MemberUpdate, request: Request, db: DB, user: CurrentUser):
    return response(
        request, "MEMBER_UPDATED", member_data(service.change_member(db, project_id, user_id, body, user))
    )


@router.delete("/{user_id}")
def remove(project_id: int, user_id: int, request: Request, db: DB, user: CurrentUser):
    service.change_member(db, project_id, user_id, None, user)
    return response(request, "MEMBER_REMOVED")
