"""P7 auth-convention tests (AC-08; values pinned in sprint-01-spec PIN-7).

Throttle (before password verification, uniform message), JWT claim set +
session-version invalidation, 60-minute lifetime, fail-closed SECRET_KEY
outside local, narrowed CORS without credentials, and the CSP header.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import jwt
import pytest
from fastapi.testclient import TestClient
from httpx import Response
from pydantic import ValidationError
from sqlmodel import Session

from app.core import security
from app.core.config import Settings, settings
from app.core.security import get_password_hash
from app.main import CONTENT_SECURITY_POLICY
from app.models import User
from tests.utils.utils import random_email

LOGIN = f"{settings.API_V1_STR}/login/access-token"


def _attempt(
    client: TestClient, email: str, password: str = "wrong-password"
) -> Response:
    response: Response = client.post(
        LOGIN, data={"username": email, "password": password}
    )
    return response


def _make_user(db: Session, password: str = "correct-horse-battery") -> User:
    user = User(email=random_email(), hashed_password=get_password_hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Throttle
# ---------------------------------------------------------------------------


def test_account_throttle_429s_after_5_per_minute(client: TestClient) -> None:
    email = random_email()
    for _ in range(settings.LOGIN_THROTTLE_ACCOUNT_PER_MINUTE):
        assert _attempt(client, email).status_code == 400
    r = _attempt(client, email)
    assert r.status_code == 429
    assert r.json() == {
        "kind": "rate_limited",
        "path": "/api/v1/login/access-token",
        "message": "Too many login attempts; try again shortly",
    }


def test_throttle_fires_before_password_verification(
    client: TestClient, db: Session
) -> None:
    """A CORRECT password on the 6th attempt still 429s: the throttle is
    checked before credentials are ever evaluated."""
    password = "correct-horse-battery"
    user = _make_user(db, password)
    for _ in range(settings.LOGIN_THROTTLE_ACCOUNT_PER_MINUTE):
        _attempt(client, user.email)
    r = _attempt(client, user.email, password)
    assert r.status_code == 429


def test_ip_throttle_429s_after_10_per_minute(client: TestClient) -> None:
    for i in range(settings.LOGIN_THROTTLE_IP_PER_MINUTE):
        assert _attempt(client, random_email()).status_code == 400, i
    r = _attempt(client, random_email())
    assert r.status_code == 429


def test_login_message_uniform_for_unknown_and_inactive(
    client: TestClient, db: Session
) -> None:
    inactive = User(
        email=random_email(),
        hashed_password=get_password_hash("some-password-1"),
        is_active=False,
    )
    db.add(inactive)
    db.commit()

    unknown = _attempt(client, random_email())
    wrong_pw = _attempt(client, _make_user(db).email)
    inactive_r = _attempt(client, inactive.email, "some-password-1")
    assert unknown.status_code == wrong_pw.status_code == inactive_r.status_code == 400
    # 400 is not a contract status, so the template's {"detail": ...} shape
    # passes through; what matters here is ONE message, no enumeration.
    assert (
        unknown.json()["detail"]
        == wrong_pw.json()["detail"]
        == inactive_r.json()["detail"]
        == "Incorrect email or password"
    )


# ---------------------------------------------------------------------------
# JWT claims + session version
# ---------------------------------------------------------------------------


def test_token_carries_the_full_claim_set() -> None:
    token = security.create_access_token(
        "some-subject", expires_delta=timedelta(minutes=5), session_version=3
    )
    claims = security.decode_access_token(token)
    assert claims["iss"] == security.TOKEN_ISSUER
    assert claims["aud"] == security.TOKEN_AUDIENCE
    assert claims["sub"] == "some-subject"
    assert claims["sv"] == 3
    assert {"exp", "iat", "nbf", "jti"} <= set(claims)


def test_wrong_audience_or_issuer_is_401(client: TestClient, db: Session) -> None:
    user = _make_user(db)
    for claim_override in ({"aud": "someone-else"}, {"iss": "someone-else"}):
        good = security.create_access_token(user.id, expires_delta=timedelta(minutes=5))
        claims = jwt.decode(good, options={"verify_signature": False})
        forged = jwt.encode(
            {**claims, **claim_override}, settings.SECRET_KEY, algorithm="HS256"
        )
        r = client.get(
            f"{settings.API_V1_STR}/users/me",
            headers={"Authorization": f"Bearer {forged}"},
        )
        assert r.status_code == 401, claim_override


def test_session_version_bump_invalidates_outstanding_tokens(
    client: TestClient, db: Session
) -> None:
    user = _make_user(db)
    token = security.create_access_token(
        user.id, expires_delta=timedelta(minutes=5), session_version=0
    )
    headers = {"Authorization": f"Bearer {token}"}
    me = f"{settings.API_V1_STR}/users/me"
    assert client.get(me, headers=headers).status_code == 200

    user.session_version = 1
    db.add(user)
    db.commit()

    assert client.get(me, headers=headers).status_code == 401


# ---------------------------------------------------------------------------
# Lifetime, fail-closed secret, CORS, CSP
# ---------------------------------------------------------------------------


def test_access_token_lifetime_is_60_minutes() -> None:
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 60


def _settings_with(**overrides: object) -> Settings:
    kwargs: dict[str, Any] = {
        "_env_file": None,
        "PROJECT_NAME": "probe",
        "POSTGRES_SERVER": "localhost",
        "POSTGRES_USER": "probe",
        "POSTGRES_PASSWORD": "probe-not-default",
        "FIRST_SUPERUSER": "probe@example.com",
        "FIRST_SUPERUSER_PASSWORD": "probe-not-default",
        **overrides,
    }
    return Settings(**kwargs)


def test_secret_key_fails_closed_outside_local() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        _settings_with(ENVIRONMENT="staging", SECRET_KEY="")
    # Local generates a throwaway; staging with an explicit key is fine.
    assert _settings_with(ENVIRONMENT="local", SECRET_KEY="").SECRET_KEY
    assert (
        _settings_with(
            ENVIRONMENT="staging", SECRET_KEY="explicit-strong-key-000000000000"
        ).SECRET_KEY
        == "explicit-strong-key-000000000000"
    )


def test_cors_preflight_narrowed_and_credential_free(client: TestClient) -> None:
    r = client.options(
        f"{settings.API_V1_STR}/users/me",
        headers={
            "Origin": settings.FRONTEND_HOST,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert r.status_code == 200
    assert "access-control-allow-credentials" not in r.headers
    allowed_methods = r.headers["access-control-allow-methods"]
    assert "*" not in allowed_methods
    assert "GET" in allowed_methods


def test_csp_header_on_api_responses_but_not_docs(client: TestClient) -> None:
    api = client.get(f"{settings.API_V1_STR}/utils/health-check/")
    assert api.headers["Content-Security-Policy"] == CONTENT_SECURITY_POLICY
    docs = client.get("/docs")
    assert "Content-Security-Policy" not in docs.headers
