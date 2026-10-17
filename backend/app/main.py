import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import DisconnectionError, IntegrityError, InterfaceError, OperationalError, TimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import Settings, get_settings
from app.core.middleware import (
    AuthRateLimiter,
    AuthRateLimitMiddleware,
    HealthAwareHTTPSRedirectMiddleware,
    SafeErrorBoundary,
    SecurityHeadersMiddleware,
)
from app.dependencies import DB
from app.i18n.translator import LOCALES, response
from app.routers import auth, dashboard, members, projects, tasks, users


class TaskFlow(FastAPI):
    def build_middleware_stack(self):
        # CORS must also wrap ServerErrorMiddleware, as required by Starlette's
        # global-enforcement guidance, while retaining FastAPI dependency overrides.
        stack = SafeErrorBoundary(super().build_middleware_stack())
        stack = CORSMiddleware(
            stack,
            allow_origins=self.state.settings.cors_origins,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "Accept-Language"],
            expose_headers=["Retry-After"],
            allow_credentials=False,
        )
        return SecurityHeadersMiddleware(stack, production=self.state.settings.app_env == "production")


async def http_error(request: Request, exc: StarletteHTTPException):
    code = exc.detail if isinstance(exc.detail, str) and exc.detail in LOCALES["en"] else "NOT_FOUND"
    return JSONResponse(
        jsonable_encoder(response(request, code)), status_code=exc.status_code, headers=exc.headers
    )


async def validation_error(request: Request, exc: RequestValidationError):
    # Include field locations and stable types only; never echo passwords or raw inputs.
    body = response(request, "VALIDATION_ERROR")
    body["errors"] = [{"loc": list(error["loc"]), "type": error["type"]} for error in exc.errors()]
    return JSONResponse(body, status_code=422)


async def integrity_error(request: Request, exc: IntegrityError):
    return JSONResponse(response(request, "CONFLICT"), status_code=409)


async def internal_error(request: Request, exc: Exception):
    return JSONResponse(response(request, "INTERNAL_ERROR"), status_code=500)


async def database_error(request: Request, exc: Exception):
    logging.getLogger("taskflow").warning("database_unavailable")
    return JSONResponse(
        response(request, "SERVICE_UNAVAILABLE"), status_code=503, headers={"Retry-After": "5"}
    )


def health():
    return {"status": "ok", "service": "taskflow-api"}


def ready(db: DB):
    db.execute(text("SELECT 1"))
    return {"status": "ready", "service": "taskflow-api"}


def localized_schema(lang: str, request: Request):
    if lang not in LOCALES:
        raise HTTPException(404, "NOT_FOUND")
    locale = LOCALES[lang]
    schema = get_openapi(
        title=locale["DOC_TITLE"],
        version="1.0.0",
        description=locale["DOC_DESCRIPTION"],
        routes=request.app.routes,
    )
    verbs = locale["DOC_VERBS"]
    nouns = locale["DOC_NOUNS"]
    for path, methods in schema["paths"].items():
        noun = next(
            (
                nouns[key]
                for key in ("auth", "members", "tasks", "projects", "users", "dashboard", "health")
                if key in path
            ),
            nouns["projects"],
        )
        for method, operation in methods.items():
            if method in verbs:
                operation["summary"] = f"{verbs[method]}: {noun}"
                operation["description"] = locale["DOC_OPERATION"].format(resource=noun)
    for definition in schema.get("components", {}).get("schemas", {}).values():
        for field, value in definition.get("properties", {}).items():
            value["description"] = locale["DOC_FIELDS"].get(field, locale["DOC_FIELD"])
    return schema


def localized_docs(lang: str):
    if lang not in LOCALES:
        raise HTTPException(404, "NOT_FOUND")
    return get_swagger_ui_html(openapi_url=f"/openapi/{lang}.json", title=LOCALES[lang]["DOC_TITLE"])


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    application = TaskFlow(
        title="TaskFlow API",
        version="1.0.0",
        description="Collaborative multilingual project management",
        debug=settings.debug,
    )
    application.state.settings = settings
    application.state.auth_limiter = AuthRateLimiter(settings)
    application.add_middleware(AuthRateLimitMiddleware, limiter=application.state.auth_limiter)
    if settings.app_env == "production":
        application.add_middleware(HealthAwareHTTPSRedirectMiddleware)
    application.add_middleware(
        TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts, www_redirect=False
    )
    for router in (
        auth.router,
        users.router,
        projects.router,
        members.router,
        tasks.router,
        dashboard.router,
    ):
        application.include_router(router, prefix="/api/v1")
    application.add_exception_handler(StarletteHTTPException, http_error)
    application.add_exception_handler(RequestValidationError, validation_error)
    application.add_exception_handler(IntegrityError, integrity_error)
    for error_type in (OperationalError, InterfaceError, TimeoutError, DisconnectionError):
        application.add_exception_handler(error_type, database_error)
    application.add_exception_handler(Exception, internal_error)
    application.add_api_route("/health", health, tags=["Health"])
    application.add_api_route("/api/v1/health", health, tags=["Health"], include_in_schema=False)
    application.add_api_route("/ready", ready, tags=["Health"])
    application.add_api_route("/openapi/{lang}.json", localized_schema, include_in_schema=False)
    application.add_api_route("/docs/{lang}", localized_docs, include_in_schema=False)
    return application


app = create_app()
