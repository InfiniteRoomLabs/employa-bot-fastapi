from collections.abc import Generator
from contextlib import suppress
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlalchemy import text
from sqlmodel import Session

from app.api.errors import UnauthorizedError
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import TokenPayload, User

# auto_error=False: a missing token must flow through the SAME normalized
# 401 path as an invalid one, not FastAPI's bare {"detail": "Not
# authenticated"} short-circuit.
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False
)


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str | None, Depends(reusable_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    """Resolve the bearer token to an active user, or 401.

    Missing, malformed, invalid-signature, expired, unknown-user, and
    inactive-user all exit through the ONE raise below -- byte-identical
    envelopes, no enumeration (plan v3, Auth). The 401 wears the contract
    error envelope via the app-wide ApiError handler. Note the missing-token
    path never touches the database, which keeps the contract-suite sweep
    DB-free.
    """
    user: User | None = None
    token_data = TokenPayload()
    if token:
        try:
            payload = security.decode_access_token(token)
            token_data = TokenPayload(**payload)
        except InvalidTokenError, ValidationError:
            user = None
        else:
            user = session.get(User, token_data.sub)
    if user is None or not user.is_active or user.session_version != token_data.sv:
        raise UnauthorizedError("Could not validate credentials")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_tenant_session(
    session: SessionDep, current_user: CurrentUser
) -> Generator[Session]:
    """Tenant-scoped DB session (plan v3 Tenancy; sprint-02 spec PIN-7).

    Switches the request transaction onto the ``app_runtime`` role and sets
    the transaction-local ``app.user_id`` GUC that row-level-security
    policies key on. RLS is the systemic backstop; routes keep their
    explicit ``user_id`` predicates as the first line.

    ``SET LOCAL`` is transaction-scoped: a commit ends it, so tenant routes
    commit once, at the end, and never run tenant queries after. The
    ``RESET ROLE`` in teardown exists for the test world, where the request
    shares one outer transaction with the test session (savepoint mode) and
    the role switch would otherwise leak past the request; the ``suppress``
    covers teardown on an already-aborted transaction.
    """
    connection = session.connection()
    connection.execute(text("SET LOCAL ROLE app_runtime"))
    connection.execute(
        text("SELECT set_config('app.user_id', :uid, true)"),
        {"uid": str(current_user.id)},
    )
    try:
        yield session
    finally:
        with suppress(Exception):
            session.connection().execute(text("RESET ROLE"))


TenantSession = Annotated[Session, Depends(get_tenant_session)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
