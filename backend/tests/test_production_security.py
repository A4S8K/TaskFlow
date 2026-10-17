import asyncio
import secrets
import time

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core import security
from app.core.config import Settings
from app.core.middleware import AuthRateLimiter, AuthRateLimitMiddleware
from app.db.session import get_db
from app.i18n.translator import LOCALES
from app.main import create_app


@pytest.fixture
def configuration(monkeypatch):
    # No environment values or developer .env may influence configuration cases.
    for name, field in Settings.model_fields.items():
        monkeypatch.delenv(name.upper(), raising=False)
        for alias in getattr(field.validation_alias, "choices", []):
            monkeypatch.delenv(alias, raising=False)
    key = secrets.token_urlsafe(48)

    def build(**overrides):
        return Settings(_env_file=None, **{"jwt_secret_key": key, **overrides})

    return build


@pytest.fixture
def production_values():
    return {
        "app_env": "production",
        "database_url": (
            "postgresql://unit:unit-test-password@db.unit-test.invalid:5432/taskflow"
            "?sslmode=verify-full&sslrootcert=system"
        ),
        "frontend_url": "https://taskflow.unit-test.invalid",
        "backend_url": "https://api.unit-test.invalid",
        "cors_origins": ["https://taskflow.unit-test.invalid"],
        "trusted_hosts": ["api.unit-test.invalid"],
        "trusted_proxy_ips": "10.0.0.0/24",
    }


def test_legacy_environment_names_and_secret_redaction(configuration, monkeypatch):
    key = secrets.token_urlsafe(48)
    monkeypatch.setenv("JWT_SECRET", key)
    monkeypatch.setenv("ACCESS_TOKEN_MINUTES", "45")
    settings = Settings(_env_file=None)
    assert settings.jwt_secret == key
    assert settings.access_token_minutes == 45
    assert key not in repr(settings)
    assert key not in settings.model_dump_json()
    assert "database_url" not in settings.model_dump()


def test_canonical_settings_aliases_and_origin_lists(configuration, monkeypatch):
    key = secrets.token_urlsafe(48)
    monkeypatch.setenv("JWT_SECRET_KEY", key)
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "40")
    monkeypatch.setenv("CORS_ORIGINS", "https://one.unit-test.invalid,https://two.unit-test.invalid/")
    settings = Settings(_env_file=None)
    assert settings.jwt_secret == key
    assert settings.access_token_minutes == 40
    assert settings.cors_origins == ["https://one.unit-test.invalid", "https://two.unit-test.invalid"]


def test_startup_errors_do_not_echo_sensitive_values(configuration, production_values):
    marker = "never-display-this-database-password"
    values = {**production_values, "database_url": "invalid://unit:" + marker + "@host/db"}
    with pytest.raises(ValidationError) as caught:
        configuration(**values)
    assert marker not in str(caught.value)
    assert "input_value" not in str(caught.value)
    with pytest.raises(ValidationError) as caught:
        configuration(jwt_secret_key="short-secret-value")
    assert "short-secret-value" not in str(caught.value)


def test_production_requires_explicit_configuration(configuration):
    with pytest.raises(ValidationError, match="Production requires explicit settings"):
        configuration(app_env="production")


def test_valid_production_configuration_normalizes_postgres_url(configuration, production_values):
    settings = configuration(**production_values)
    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.debug is False
    assert settings.web_concurrency == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"debug": True},
        {"web_concurrency": 2},
        {"frontend_url": "http://taskflow.unit-test.invalid"},
        {"backend_url": "https://localhost"},
        {"cors_origins": ["*"]},
        {"cors_origins": ["http://localhost:5173"]},
        {"cors_origins": ["https://other.unit-test.invalid"]},
        {"trusted_hosts": ["*"]},
        {"trusted_hosts": ["other.unit-test.invalid"]},
        {"trusted_proxy_ips": "*"},
        {"trusted_proxy_ips": "0.0.0.0/0"},
        {"jwt_secret_key": "REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"},
        {"jwt_secret_key": "a" * 64},
        {"jwt_algorithm": "none"},
        {"db_pool_mode": "transaction"},
        {"database_url": "postgresql://unit:unit-test-password@db.unit-test.invalid/taskflow"},
        {
            "database_url": "postgresql://unit:unit-test-password@db.unit-test.invalid/taskflow?sslmode=require"
        },
        {
            "database_url": "postgresql://unit:unit-test-password@db.unit-test.invalid:6543/taskflow"
            "?sslmode=verify-full&sslrootcert=system"
        },
    ],
)
def test_unsafe_production_settings_rejected(configuration, production_values, changes):
    with pytest.raises(ValidationError):
        configuration(**{**production_values, **changes})


@pytest.mark.parametrize(
    "value", ["https://user:password@host.invalid", "https://host.invalid/path", "https://*.invalid"]
)
def test_origin_requires_exact_origin(configuration, value):
    with pytest.raises(ValidationError):
        configuration(cors_origins=[value])


def test_health_readiness_and_security_headers(configuration):
    application = create_app(configuration())
    queries = []

    class Database:
        def execute(self, statement):
            queries.append(str(statement))

    application.dependency_overrides[get_db] = lambda: Database()
    with TestClient(application) as client:
        for path in ("/health", "/api/v1/health"):
            result = client.get(path)
            assert result.json() == {"status": "ok", "service": "taskflow-api"}
            assert result.headers["X-Content-Type-Options"] == "nosniff"
            assert result.headers["Cache-Control"] == "no-store"
        assert queries == []
        assert client.get("/ready").json() == {"status": "ready", "service": "taskflow-api"}
    assert queries == ["SELECT 1"]


@pytest.mark.parametrize("language", ["en", "ru", "kk"])
def test_database_outage_is_redacted_localized_503(configuration, language, caplog):
    application = create_app(configuration())
    marker = "never-display-this-driver-secret"

    def unavailable():
        raise OperationalError("SELECT private_data", {"password": marker}, Exception(marker))

    application.dependency_overrides[get_db] = unavailable
    with TestClient(application) as client:
        health = client.get("/health")
        result = client.get(
            "/ready", headers={"Accept-Language": language, "Origin": "http://localhost:5173"}
        )
    assert health.status_code == 200
    assert result.status_code == 503
    assert result.json()["code"] == "SERVICE_UNAVAILABLE"
    assert result.json()["message"] == LOCALES[language]["SERVICE_UNAVAILABLE"]
    assert result.headers["Retry-After"] == "5"
    assert result.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert marker not in result.text + caplog.text
    assert "private_data" not in caplog.text


def test_cors_preflight_and_unauthorized_origin(configuration):
    application = create_app(configuration())
    with TestClient(application) as client:
        allowed = client.options(
            "/api/v1/projects",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Authorization,Content-Type,Accept-Language",
            },
        )
        denied = client.options(
            "/api/v1/projects",
            headers={"Origin": "https://untrusted.unit-test.invalid", "Access-Control-Request-Method": "GET"},
        )
        simple = client.get("/health", headers={"Origin": "https://untrusted.unit-test.invalid"})
    assert allowed.status_code == 200
    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "authorization" in allowed.headers["Access-Control-Allow-Headers"].lower()
    assert "Access-Control-Allow-Credentials" not in allowed.headers
    assert denied.status_code == 400
    assert "Access-Control-Allow-Origin" not in denied.headers
    assert "Access-Control-Allow-Origin" not in simple.headers


def test_unhandled_errors_keep_cors_and_do_not_log_exception_contents(configuration, caplog):
    application = create_app(configuration())
    marker = "never-display-this-unhandled-secret"

    @application.get("/unit-error")
    def error():
        raise RuntimeError(marker)

    with TestClient(application) as client:
        result = client.get("/unit-error", headers={"Origin": "http://localhost:5173"})
    assert result.status_code == 500
    assert result.json()["code"] == "INTERNAL_ERROR"
    assert result.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert result.headers["X-Content-Type-Options"] == "nosniff"
    assert marker not in result.text + caplog.text
    assert "api_request_failed" in caplog.text


def test_production_https_redirect_hsts_and_host_validation(configuration, production_values):
    application = create_app(configuration(**production_values))
    with TestClient(application, base_url="https://api.unit-test.invalid") as client:
        result = client.get("/health")
        redirect = client.get("http://api.unit-test.invalid/api/v1/projects", follow_redirects=False)
        docs_redirect = client.get("http://api.unit-test.invalid/docs/en", follow_redirects=False)
        denied = client.get("https://untrusted.unit-test.invalid/health")
    assert result.status_code == 200
    assert result.headers["Strict-Transport-Security"] == "max-age=31536000"
    assert redirect.status_code == 307
    assert redirect.headers["Location"] == "https://api.unit-test.invalid/api/v1/projects"
    assert docs_redirect.status_code == 307
    assert docs_redirect.headers["Location"] == "https://api.unit-test.invalid/docs/en"
    assert denied.status_code == 400


@pytest.mark.parametrize("database_available", [False, True])
def test_production_internal_http_readiness_runs_database_check(
    configuration, production_values, database_available
):
    application = create_app(configuration(**production_values))
    queries = []

    class Database:
        def execute(self, statement):
            queries.append(str(statement))
            if not database_available:
                raise OperationalError("SELECT 1", {}, Exception("simulated database outage"))

    application.dependency_overrides[get_db] = lambda: Database()
    with TestClient(application, base_url="http://api.unit-test.invalid") as client:
        for path in ("/health", "/api/v1/health"):
            assert client.get(path, follow_redirects=False).status_code == 200
        result = client.get("/ready", follow_redirects=False)
        invalid_host = client.get("http://untrusted.unit-test.invalid/ready", follow_redirects=False)
    assert result.status_code == (200 if database_available else 503)
    assert "Location" not in result.headers
    assert queries == ["SELECT 1"]
    assert invalid_host.status_code == 400


def test_authentication_limits_before_database_and_does_not_trust_forwarding_headers(
    configuration, monkeypatch
):
    application = create_app(configuration(auth_login_limit=2, auth_register_limit=1))
    application.dependency_overrides[get_db] = lambda: object()
    calls = []

    def login(db, body):
        calls.append(body.email)
        raise HTTPException(401, "INVALID_CREDENTIALS")

    monkeypatch.setattr("app.routers.auth.auth_service.login", login)
    with TestClient(application) as client:
        for number in range(2):
            result = client.post(
                "/api/v1/auth/login",
                json={"email": "nobody@example.com", "password": "wrong"},
                headers={"X-Forwarded-For": f"192.0.2.{number}"},
            )
            assert result.status_code == 401
        for language in ("en", "ru", "kk"):
            blocked = client.post(
                "/api/v1/auth/login",
                json={},
                headers={"Accept-Language": language, "Origin": "http://localhost:5173"},
            )
            assert blocked.status_code == 429
            assert blocked.json()["message"] == LOCALES[language]["RATE_LIMITED"]
            assert int(blocked.headers["Retry-After"]) > 0
            assert blocked.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert len(calls) == 2


def test_rate_limiter_bounds_state_fails_closed_and_expires(configuration):
    now = [100.0]
    limiter = AuthRateLimiter(configuration(auth_rate_max_keys=2, auth_login_limit=1), clock=lambda: now[0])
    path = "/api/v1/auth/login"
    assert limiter.retry_after("one", path) is None
    assert limiter.retry_after("one", path) == 60
    assert limiter.retry_after("two", path) is None
    assert limiter.retry_after("three", path) == 60
    assert len(limiter.entries) == 2
    now[0] += 61
    assert limiter.retry_after("three", path) is None
    assert len(limiter.entries) == 1


def test_authentication_concurrency_is_bounded_and_released_on_exception(configuration):
    limiter = AuthRateLimiter(configuration(auth_max_concurrent=1))

    async def check():
        entered = asyncio.Event()
        release = asyncio.Event()
        messages = []

        async def slow_app(scope, receive, send):
            entered.set()
            await release.wait()
            raise RuntimeError("simulated failure")

        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(message):
            messages.append(message)

        middleware = AuthRateLimitMiddleware(slow_app, limiter)
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/login",
            "client": ("192.0.2.1", 1234),
            "headers": [],
            "query_string": b"",
        }
        first = asyncio.create_task(middleware(scope, receive, send))
        await entered.wait()
        await middleware({**scope, "client": ("192.0.2.2", 1234)}, receive, send)
        assert messages[0]["status"] == 429
        release.set()
        with pytest.raises(RuntimeError, match="simulated failure"):
            await first
        assert limiter.active == 0
        assert limiter.enter()
        limiter.leave()

    asyncio.run(check())


def test_jwt_roundtrip_and_invalid_password_hash(configuration, monkeypatch):
    settings = configuration()
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    assert security.token_user_id(security.create_token(42)) == 42
    assert security.verify_password("irrelevant", "broken-hash") is False


@pytest.mark.parametrize(
    "changes",
    [
        {"sub": "-1"},
        {"sub": "0"},
        {"sub": "1.0"},
        {"sub": "9" * 30},
        {"sub": "9223372036854775808"},
        {"sub": "١"},
        {"sub": 1},
        {"iss": "other-issuer"},
        {"aud": "other-audience"},
        {"exp": 1},
        {"iat": True},
        {"exp": None},
        {"iat": "1"},
        {"exp": int(time.time()) + 60 * 121},
    ],
)
def test_invalid_jwt_claims_rejected(configuration, monkeypatch, changes):
    settings = configuration()
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    now = int(time.time())
    payload = {
        "sub": "42",
        "iat": now,
        "exp": now + 60,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        **changes,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    with pytest.raises((jwt.InvalidTokenError, ValueError, TypeError)):
        security.token_user_id(token)


def test_missing_claims_wrong_signature_algorithm_and_oversized_jwt_rejected(configuration, monkeypatch):
    settings = configuration()
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    token = security.create_token(1)
    payload = jwt.decode(token, options={"verify_signature": False})
    tokens = [
        jwt.encode(payload, secrets.token_urlsafe(48), algorithm="HS256"),
        jwt.encode(payload, settings.jwt_secret, algorithm="HS384"),
        jwt.encode({"sub": "1"}, settings.jwt_secret, algorithm="HS256"),
        "x" * 4097,
    ]
    for bad_token in tokens:
        with pytest.raises((jwt.InvalidTokenError, ValueError)):
            security.token_user_id(bad_token)
