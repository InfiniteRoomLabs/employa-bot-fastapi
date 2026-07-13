import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.errors import register_error_handlers
from app.api.main import api_router
from app.core.config import settings


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

# CORS narrowed to what the SPA actually uses; credentials OFF while auth is
# bearer-only (plan v3 Auth; values pinned in sprint-01-spec PIN-7).
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

# CSP header on every API response (exact value: sprint-01-spec PIN-7). The
# SPA additionally ships a meta-tag CSP in frontend/index.html. The Swagger
# /docs pages are exempt -- they load their assets from a CDN and would break.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; font-src 'self'; "
    "connect-src 'self' http://localhost:8000; frame-ancestors 'none'; "
    "base-uri 'self'; form-action 'self'"
)
_CSP_EXEMPT_PREFIXES = ("/docs", "/redoc")


@app.middleware("http")
async def add_csp_header(request: Request, call_next) -> Response:  # type: ignore[no-untyped-def]
    response: Response = await call_next(request)
    if not request.url.path.startswith(_CSP_EXEMPT_PREFIXES):
        response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    return response


app.include_router(api_router, prefix=settings.API_V1_STR)

# Mock-API error-envelope handlers (in-memory MVP backend). The mock-API
# router itself is wired in app.api.main; this registers the {kind, path,
# message} exception handlers app-wide.
register_error_handlers(app)
