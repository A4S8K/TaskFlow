from fastapi import APIRouter

from app.dependencies import DB, CurrentUser
from app.services.dashboard_service import summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def dashboard(db: DB, user: CurrentUser):
    return summary(db, user)
