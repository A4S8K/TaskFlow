import os
import secrets

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

os.environ.setdefault("JWT_SECRET", secrets.token_urlsafe(48))

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app


@pytest.fixture
def client():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test")
    parsed = make_url(url)
    if parsed.get_backend_name() != "postgresql" or not (parsed.database or "").endswith("_test"):
        pytest.fail("Tests require a dedicated PostgreSQL database whose name ends with _test")
    if url == os.environ.get("DATABASE_URL"):
        pytest.fail("Test and application databases must be different")
    engine = create_engine(url, connect_args={"connect_timeout": 10})
    # Every test runs in an external transaction. Endpoint commits release savepoints only.
    with engine.connect() as connection:
        transaction = connection.begin()

        def session_override():
            with Session(
                bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
            ) as db:
                try:
                    yield db
                    db.commit()
                except Exception:
                    db.rollback()
                    raise

        app.dependency_overrides[get_db] = session_override
        # Each test client represents an isolated application run, including auth throttles.
        app.state.auth_limiter.reset()
        with TestClient(app) as test_client:
            yield test_client
        app.dependency_overrides.clear()
        transaction.rollback()
    engine.dispose()


@pytest.fixture
def account(client):
    def create(name="owner", lang="en"):
        email, password = f"{name}@example.com", "correct horse battery staple"
        result = client.post(
            "/api/v1/auth/register",
            json={"username": name, "email": email, "password": password, "preferred_language": lang},
        )
        assert result.status_code == 201, result.text
        login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200
        return result.json()["data"], {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    return create


@pytest.fixture
def workspace(client, account):
    owner, headers = account()
    result = client.post(
        "/api/v1/projects", headers=headers, json={"name": "Launch", "description": "Ship it"}
    )
    assert result.status_code == 201, result.text
    return owner, headers, result.json()["data"]
