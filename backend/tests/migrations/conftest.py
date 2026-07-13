"""Migration-gate fixtures.

The parent ``tests/conftest.py`` opens a session against the app database and
runs ``init_db``. Migration tests manage their own scratch database (created
empty, upgraded to head, dropped), so the parent autouse ``db`` fixture is
neutralized here -- same pattern as ``tests/contract/conftest.py``.
"""

from __future__ import annotations

from collections.abc import Generator

import pytest


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[None]:
    """Neutralize the parent autouse ``db`` fixture."""
    yield
