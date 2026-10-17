from fastapi import APIRouter, Request

from app.dependencies import DB, CurrentUser
from app.i18n.translator import response
from app.routers.tasks import Filters
from app.schemas import Preferences
from app.services.serialization import paginate, task_data, user_data
from app.services.task_service import task_query

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me")
def me(user: CurrentUser):
    return user_data(user)


@router.patch("/me/preferences")
def preferences(body: Preferences, request: Request, db: DB, user: CurrentUser):
    user.preferred_language = body.preferred_language
    request.state.preferred_language = body.preferred_language
    db.flush()
    return response(request, "PREFERENCES_UPDATED", user_data(user))


@router.get("/me/tasks")
def my_tasks(db: DB, user: CurrentUser, filters: Filters):
    return paginate(
        db, task_query(user, mine=True, **filters.filters), filters.page, filters.page_size, task_data
    )
