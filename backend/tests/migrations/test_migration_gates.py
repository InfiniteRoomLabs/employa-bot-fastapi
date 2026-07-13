"""Migration gates (plan v3 Phase 0): head singularity, empty-upgrade, and the
append-only machinery exercised under the runtime role.

The empty-upgrade test builds a scratch database, runs the REAL ``alembic
upgrade head`` command against it in a subprocess (fresh process so Settings
re-reads ``POSTGRES_DB``), then proves the append-only machinery behaviorally:
``app_runtime`` (via ``SET ROLE``) can INSERT but is refused UPDATE / DELETE /
TRUNCATE by privilege, and the defense-in-depth trigger blocks even the table
owner. Assertions are on database state and errors, not code shape.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import DBAPIError

from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[2]
SCRATCH_DB = "employa_migration_test"


def _alembic_config() -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "app" / "alembic"))
    return cfg


def test_single_head() -> None:
    """Exactly one alembic head; multiple heads fail CI (v3 Migrations)."""
    heads = ScriptDirectory.from_config(_alembic_config()).get_heads()
    assert len(heads) == 1, f"expected a single alembic head, found {heads}"


def _server_url(database: str) -> str:
    return (
        f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{database}"
    )


@pytest.fixture(scope="module")
def scratch_engine() -> Generator[Engine]:
    """Empty scratch database upgraded to head by the real alembic command."""
    admin = create_engine(
        _server_url(settings.POSTGRES_DB or settings.POSTGRES_USER),
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

    engine = create_engine(_server_url(SCRATCH_DB))
    yield engine
    engine.dispose()
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {SCRATCH_DB} WITH (FORCE)"))
    admin.dispose()


def test_empty_upgrade_reaches_single_head(scratch_engine: Engine) -> None:
    with scratch_engine.connect() as conn:
        version = conn.execute(text("SELECT version_num FROM alembic_version")).all()
    heads = ScriptDirectory.from_config(_alembic_config()).get_heads()
    assert [row[0] for row in version] == heads


def test_runtime_role_exists_with_dml_but_no_alembic_version_access(
    scratch_engine: Engine,
) -> None:
    with scratch_engine.connect() as conn:
        assert conn.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime'")
        ).scalar()
        # DML on app tables works under the runtime role.
        conn.execute(text("SET LOCAL ROLE app_runtime"))
        conn.execute(
            text(
                'INSERT INTO "user" (id, email, is_active, is_superuser,'
                " hashed_password, target_titles, created_at)"
                " VALUES (gen_random_uuid(), 'role-probe@example.com', true, false,"
                " 'x', '{}', now())"
            )
        )
        with pytest.raises(DBAPIError, match="permission denied"):
            conn.execute(text("SELECT * FROM alembic_version"))
        conn.rollback()


@pytest.fixture()
def append_only_probe(scratch_engine: Engine) -> Generator[Engine]:
    """A probe table with the append-only machinery applied, dropped after."""
    with scratch_engine.begin() as conn:
        conn.execute(text("CREATE TABLE _ao_probe (id serial PRIMARY KEY, note text)"))
        conn.execute(
            text("GRANT SELECT, INSERT, UPDATE, DELETE ON _ao_probe TO app_runtime")
        )
        conn.execute(text("GRANT USAGE ON SEQUENCE _ao_probe_id_seq TO app_runtime"))
        conn.execute(text("SELECT enforce_append_only('_ao_probe')"))
        conn.execute(text("INSERT INTO _ao_probe (note) VALUES ('seed')"))
    yield scratch_engine
    with scratch_engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS _ao_probe"))


def test_append_only_insert_allowed_under_runtime_role(
    append_only_probe: Engine,
) -> None:
    with append_only_probe.begin() as conn:
        conn.execute(text("SET LOCAL ROLE app_runtime"))
        conn.execute(text("INSERT INTO _ao_probe (note) VALUES ('runtime insert')"))
        count = conn.execute(text("SELECT count(*) FROM _ao_probe")).scalar()
        assert count == 2


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE _ao_probe SET note = 'mutated' WHERE id = 1",
        "DELETE FROM _ao_probe WHERE id = 1",
        "TRUNCATE _ao_probe",
    ],
)
def test_append_only_mutations_refused_under_runtime_role(
    append_only_probe: Engine, statement: str
) -> None:
    """Primary protection: privilege REVOKE refuses the runtime role."""
    with append_only_probe.connect() as conn:
        conn.execute(text("SET LOCAL ROLE app_runtime"))
        with pytest.raises(DBAPIError, match="permission denied"):
            conn.execute(text(statement))
        conn.rollback()


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE _ao_probe SET note = 'mutated' WHERE id = 1",
        "DELETE FROM _ao_probe WHERE id = 1",
        "TRUNCATE _ao_probe",
    ],
)
def test_append_only_trigger_blocks_even_the_owner(
    append_only_probe: Engine, statement: str
) -> None:
    """Defense-in-depth: the trigger fires for roles privilege does not stop."""
    with append_only_probe.connect() as conn:
        with pytest.raises(DBAPIError, match="append-only"):
            conn.execute(text(statement))
        conn.rollback()


def test_downgrade_refused_forward_fix_only() -> None:
    """The new revision's downgrade raises (v3 forward-fix policy)."""
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "downgrade", "-1"],
        cwd=BACKEND_DIR,
        env={**os.environ, "POSTGRES_DB": SCRATCH_DB},
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "forward-fix only" in result.stderr


# Reused by CI's migration-gates job; keeps this module importable standalone.
if __name__ == "__main__":  # pragma: no cover
    sys.exit(pytest.main([__file__, "-q"]))
