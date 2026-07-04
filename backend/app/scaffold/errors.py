"""Typed domain errors and the contract Error-envelope handlers.

Every error the scaffold surfaces to a client is one of the ``ScaffoldError``
subclasses below. Each carries a wire ``kind`` (from the frozen ``Error`` schema
in ``mvp-api.yaml``); the ``kind -> HTTP status`` mapping is the one enumerated
in that file's ``info.description`` and is the single source of truth here.

Handlers registered by :func:`register_scaffold` translate:

* ``ScaffoldError``            -> the ``{kind, path, message}`` envelope
* ``RequestValidationError``   -> 422 ``validation_error`` envelope
* ``StarletteHTTPException``   -> the envelope, kind inferred from status

so that framework-raised errors wear the same envelope as domain errors.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.scaffold.models import Error, Kind

# ---------------------------------------------------------------------------
# kind -> HTTP status (frozen mapping from mvp-api.yaml info.description)
# ---------------------------------------------------------------------------

KIND_TO_STATUS: dict[Kind, int] = {
    Kind.not_found: 404,
    Kind.unauthorized: 401,
    Kind.validation_error: 422,
    Kind.conflict: 409,
    Kind.cap_reached: 402,
    Kind.undo_window_expired: 409,
    Kind.invalid_transition: 422,
    Kind.rate_limited: 429,
    Kind.provider_unavailable: 503,
}

# Reverse map for framework HTTPExceptions. Where several kinds share a status
# (409, 422) we pick the generic member; specific kinds are only produced by
# domain code raising the matching ScaffoldError, never inferred from a status.
_STATUS_TO_KIND: dict[int, Kind] = {
    401: Kind.unauthorized,
    402: Kind.cap_reached,
    404: Kind.not_found,
    409: Kind.conflict,
    422: Kind.validation_error,
    429: Kind.rate_limited,
    503: Kind.provider_unavailable,
}


# ---------------------------------------------------------------------------
# Domain exception hierarchy
# ---------------------------------------------------------------------------


class ScaffoldError(Exception):
    """Base for all scaffold domain errors. Subclasses set ``kind``."""

    kind: Kind

    def __init__(self, message: str | None = None) -> None:
        self.message = message
        super().__init__(message or self.kind.value)

    @property
    def status_code(self) -> int:
        return KIND_TO_STATUS[self.kind]


class NotFoundError(ScaffoldError):
    kind = Kind.not_found


class UnauthorizedError(ScaffoldError):
    kind = Kind.unauthorized


class ValidationTaggedError(ScaffoldError):
    """Domain-level validation failure (distinct from framework 422s)."""

    kind = Kind.validation_error


class ConflictError(ScaffoldError):
    kind = Kind.conflict


class CapReachedError(ScaffoldError):
    kind = Kind.cap_reached


class UndoWindowExpiredError(ScaffoldError):
    kind = Kind.undo_window_expired


class InvalidTransitionError(ScaffoldError):
    kind = Kind.invalid_transition


class RateLimitedError(ScaffoldError):
    kind = Kind.rate_limited


class ProviderUnavailableError(ScaffoldError):
    kind = Kind.provider_unavailable


# ---------------------------------------------------------------------------
# Envelope construction + handlers
# ---------------------------------------------------------------------------


def _envelope(kind: Kind, request: Request, message: str | None) -> JSONResponse:
    body = Error(kind=kind, path=request.url.path, message=message)
    return JSONResponse(
        status_code=KIND_TO_STATUS[kind],
        content=body.model_dump(mode="json", exclude_none=True),
    )


async def _handle_scaffold_error(request: Request, exc: ScaffoldError) -> JSONResponse:
    return _envelope(exc.kind, request, exc.message)


async def _handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Summarize pydantic's error list into the envelope's single message field.
    message = "; ".join(
        f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
    )
    return _envelope(Kind.validation_error, request, message or "validation error")


async def _handle_http_exception(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    kind = _STATUS_TO_KIND.get(exc.status_code)
    if kind is None:
        # Non-contract status (e.g. 405): pass through Starlette's default shape.
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    message = exc.detail if isinstance(exc.detail, str) else None
    return _envelope(kind, request, message)


def register_scaffold(app: FastAPI) -> None:
    """Install the scaffold's Error-envelope exception handlers on ``app``.

    Call once from ``app.main`` after the ``FastAPI`` app is constructed. This
    only registers handlers -- the scaffold *router* is wired separately in
    ``app.api.main`` so it inherits the ``/api/v1`` prefix. Handlers are
    registered app-wide so that framework-raised errors (validation, 404) wear
    the same ``{kind, path, message}`` envelope scaffold routes produce.
    """
    app.add_exception_handler(ScaffoldError, _handle_scaffold_error)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _handle_validation_error)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)  # type: ignore[arg-type]
