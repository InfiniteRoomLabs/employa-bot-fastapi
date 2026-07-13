from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
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


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user
