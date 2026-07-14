"""Migration-gate fixtures, shared by every migration-test module.

``scratch_engine`` builds one empty scratch database per test SESSION,
upgrades it to head with the REAL ``alembic upgrade head`` command in a
subprocess (fresh process so Settings re-reads ``POSTGRES_DB``), and drops
it afterwards. Assertions are on database state and errors, not code shape.
The parent ``tests/conftest.py`` has no autouse fixtures; DB worlds are
always pulled explicitly.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
SCRATCH_DB = "employa_migration_test"


def alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))
    return cfg


def server_url(database: str) -> str:
    return (
        f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{database}"
    )


@pytest.fixture(scope="session")
def scratch_engine() -> Generator[Engine]:
    """Empty scratch database upgraded to head by the real alembic command."""
    admin = create_engine(
        server_url(settings.POSTGRES_DB or settings.POSTGRES_USER),
        isolation_level="AUTOCOMMIT",
    )
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {SCRATCH_DB} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {SCRATCH_DB}"))

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env={**os.environ, "POSTGRES_DB": SCRATCH_DB},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"empty-upgrade failed:\n{result.stdout}\n{result.stderr}"
    )

    engine = create_engine(server_url(SCRATCH_DB))
    yield engine
    engine.dispose()
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {SCRATCH_DB} WITH (FORCE)"))
    admin.dispose()
