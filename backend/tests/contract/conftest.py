"""Contract test fixtures -- NO database required.

Since P5 every mock route carries the ``get_current_user`` dependency, so the
store-backed client authenticates via an EXPLICIT dependency override:
``store_client`` swaps ``get_current_user`` for a stub user carrying the REMY
persona (the same values the store seeds). The override is visible here and
requested per-test -- not autouse magic; auth behavior itself is covered by
the REAL dependency in ``test_auth_sweep.py`` (DB-free: the missing-token
path never touches the database) and ``tests/api/routes/test_auth_boundary``.

Each client fixture resets the store in its body, so tests stay isolated and
order-independent without any autouse fixture.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app import store
from app.api import deps
from app.main import app
from app.models import User as DbUser

# Wire-compatible stub resolved by the overridden auth dependency; profile
# values mirror store._seed_current_user (REMY) so getCurrentUser contract
# assertions hold without a database.
STUB_USER = DbUser(
    id=uuid.UUID("00000000-0000-4000-8000-000000000001"),
    email="wes.gilleland@gmail.com",
    hashed_password="not-a-real-hash",
    is_active=True,
    is_superuser=False,
    full_name="Wes Gilleland",
    initials="WG",
    city="Lexington, KY",
    current="Founder & Principal Engineer - Infinite Room Labs",
    years=12,
    comp_floor=210000,
    target_titles=[
        "Staff Engineer",
        "Senior Staff Engineer",
        "Principal Engineer",
        "Platform Lead",
    ],
)


class NullTenantSession:
    """Absorbs the DB side of dual-write mock ops in the DB-free world.

    Since sprint-02, createApplication persists its minted job through
    ``deps.get_tenant_session`` (PIN-1). Contract tests judge the WIRE
    behavior against the store; the DB side is covered in
    ``tests/api/routes/test_jobs.py``. This stub accepts the two calls the
    dual-write makes and nothing else -- an unexpected DB call fails loudly
    instead of silently opening a real connection.
    """

    def add(self, instance: object) -> None:
        pass

    def commit(self) -> None:
        pass


@pytest.fixture
def store_client() -> Generator[TestClient]:
    """Authenticated client for the store-backed mock API (auth stubbed).

    Resets the in-memory store so tests stay isolated and order-independent
    (in the fixture body, not autouse -- panel finding SIM-1).
    """
    store.reset()
    app.dependency_overrides[deps.get_current_user] = lambda: STUB_USER
    app.dependency_overrides[deps.get_tenant_session] = NullTenantSession
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(deps.get_current_user, None)
        app.dependency_overrides.pop(deps.get_tenant_session, None)


@pytest.fixture
def unauthenticated_client() -> Generator[TestClient]:
    """Raw client with NO overrides -- the real auth dependency runs."""
    store.reset()
    with TestClient(app) as c:
        yield c
