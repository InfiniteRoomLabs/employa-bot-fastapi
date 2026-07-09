"""Contract test fixtures -- NO database required.

The parent ``tests/conftest.py`` defines a session-scoped, ``autouse=True``
``db`` fixture that opens a real DB session and runs ``init_db``. Contract
tests must run without the database (in-memory store only), so this conftest
OVERRIDES the ``db`` fixture with an autouse no-op. A fixture defined in a
closer conftest shadows the parent's for tests in this directory, so the
parent's DB-touching version never runs here.

It also resets the in-memory store before every test so tests are isolated
and order-independent, and provides an unauthenticated ``TestClient`` (mock-API
routes carry no auth dependencies, matching the mock api.ts).
"""

from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from app import store
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[None]:
    """Neutralize the parent autouse ``db`` fixture -- no database here."""
    yield


@pytest.fixture(autouse=True)
def _reset_store() -> Generator[None]:
    """Restore pristine fixture state before each contract test."""
    store.reset()
    yield


@pytest.fixture
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c
