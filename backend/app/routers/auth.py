from fastapi import APIRouter, Request

from app.dependencies import DB
from app.i18n.translator import response
from app.schemas import Login, Register
from app.services import auth_service
from app.services.serialization import user_data

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(body: Register, request: Request, db: DB):
    return response(request, "REGISTERED", user_data(auth_service.register(db, body)))


@router.post("/login")
def login(body: Login, request: Request, db: DB):
    return response(request, "SIGNED_IN", auth_service.login(db, body))
