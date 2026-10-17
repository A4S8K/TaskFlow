from datetime import timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.db.base import utcnow


def test_registration_login_and_profile(client, account):
    user, headers = account()
    assert "hashed_password" not in user
    assert client.get("/api/v1/users/me", headers=headers).json()["email"] == "owner@example.com"
    result = client.post(
        "/api/v1/auth/register",
        json={"username": "other", "email": "OWNER@EXAMPLE.COM", "password": "long enough password"},
    )
    assert result.status_code == 409
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "owner@example.com", "password": "wrong"}
        ).status_code
        == 401
    )


@pytest.mark.parametrize("token", [None, "invalid.jwt.token"])
def test_protected_endpoints(client, token):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    for path in ("users/me", "projects", "dashboard/summary", "users/me/tasks"):
        assert client.get(f"/api/v1/{path}", headers=headers).status_code == 401


def test_expired_token(client, account):
    user, _ = account()
    token = jwt.encode(
        {"sub": str(user["id"]), "iat": utcnow() - timedelta(hours=2), "exp": utcnow() - timedelta(hours=1)},
        get_settings().jwt_secret,
        algorithm="HS256",
    )
    assert client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_validation_hides_credentials(client):
    secret = "tiny"
    result = client.post(
        "/api/v1/auth/register", json={"username": "u", "email": "invalid", "password": secret}
    )
    assert result.status_code == 422
    assert secret not in result.text


def test_password_whitespace_preserved(client, account):
    body = {"username": "spaces", "email": "spaces@example.com", "password": "  very secret pass  "}
    assert client.post("/api/v1/auth/register", json=body).status_code == 201
    assert (
        client.post("/api/v1/auth/login", json={k: body[k] for k in ("email", "password")}).status_code == 200
    )
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": body["email"], "password": body["password"].strip()}
        ).status_code
        == 401
    )
