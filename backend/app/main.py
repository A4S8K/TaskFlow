import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.i18n.translator import LOCALES, response
from app.routers import auth, dashboard, members, projects, tasks, users

app = FastAPI(
    title="TaskFlow API", version="1.0.0", description="Collaborative multilingual project management"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept-Language"],
)
for router in (auth.router, users.router, projects.router, members.router, tasks.router, dashboard.router):
    app.include_router(router, prefix="/api/v1")


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    code = exc.detail if isinstance(exc.detail, str) and exc.detail in LOCALES["en"] else "NOT_FOUND"
    return JSONResponse(
        jsonable_encoder(response(request, code)), status_code=exc.status_code, headers=exc.headers
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Include field locations and stable types only; never echo passwords or raw inputs.
    body = response(request, "VALIDATION_ERROR")
    body["errors"] = [{"loc": list(error["loc"]), "type": error["type"]} for error in exc.errors()]
    return JSONResponse(body, status_code=422)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, exc: IntegrityError):
    return JSONResponse(response(request, "CONFLICT"), status_code=409)


@app.exception_handler(Exception)
async def internal_error(request: Request, exc: Exception):
    logging.getLogger("taskflow").exception("Unhandled API error")
    return JSONResponse(response(request, "INTERNAL_ERROR"), status_code=500)


@app.get("/api/v1/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/openapi/{lang}.json", include_in_schema=False)
def localized_schema(lang: str):
    if lang not in LOCALES:
        raise HTTPException(404, "NOT_FOUND")
    locale = LOCALES[lang]
    schema = get_openapi(
        title=locale["DOC_TITLE"], version="1.0.0", description=locale["DOC_DESCRIPTION"], routes=app.routes
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


@app.get("/docs/{lang}", include_in_schema=False)
def localized_docs(lang: str):
    if lang not in LOCALES:
        raise HTTPException(404, "NOT_FOUND")
    return get_swagger_ui_html(openapi_url=f"/openapi/{lang}.json", title=LOCALES[lang]["DOC_TITLE"])
