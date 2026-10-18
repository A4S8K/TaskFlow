import ipaddress
import json
import re
from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


def _origin(value: str) -> str:
    """Accept an origin, never a credential-bearing URL, path, query or wildcard."""
    try:
        parsed = urlsplit(value)
        port = parsed.port
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
            or "*" in value
            or any(char.isspace() for char in value)
        ):
            raise ValueError()
        host = parsed.hostname.lower()
        if ":" in host:
            host = f"[{host}]"
        return f"{parsed.scheme}://{host}" + (f":{port}" if port is not None else "")
    except (ValueError, TypeError):
        raise ValueError("Use an explicit http(s) origin without credentials, paths or wildcards") from None


def _local_host(host: str) -> bool:
    host = host.lower().rstrip(".")
    if host == "localhost" or host.endswith(".localhost") or host == "testserver":
        return True
    try:
        return not ipaddress.ip_address(host).is_global
    except ValueError:
        return False


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", populate_by_name=True, hide_input_in_errors=True
    )

    app_env: Literal["development", "test", "production"] = "development"
    debug: bool = False
    database_url: str = Field(
        default="postgresql+psycopg://taskflow@localhost:5432/taskflow", repr=False, exclude=True
    )
    jwt_secret_key: SecretStr = Field(
        validation_alias=AliasChoices("JWT_SECRET_KEY", "JWT_SECRET", "jwt_secret"),
        repr=False,
        exclude=True,
    )
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_issuer: str = Field(default="taskflow-api", min_length=1, max_length=100)
    jwt_audience: str = Field(default="taskflow-web", min_length=1, max_length=100)
    access_token_minutes: int = Field(
        default=30,
        ge=1,
        le=120,
        validation_alias=AliasChoices("ACCESS_TOKEN_EXPIRE_MINUTES", "ACCESS_TOKEN_MINUTES"),
    )
    frontend_url: str | None = None
    backend_url: str | None = None
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    trusted_hosts: Annotated[list[str], NoDecode] = ["localhost", "127.0.0.1", "[::1]", "testserver"]
    trusted_proxy_ips: str = "127.0.0.1"
    ingress_mode: Literal["explicit-proxy", "render-free"] = "explicit-proxy"
    render_free_ingress_ack: bool = False
    render: str | None = None
    render_service_id: str | None = None
    render_service_type: str | None = None
    render_external_hostname: str | None = None
    render_cpu_count: str | None = None
    web_concurrency: int = Field(default=1, ge=1, le=32)
    auth_login_limit: int = Field(default=10, ge=1, le=100)
    auth_register_limit: int = Field(default=5, ge=1, le=100)
    auth_rate_window_seconds: int = Field(default=60, ge=1, le=3600)
    auth_rate_max_keys: int = Field(default=10000, ge=1, le=100000)
    auth_max_concurrent: int = Field(default=2, ge=1, le=4)
    db_pool_mode: Literal["direct", "session"] = "session"
    db_pool_size: int = Field(default=5, ge=1, le=20)
    db_max_overflow: int = Field(default=5, ge=0, le=20)
    db_pool_timeout_seconds: int = Field(default=10, ge=1, le=60)
    db_pool_recycle_seconds: int = Field(default=1800, ge=60, le=86400)
    db_connect_timeout_seconds: int = Field(default=10, ge=1, le=60)
    db_statement_timeout_ms: int = Field(default=15000, ge=1000, le=120000)
    db_lock_timeout_ms: int = Field(default=5000, ge=100, le=60000)

    @property
    def jwt_secret(self) -> str:
        # Compatibility for the original JWT_SECRET field and callers.
        return self.jwt_secret_key.get_secret_value()

    @field_validator("jwt_secret_key")
    @classmethod
    def secret_length(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT secret must contain at least 32 characters")
        return value

    @field_validator("database_url")
    @classmethod
    def database_driver(cls, value: str) -> str:
        try:
            parsed = make_url(value)
            if parsed.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
                raise ValueError()
            if not parsed.host or not parsed.database or not parsed.username:
                raise ValueError()
            return parsed.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
        except (ArgumentError, TypeError, ValueError):
            raise ValueError("DATABASE_URL must be a valid PostgreSQL connection URL") from None

    @field_validator("cors_origins", "trusted_hosts", mode="before")
    @classmethod
    def parse_list(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value) if value.strip().startswith("[") else value.split(",")
            except ValueError:
                raise ValueError("Use a JSON array or comma-separated list") from None
        return value

    @field_validator("cors_origins")
    @classmethod
    def valid_origins(cls, values: list[str]) -> list[str]:
        if not values:
            raise ValueError("CORS_ORIGINS must contain at least one explicit origin")
        return list(dict.fromkeys(_origin(value.strip()) for value in values))

    @field_validator("frontend_url", "backend_url")
    @classmethod
    def valid_public_url(cls, value: str | None) -> str | None:
        return _origin(value.strip()) if value is not None else None

    @field_validator("trusted_hosts")
    @classmethod
    def valid_hosts(cls, values: list[str]) -> list[str]:
        result = []
        for value in values:
            value = value.strip().lower()
            if not value or any(char in value for char in ("*", "/", "@", "?", "#")):
                raise ValueError("TRUSTED_HOSTS must contain exact hostnames without ports or wildcards")
            if any(char.isspace() for char in value) or (":" in value and value != "[::1]"):
                raise ValueError("TRUSTED_HOSTS must contain exact hostnames without ports or wildcards")
            result.append(value)
        if not result:
            raise ValueError("TRUSTED_HOSTS must not be empty")
        return list(dict.fromkeys(result))

    @field_validator("trusted_proxy_ips")
    @classmethod
    def valid_proxies(cls, value: str) -> str:
        proxies = [item.strip() for item in value.split(",")]
        try:
            for proxy in proxies:
                network = ipaddress.ip_network(proxy, strict=False)
                if network.prefixlen == 0:
                    raise ValueError()
        except ValueError:
            raise ValueError(
                "TRUSTED_PROXY_IPS must be explicit IP addresses or CIDRs; wildcard trust is forbidden"
            ) from None
        return ",".join(proxies)

    @model_validator(mode="after")
    def production_requirements(self):
        # Only Free public web services cannot receive private-network traffic.
        # Plan changes require a new ingress review; these platform markers and
        # the explicit operator acknowledgment guard against accidental reuse.
        # https://render.com/docs/free
        # https://render.com/docs/environment-variables
        if self.ingress_mode == "render-free" and (
            self.app_env != "production"
            or not self.render_free_ingress_ack
            or self.render != "true"
            or self.render_service_type != "web"
            or self.render_cpu_count != "0.1"
            or not re.fullmatch(r"srv-[a-z0-9]+", self.render_service_id or "")
            or not self.render_external_hostname
            or not self.render_external_hostname.endswith(".onrender.com")
            or urlsplit(self.backend_url or "").hostname != self.render_external_hostname
        ):
            raise ValueError(
                "render-free ingress requires production, explicit Free-plan acknowledgment, "
                "Render Free web-service platform markers and the matching onrender.com backend URL"
            )
        if self.app_env != "production":
            return self
        required = {
            "database_url",
            "jwt_secret_key",
            "frontend_url",
            "backend_url",
            "cors_origins",
            "trusted_hosts",
        }
        if self.ingress_mode == "explicit-proxy":
            required.add("trusted_proxy_ips")
        missing = required - self.model_fields_set
        if missing:
            raise ValueError("Production requires explicit settings: " + ", ".join(sorted(missing)))
        if self.debug:
            raise ValueError("DEBUG must be false in production")
        if self.web_concurrency != 1:
            raise ValueError("WEB_CONCURRENCY must be 1 with the process-local authentication limiter")
        secret = self.jwt_secret.lower()
        if any(
            marker in secret
            for marker in ("replace", "change_me", "changeme", "your_secret", "example", "ci-only")
        ):
            raise ValueError("Production JWT secret must be a generated random value, not a template")
        if len(set(self.jwt_secret)) < 10:
            raise ValueError("Production JWT secret must be a generated random value")
        for value in [self.frontend_url, self.backend_url, *self.cors_origins]:
            if not value or urlsplit(value).scheme != "https" or _local_host(urlsplit(value).hostname or ""):
                raise ValueError("Production public URLs and CORS origins must use HTTPS and public hosts")
        if self.frontend_url not in self.cors_origins:
            raise ValueError("CORS_ORIGINS must include FRONTEND_URL")
        if urlsplit(self.backend_url).hostname not in self.trusted_hosts:
            raise ValueError("TRUSTED_HOSTS must include the BACKEND_URL hostname")
        database = make_url(self.database_url)
        if database.query.get("sslmode") != "verify-full" or not database.query.get("sslrootcert"):
            raise ValueError("Production DATABASE_URL requires sslmode=verify-full and sslrootcert")
        if not database.password:
            raise ValueError("Production DATABASE_URL requires database credentials")
        if database.port == 6543:
            raise ValueError(
                "Transaction pooling on port 6543 is not supported; select direct or session mode"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
