from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings
from app.db.base import utcnow

hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return hasher.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def create_token(user_id: int) -> str:
    settings = get_settings()
    now = utcnow()
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_minutes),
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def token_user_id(token: str) -> int:
    settings = get_settings()
    if len(token) > 4096:
        raise ValueError("Invalid token")
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        options={"require": ["exp", "sub", "iat", "iss", "aud"]},
    )
    subject = payload["sub"]
    if not isinstance(subject, str) or not subject.isascii() or not subject.isdecimal() or len(subject) > 19:
        raise ValueError("Invalid token subject")
    user_id = int(subject)
    if not 0 < user_id <= 9223372036854775807:
        raise ValueError("Invalid token subject")
    issued, expires = payload["iat"], payload["exp"]
    if (
        type(issued) is not int
        or type(expires) is not int
        or expires <= issued
        or expires - issued > settings.access_token_minutes * 60
    ):
        raise ValueError("Invalid token lifetime")
    return user_id
