import secrets

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.db.session import get_db
from app.main import create_app


@pytest.fixture
def render_settings(monkeypatch):
    for name, field in Settings.model_fields.items():
        monkeypatch.delenv(name.upper(), raising=False)
        for alias in getattr(field.validation_alias, "choices", []):
            monkeypatch.delenv(alias, raising=False)
    values = {
        "app_env": "production",
        "jwt_secret_key": secrets.token_urlsafe(48),
        "database_url": (
            "postgresql://unit:unit-test-password@db.unit-test.invalid:5432/taskflow"
            "?sslmode=verify-full&sslrootcert=system"
        ),
        "frontend_url": "https://taskflow.unit-test.invalid",
        "backend_url": "https://taskflow-ingress-test.onrender.com",
        "cors_origins": ["https://taskflow.unit-test.invalid"],
        "trusted_hosts": ["taskflow-ingress-test.onrender.com"],
        "ingress_mode": "render-free",
        "render_free_ingress_ack": True,
        "render": "true",
        "render_service_id": "srv-unittest",
        "render_service_type": "web",
        "render_external_hostname": "taskflow-ingress-test.onrender.com",
        "render_cpu_count": "0.15",
    }

    def build(**overrides):
        return Settings(_env_file=None, **{**values, **overrides})

    return build


def edge_headers(client="8.8.8.8"):
    return [("CF-Connecting-IP", client), ("X-Forwarded-Proto", "https")]


def inspectable_app(settings):
    application = create_app(settings)

    @application.get("/ingress-test")
    def inspect(request: Request):
        return {
            "client": request.client.host,
            "scheme": request.url.scheme,
            "forwarded": request.headers.get("Forwarded"),
            "xff": request.headers.get("X-Forwarded-For"),
            "xfp": request.headers.get("X-Forwarded-Proto"),
        }

    return application


@pytest.mark.parametrize(
    "changes",
    [
        {"app_env": "development"},
        {"render_free_ingress_ack": False},
        {"render": None},
        {"render": "false"},
        {"render_service_id": None},
        {"render_service_id": "not-a-service"},
        {"render_service_type": "pserv"},
        {"render_service_type": None},
        {"render_cpu_count": "0.5"},
        {"render_cpu_count": None},
        {"render_external_hostname": None},
        {"render_external_hostname": "unrelated.onrender.com"},
        {"render_external_hostname": "taskflow-ingress-test.onrender.com.evil.invalid"},
        {"trusted_proxy_ips": "*"},
    ],
)
def test_render_mode_requires_explicit_free_public_platform_contract(render_settings, changes):
    with pytest.raises(ValidationError):
        render_settings(**changes)


def test_render_markers_can_be_read_from_platform_environment(render_settings, monkeypatch):
    settings = render_settings()
    for name in (
        "render",
        "render_service_id",
        "render_service_type",
        "render_external_hostname",
        "render_cpu_count",
    ):
        monkeypatch.setenv(name.upper(), getattr(settings, name))
    values = settings.model_dump(exclude={"database_url", "jwt_secret_key"})
    for name in (
        "render",
        "render_service_id",
        "render_service_type",
        "render_external_hostname",
        "render_cpu_count",
    ):
        del values[name]
    actual = Settings(
        _env_file=None, **values, database_url=settings.database_url, jwt_secret_key=settings.jwt_secret
    )
    assert actual.render == "true"
    assert actual.render_service_type == "web"


@pytest.mark.parametrize("cpu_count", ["0.1", "0.15"])
def test_only_documented_or_observed_free_cpu_markers_are_accepted(render_settings, cpu_count):
    assert render_settings(render_cpu_count=cpu_count).render_cpu_count == cpu_count


@pytest.mark.parametrize(
    ("client_ip", "expected"),
    [
        ("8.8.8.8", "8.8.8.8"),
        ("2606:4700:4700:0:0:0:0:1111", "2606:4700:4700::1111"),
        ("::ffff:8.8.8.8", "8.8.8.8"),
    ],
)
def test_render_edge_sets_https_and_canonical_client_without_trusting_xff(
    render_settings, client_ip, expected
):
    application = inspectable_app(render_settings())
    headers = edge_headers(client_ip) + [
        ("X-Forwarded-For", "192.0.2.123"),
        ("X-Forwarded-For", "1.1.1.1"),
        ("Forwarded", 'for=1.1.1.1;proto=http;host="evil.invalid"'),
        ("X-Forwarded-Host", "evil.invalid"),
    ]
    with TestClient(application, base_url="http://taskflow-ingress-test.onrender.com") as client:
        result = client.get("/ingress-test", headers=headers, follow_redirects=False)
        unauthorized = client.get("/api/v1/projects", headers=headers, follow_redirects=False)
    assert result.status_code == 200
    assert result.json() == {
        "client": expected,
        "scheme": "https",
        "forwarded": None,
        "xff": None,
        "xfp": None,
    }
    assert result.headers["Strict-Transport-Security"] == "max-age=31536000"
    assert unauthorized.status_code == 401
    assert "Location" not in unauthorized.headers


@pytest.mark.parametrize(
    "headers",
    [
        [],
        [("CF-Connecting-IP", "8.8.8.8")],
        [("X-Forwarded-Proto", "https")],
        edge_headers() + [("CF-Connecting-IP", "1.1.1.1")],
        edge_headers() + [("CF-Connecting-IP", "8.8.8.8")],
        edge_headers() + [("X-Forwarded-Proto", "https")],
        [("CF-Connecting-IP", "8.8.8.8"), ("X-Forwarded-Proto", "http")],
        [("CF-Connecting-IP", "8.8.8.8"), ("X-Forwarded-Proto", "https,http")],
        [("CF-Connecting-IP", "8.8.8.8"), ("X-Forwarded-Proto", " https")],
        [("CF-Connecting-IP", "8.8.8.8"), ("X-Forwarded-Proto", "HTTPS")],
    ]
    + [
        edge_headers(value)
        for value in (
            "",
            "unknown",
            "8.8.8.8,1.1.1.1",
            "8.8.8.8:443",
            " 8.8.8.8",
            "8.8.8.8 ",
            "127.0.0.1",
            "10.0.0.1",
            "192.0.2.1",
            "0.0.0.0",
            "224.0.0.1",
            "::",
            "::1",
            "fe80::1",
            "ff02::1",
            "2606:4700:4700::1111%scope",
            "::ffff:127.0.0.1",
        )
    ],
)
def test_render_edge_rejects_missing_duplicate_malformed_or_nonpublic_headers(render_settings, headers):
    application = inspectable_app(render_settings())
    with TestClient(application, base_url="http://taskflow-ingress-test.onrender.com") as client:
        for path in ("/ingress-test", "/api/v1/auth/login"):
            result = client.request("GET" if path == "/ingress-test" else "POST", path, headers=headers)
            assert result.status_code == 400
            assert result.json()["code"] == "INVALID_INGRESS"
            assert "Location" not in result.headers
    assert application.state.auth_limiter.entries == {}


@pytest.mark.parametrize("database_available", [False, True])
@pytest.mark.parametrize(
    "proto_headers", [[], [("X-Forwarded-Proto", "http")], [("X-Forwarded-Proto", "https")]]
)
def test_headerless_internal_get_probes_execute_real_checks_and_host_validation(
    render_settings, database_available, proto_headers
):
    application = create_app(render_settings())
    queries = []

    class Database:
        def execute(self, statement):
            queries.append(str(statement))
            if not database_available:
                raise OperationalError("SELECT 1", {}, Exception("simulated outage"))

    application.dependency_overrides[get_db] = lambda: Database()
    with TestClient(application, base_url="http://taskflow-ingress-test.onrender.com") as client:
        for path in ("/health", "/api/v1/health"):
            assert client.get(path, headers=proto_headers, follow_redirects=False).status_code == 200
        ready = client.get("/ready", headers=proto_headers, follow_redirects=False)
        invalid_host = client.get(
            "http://untrusted.invalid/ready", headers=proto_headers, follow_redirects=False
        )
        post = client.post("/ready", headers=proto_headers, follow_redirects=False)
    assert ready.status_code == (200 if database_available else 503)
    assert "Strict-Transport-Security" not in ready.headers
    assert "Location" not in ready.headers
    assert queries == ["SELECT 1"]
    assert invalid_host.status_code == 400
    assert post.status_code == 400


def test_edge_validation_precedes_cors_preflight_and_health_exceptions(render_settings):
    application = create_app(render_settings())
    with TestClient(application, base_url="http://taskflow-ingress-test.onrender.com") as client:
        preflight_headers = [
            ("Origin", "https://taskflow.unit-test.invalid"),
            ("Access-Control-Request-Method", "POST"),
            ("Access-Control-Request-Headers", "Authorization,Content-Type"),
        ]
        denied = client.options("/api/v1/auth/login", headers=preflight_headers)
        allowed = client.options("/api/v1/auth/login", headers=edge_headers() + preflight_headers)
        malformed_probe = client.get("/ready", headers=edge_headers("127.0.0.1"))
        duplicate_probe = client.get("/ready", headers=[("X-Forwarded-Proto", "http")] * 2)
        invalid_host = client.get("http://untrusted.invalid/health", headers=edge_headers())
    assert denied.status_code == 400
    assert denied.json()["code"] == "INVALID_INGRESS"
    assert allowed.status_code == 200
    assert allowed.headers["Access-Control-Allow-Origin"] == "https://taskflow.unit-test.invalid"
    assert allowed.headers["Strict-Transport-Security"] == "max-age=31536000"
    assert malformed_probe.status_code == 400
    assert duplicate_probe.status_code == 400
    assert invalid_host.status_code == 400


def test_render_limiter_uses_edge_client_and_cannot_be_reset_with_forged_xff(render_settings, monkeypatch):
    application = create_app(render_settings(auth_login_limit=1))
    application.dependency_overrides[get_db] = lambda: object()
    calls = []

    def login(db, body):
        calls.append(body.email)
        raise HTTPException(401, "INVALID_CREDENTIALS")

    monkeypatch.setattr("app.routers.auth.auth_service.login", login)
    body = {"email": "nobody@example.com", "password": "wrong"}
    with TestClient(application, base_url="http://taskflow-ingress-test.onrender.com") as client:
        for number, status in ((1, 401), (2, 429), (3, 429)):
            result = client.post(
                "/api/v1/auth/login",
                json=body,
                headers=edge_headers() + [("X-Forwarded-For", f"192.0.2.{number}")],
            )
            assert result.status_code == status
        other = client.post("/api/v1/auth/login", json=body, headers=edge_headers("1.1.1.1"))
    assert other.status_code == 401
    assert len(calls) == 2
    assert set(application.state.auth_limiter.entries) == {
        ("8.8.8.8", "/api/v1/auth/login"),
        ("1.1.1.1", "/api/v1/auth/login"),
    }


def test_default_explicit_proxy_mode_ignores_render_specific_headers(render_settings):
    settings = render_settings(ingress_mode="explicit-proxy", trusted_proxy_ips="127.0.0.1")
    application = inspectable_app(settings)
    with TestClient(application, base_url="https://taskflow-ingress-test.onrender.com") as client:
        result = client.get("/ingress-test", headers=edge_headers())
        redirect = client.get(
            "http://taskflow-ingress-test.onrender.com/ingress-test",
            headers=edge_headers(),
            follow_redirects=False,
        )
    assert result.json()["client"] == "testclient"
    assert result.json()["xfp"] == "https"
    assert redirect.status_code == 307


@pytest.mark.parametrize(
    ("language", "message"),
    [("en", "Invalid request."), ("ru", "Некорректный запрос."), ("kk", "Сұрау қате.")],
)
def test_ingress_error_keeps_localized_api_envelope(render_settings, language, message):
    with TestClient(
        create_app(render_settings()), base_url="http://taskflow-ingress-test.onrender.com"
    ) as client:
        result = client.get("/api/v1/projects", headers={"Accept-Language": language})
    assert result.status_code == 400
    assert result.json() == {"code": "INVALID_INGRESS", "message": message, "data": None}
