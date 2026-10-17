from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import token_user_id
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
        user = db.get(User, token_user_id(credentials.credentials))
        if not user or not user.is_active:
            raise ValueError()
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, "UNAUTHORIZED", headers={"WWW-Authenticate": "Bearer"}) from None
    request.state.preferred_language = user.preferred_language
    return user


CurrentUser = Annotated[User, Depends(current_user)]
