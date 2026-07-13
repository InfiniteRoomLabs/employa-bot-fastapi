from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

password_hash = PasswordHash(
    (
        Argon2Hasher(),
        BcryptHasher(),
    )
)


ALGORITHM = "HS256"

# Bound into every token and enforced at decode (plan v3 Auth conventions).
TOKEN_ISSUER = "employa-bot"
TOKEN_AUDIENCE = "employa-bot-api"


def create_access_token(
    subject: str | Any, expires_delta: timedelta, session_version: int = 0
) -> str:
    now = datetime.now(UTC)
    to_encode = {
        "exp": now + expires_delta,
        "sub": str(subject),
        "iss": TOKEN_ISSUER,
        "aud": TOKEN_AUDIENCE,
        "iat": now,
        "nbf": now,
        "jti": str(uuid4()),
        "sv": session_version,
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode + validate signature, exp/nbf, issuer, and audience."""
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[ALGORITHM],
        audience=TOKEN_AUDIENCE,
        issuer=TOKEN_ISSUER,
        options={"require": ["exp", "sub", "iss", "aud", "iat", "nbf", "jti"]},
    )


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    return password_hash.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)
