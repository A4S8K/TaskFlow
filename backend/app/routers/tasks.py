from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import DB, CurrentUser
from app.i18n.translator import response
from app.schemas import Priority, Status, TaskCreate, TaskUpdate
from app.services import task_service as service
from app.services.permissions import membership, task_in_project
from app.services.serialization import paginate, task_data

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["Tasks"])


class TaskFilters:
    def __init__(
        self,
        search: Annotated[str | None, Query(max_length=200)] = None,
        status: Status | None = None,
        priority: Priority | None = None,
        assigned_to_id: Annotated[int | None, Query(gt=0)] = None,
        due_before: datetime | None = None,
        due_after: datetime | None = None,
        sort: Literal["title", "created_at", "updated_at", "due_date", "priority", "status"] = "updated_at",
        direction: Literal["asc", "desc"] = "desc",
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 30,
    ):
        self.page, self.page_size = page, page_size
        self.filters = {
            "search": search,
            "status": status,
            "priority": priority,
            "assigned_to_id": assigned_to_id,
            "due_before": service.normalize_filter_date(due_before),
            "due_after": service.normalize_filter_date(due_after),
            "sort": sort,
            "direction": direction,
        }


Filters = Annotated[TaskFilters, Depends()]


@router.get("")
def list_tasks(project_id: int, db: DB, user: CurrentUser, filters: Filters):
    membership(db, project_id, user)
    return paginate(
        db,
        service.task_query(user, project_id, **filters.filters),
        filters.page,
        filters.page_size,
        task_data,
    )


@router.post("", status_code=201)
def create(project_id: int, body: TaskCreate, request: Request, db: DB, user: CurrentUser):
    return response(request, "TASK_CREATED", task_data(service.create_task(db, project_id, body, user)))


@router.get("/{task_id}")
def get(project_id: int, task_id: int, db: DB, user: CurrentUser):
    membership(db, project_id, user)
    return task_data(task_in_project(db, project_id, task_id))


@router.patch("/{task_id}")
def update(project_id: int, task_id: int, body: TaskUpdate, request: Request, db: DB, user: CurrentUser):
    return response(
        request, "TASK_UPDATED", task_data(service.update_task(db, project_id, task_id, body, user))
    )


@router.delete("/{task_id}")
def delete(project_id: int, task_id: int, request: Request, db: DB, user: CurrentUser):
    service.delete_task(db, project_id, task_id, user)
    return response(request, "TASK_DELETED")
