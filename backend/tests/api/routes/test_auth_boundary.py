"""Auth boundary tests (AC-04, AC-05; spec PIN-4/PIN-5, Codex D1-4/D1-5).

Uniformity: invalid-signature, EXPIRED, unknown-user, and inactive-user
tokens must produce BYTE-identical 401 envelope bodies through the one
normalized code path. Fidelity: getCurrentUser is served from the DATABASE
through the real dependency chain -- the fidelity test uses a plain
``TestClient(app)`` with zero dependency overrides and a real committed row.
"""

from __future__ import annotations

import inspect
from collections.abc import Generator
from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.main import app
from app.models import User
from tests.utils.utils import random_email

FIDELITY_EMAIL = "fidelity-probe@example.com"


def _bad_signature_token(user_id: str) -> str:
    good = security.create_access_token(user_id, expires_delta=timedelta(minutes=5))
    payload = jwt.decode(good, options={"verify_signature": False})
    return jwt.encode(payload, "wrong-secret-key-000000000000000000", algorithm="HS256")


def test_401_envelope_uniform_across_all_failure_modes(
    client: TestClient, db: Session
) -> None:
    inactive = User(
        email=random_email(),
        hashed_password=security.get_password_hash("irrelevant-x"),
        is_active=False,
    )
    db.add(inactive)
    db.commit()
    db.refresh(inactive)

    expires = timedelta(minutes=5)
    tokens = {
        "invalid-signature": _bad_signature_token(str(inactive.id)),
        "expired": security.create_access_token(
            inactive.id, expires_delta=timedelta(minutes=-5)
        ),
        "unknown-user": security.create_access_token(
            "00000000-0000-4000-8000-0000000000ff", expires_delta=expires
        ),
        "inactive-user": security.create_access_token(
            inactive.id, expires_delta=expires
        ),
        "malformed": "not-a-jwt-at-all",
    }

    bodies = {}
    for label, token in tokens.items():
        r = client.get(
            f"{settings.API_V1_STR}/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 401, f"{label}: got {r.status_code}"
        bodies[label] = r.content

    distinct = set(bodies.values())
    assert len(distinct) == 1, f"401 bodies differ across failure modes: {bodies}"
    assert bodies["expired"] == (
        b'{"kind":"unauthorized","path":"/api/v1/users/me",'
        b'"message":"Could not validate credentials"}'
    )


def test_single_raise_site_in_deps() -> None:
    """Structural half of PIN-3: exactly one place emits the credential 401."""
    source = inspect.getsource(deps)
    assert source.count("raise UnauthorizedError") == 1


@pytest.fixture()
def fidelity_user() -> Generator[User]:
    """A real committed row (bootstrap-tier -- no overrides, explicit cleanup)."""

    def _cleanup() -> None:
        with Session(engine) as session:
            session.execute(
                delete(User).where(User.email == FIDELITY_EMAIL)  # type: ignore[arg-type]
            )
            session.commit()

    _cleanup()
    with Session(engine) as session:
        user = User(
            email=FIDELITY_EMAIL,
            hashed_password=security.get_password_hash("irrelevant-y"),
            full_name="Fidelity Probe",
            initials="FP",
            city="Lexington, KY",
            current="Probe Engineer",
            years=7,
            comp_floor=123456,
            target_titles=["Probe Lead"],
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)
    yield user
    _cleanup()


def test_get_current_user_contract_fidelity_no_overrides(
    fidelity_user: User,
) -> None:
    """AC-05: /user serves THIS database row through the real chain."""
    assert not app.dependency_overrides, "fidelity test forbids overrides (PIN-4)"
    token = security.create_access_token(
        fidelity_user.id, expires_delta=timedelta(minutes=5)
    )
    with TestClient(app) as raw_client:
        r = raw_client.get(
            f"{settings.API_V1_STR}/user",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200
    assert r.json() == {
        "name": "Fidelity Probe",
        "email": FIDELITY_EMAIL,
        "initials": "FP",
        "city": "Lexington, KY",
        "current": "Probe Engineer",
        "years": 7.0,
        "comp_floor": 123456.0,
        "target_titles": ["Probe Lead"],
    }
