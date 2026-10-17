from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import create_token, hash_password, verify_password
from app.models import User
from app.schemas import Login, Register

# Verify a fixed hash on unknown-email logins to avoid a cheap timing distinction.
DUMMY_HASH = hash_password("unused-timing-equalizer")


def register(db: Session, body: Register) -> User:
    email = str(body.email).strip().lower()
    if db.scalar(select(User.id).where(or_(User.email == email, User.username == body.username))):
        raise HTTPException(409, "CONFLICT")
    user = User(
        username=body.username,
        email=email,
        hashed_password=hash_password(body.password),
        preferred_language=body.preferred_language,
    )
    db.add(user)
    db.flush()
    return user


def login(db: Session, body: Login) -> dict:
    user = db.scalar(select(User).where(User.email == str(body.email).strip().lower()))
    valid = verify_password(body.password, user.hashed_password if user else DUMMY_HASH)
    if not user or not valid or not user.is_active:
        raise HTTPException(401, "INVALID_CREDENTIALS")
    return {"access_token": create_token(user.id), "token_type": "bearer"}
