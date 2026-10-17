from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import User

DB = Annotated[Session, Depends(get_db, scope="function")]
bearer = HTTPBearer(auto_error=False)


def current_user(
    request: Request, db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    try:
        if not credentials:
            raise ValueError()
        payload = jwt.decode(
            credentials.credentials,
            get_settings().jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "iat"]},
        )
        user = db.get(User, int(payload["sub"]))
        if not user or not user.is_active:
            raise ValueError()
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, "UNAUTHORIZED", headers={"WWW-Authenticate": "Bearer"}) from None
    request.state.preferred_language = user.preferred_language
    return user


CurrentUser = Annotated[User, Depends(current_user)]
