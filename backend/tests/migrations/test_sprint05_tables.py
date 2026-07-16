"""Sprint-05 AI tables + budget functions (9c4d1a7e2b31) under the binding
conventions.

Mirrors test_sprint04_tables.py across the four new tables and adds the
sprint's NET-NEW mechanics (docs/sprints/sprint-05-spec.md): the reservation
cap's guarded UPDATE on the locked budget row incl. the two-connection race
(AC-05, PR-7 invalidate discipline), server-derived idempotency + open-run
adoption (AC-06), settlement conversion/release liveness (AC-06b), the
SECURITY DEFINER direct-call boundary (AC-02c, D1-9 round 2), append-only +
SELECT-only enforcement on ai_run/ai_run_event/match_report (AC-02), and the
extended user-teardown helper (AC-11, PIN-A14). Assertions are on DB state
under the runtime role, never code shape.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator
from decimal import Decimal
from typing import Any

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError, OperationalError

VALID_JOB_LOCATION = '{"raw": "Remote - US"}'
VALID_JOB_EMPLOYMENT = (
    '{"classification": "w2", "cadence": "salary", "commitment": "full-time"}'
)
VALID_JOB_SOURCE = (
    '{"board": "greenhouse", "channel": "url", "capturedAt": "2026-07-15T00:00:00Z"}'
)

TABLES = ("user_ai_budget", "ai_run", "ai_run_event", "match_report")
APPEND_ONLY = ("ai_run", "ai_run_event", "match_report")
RUBRIC = '[{"label": "Skills", "score": 9, "note": "n"}]'
GAPS = '[{"severity": "low", "text": "g"}]'
STRENGTHS = '["s1", "s2"]'


def _mk_user(conn: Connection, email: str) -> uuid.UUID:
    uid = uuid.uuid4()
    conn.execute(
        text(
            'INSERT INTO "user" (id, email, is_active, is_superuser,'
            " hashed_password, target_titles, created_at, session_version)"
            " VALUES (:id, :email, true, false, 'x', '{}', now(), 0)"
        ),
        {"id": uid, "email": email},
    )
    return uid


def _mk_job(conn: Connection, user_id: uuid.UUID) -> uuid.UUID:
    jid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO job (id, user_id, company, title, location, work_mode,"
            " employment, source, posted)"
            " VALUES (:id, :uid, 'Probe Co', 'Staff Engineer',"
            " CAST(:loc AS jsonb), 'remote', CAST(:emp AS jsonb),"
            " CAST(:src AS jsonb), now())"
        ),
        {
            "id": jid,
            "uid": user_id,
            "loc": VALID_JOB_LOCATION,
            "emp": VALID_JOB_EMPLOYMENT,
            "src": VALID_JOB_SOURCE,
        },
    )
    return jid


def _mk_resume(conn: Connection, user_id: uuid.UUID) -> uuid.UUID:
    rid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO resume (id, user_id, name, subtitle, version, used_in,"
            " tag) VALUES (:id, :uid, 'Probe Resume', 'sub', 'v1', 0, 'DRAFT')"
        ),
        {"id": rid, "uid": user_id},
    )
    return rid


def _guc(conn: Connection, user_id: uuid.UUID) -> None:
    conn.execute(
        text("SELECT set_config('app.user_id', :uid, true)"),
        {"uid": str(user_id)},
    )


def _as_runtime(conn: Connection, user_id: uuid.UUID) -> None:
    _guc(conn, user_id)
    conn.execute(text("SET LOCAL ROLE app_runtime"))


def _reserve(
    conn: Connection,
    job_id: uuid.UUID,
    resume_id: uuid.UUID,
    *,
    max_usd: str = "0.14",
    cap_usd: str = "20.00",
) -> dict[str, Any]:
    result = conn.execute(
        text(
            "SELECT ai_reserve_run(:jid, :rid, 'deep_match_score', 'fake',"
            " 'gemini-1.5-pro', :max_usd, :cap_usd)"
        ),
        {"jid": job_id, "rid": resume_id, "max_usd": max_usd, "cap_usd": cap_usd},
    ).scalar_one()
    return dict(result)


def _settle(
    conn: Connection,
    run_id: str | uuid.UUID,
    outcome: str,
    *,
    actual_usd: str | None = "0.14",
    score: int | None = 92,
) -> dict[str, Any]:
    result = conn.execute(
        text(
            "SELECT ai_settle_run(:run_id, :outcome, :actual_usd, :score,"
            " CAST(:rubric AS jsonb), CAST(:gaps AS jsonb),"
            " CAST(:strengths AS jsonb))"
        ),
        {
            "run_id": run_id,
            "outcome": outcome,
            "actual_usd": actual_usd if outcome == "succeeded" else None,
            "score": score if outcome == "succeeded" else None,
            "rubric": RUBRIC if outcome == "succeeded" else None,
            "gaps": GAPS if outcome == "succeeded" else None,
            "strengths": STRENGTHS if outcome == "succeeded" else None,
        },
    ).scalar_one()
    return dict(result)


def _sqlstate(exc: DBAPIError) -> str:
    return getattr(exc.orig, "sqlstate", None) or ""


def _budget(conn: Connection, user_id: uuid.UUID) -> tuple[Decimal, Decimal]:
    row = conn.execute(
        text("SELECT spent_usd, reserved_usd FROM user_ai_budget WHERE user_id = :uid"),
        {"uid": user_id},
    ).one()
    return (row.spent_usd, row.reserved_usd)


def _counts(conn: Connection) -> dict[str, int]:
    return {
        t: conn.execute(text(f"SELECT count(*) FROM {t}")).scalar_one()  # noqa: S608
        for t in TABLES
    }


@pytest.fixture()
def conn(scratch_engine: Engine) -> Generator[Connection]:
    with scratch_engine.connect() as connection:
        yield connection
        connection.rollback()


@pytest.fixture()
def tenants(conn: Connection) -> tuple[uuid.UUID, uuid.UUID]:
    return (
        _mk_user(conn, f"a-{uuid.uuid4()}@example.com"),
        _mk_user(conn, f"b-{uuid.uuid4()}@example.com"),
    )


# --------------------------------------------- AC-01: schema introspection


@pytest.mark.parametrize("table", TABLES)
def test_composite_unique_anchor_exists(conn: Connection, table: str) -> None:
    anchor = f"uq_{table}_user_id_id"
    cols = conn.execute(
        text(
            "SELECT array_agg(a.attname ORDER BY k.ord) FROM pg_constraint c"
            " JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)"
            "   ON true"
            " JOIN pg_attribute a ON a.attrelid = c.conrelid"
            "   AND a.attnum = k.attnum"
            " WHERE c.conname = :anchor AND c.contype = 'u'"
            " GROUP BY c.oid"
        ),
        {"anchor": anchor},
    ).scalar()
    assert cols == ["user_id", "id"]


@pytest.mark.parametrize("table", TABLES)
def test_user_id_not_null_cascade(conn: Connection, table: str) -> None:
    nullable = conn.execute(
        text(
            "SELECT is_nullable FROM information_schema.columns"
            " WHERE table_name = :t AND column_name = 'user_id'"
        ),
        {"t": table},
    ).scalar()
    assert nullable == "NO"
    deltype = conn.execute(
        text(
            "SELECT confdeltype FROM pg_constraint"
            " WHERE conrelid = CAST(:t AS regclass) AND contype = 'f'"
            " AND confrelid = CAST('\"user\"' AS regclass)"
        ),
        {"t": table},
    ).scalar()
    assert deltype == "c"  # CASCADE


@pytest.mark.parametrize(
    ("table", "column"),
    [
        ("user_ai_budget", "cap_usd"),
        ("user_ai_budget", "reserved_usd"),
        ("user_ai_budget", "spent_usd"),
        ("ai_run", "reserved_max_usd"),
        ("ai_run_event", "actual_cost_usd"),
    ],
)
def test_money_is_numeric_10_6(conn: Connection, table: str, column: str) -> None:
    row = conn.execute(
        text(
            "SELECT data_type, numeric_precision, numeric_scale"
            " FROM information_schema.columns"
            " WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).one()
    assert (row.data_type, row.numeric_precision, row.numeric_scale) == (
        "numeric",
        10,
        6,
    )


@pytest.mark.parametrize("table", TABLES)
def test_no_naive_timestamp_columns(conn: Connection, table: str) -> None:
    naive = conn.execute(
        text(
            "SELECT array_agg(column_name) FROM information_schema.columns"
            " WHERE table_name = :t"
            " AND data_type = 'timestamp without time zone'"
        ),
        {"t": table},
    ).scalar()
    assert naive is None


def test_named_checks_exist(conn: Connection) -> None:
    expected = {
        "ck_user_ai_budget_cap",
        "ck_user_ai_budget_cap_positive",
        "ck_user_ai_budget_spent_nonneg",
        "ck_user_ai_budget_reserved_nonneg",
        "ck_ai_run_kind",
        "ck_ai_run_reserved_max_positive",
        "ck_ai_run_event_kind",
        "ck_ai_run_event_cost",
        "ck_ai_run_event_cost_nonneg",
        "ck_match_report_version",
        "ck_match_report_score",
        "ck_match_report_rubric",
        "ck_match_report_gaps",
        "ck_match_report_strengths",
    }
    have = {
        row.conname
        for row in conn.execute(
            text("SELECT conname FROM pg_constraint WHERE contype = 'c'")
        )
    }
    assert expected <= have


def test_composite_fks_exist(conn: Connection) -> None:
    expected = {
        "fk_ai_run_job",
        "fk_ai_run_resume",
        "fk_ai_run_budget",
        "fk_ai_run_event_run",
        "fk_match_report_job",
        "fk_match_report_resume",
        "fk_match_report_run",
    }
    have = {
        row.conname
        for row in conn.execute(
            text("SELECT conname FROM pg_constraint WHERE contype = 'f'")
        )
    }
    assert expected <= have


def test_partial_unique_event_indexes_exist(conn: Connection) -> None:
    rows = {
        row.indexname: row.indexdef
        for row in conn.execute(
            text(
                "SELECT indexname, indexdef FROM pg_indexes"
                " WHERE tablename = 'ai_run_event'"
            )
        )
    }
    assert "uq_ai_run_event_reserved" in rows
    assert "'reserved'" in rows["uq_ai_run_event_reserved"]
    assert "WHERE" in rows["uq_ai_run_event_reserved"]
    assert "uq_ai_run_event_terminal" in rows
    assert "'succeeded'" in rows["uq_ai_run_event_terminal"]
    assert "WHERE" in rows["uq_ai_run_event_terminal"]


def test_ai_run_fk_rejects_cross_tenant_refs(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, other = tenants
    foreign_job = _mk_job(conn, other)
    own_resume = _mk_resume(conn, owner)
    _guc(conn, owner)
    with pytest.raises(DBAPIError) as ei:
        _reserve(conn, foreign_job, own_resume)
    # the function's ownership check fires first -- tenant-indistinguishable
    assert _sqlstate(ei.value) == "EMP33"


# --------------------------------------------- AC-01e: privilege matrix


def test_privilege_matrix_introspection(conn: Connection) -> None:
    """app_runtime is SELECT-only on all four tables (PIN-A1)."""
    for table in TABLES:
        privs = {
            row.privilege_type
            for row in conn.execute(
                text(
                    "SELECT privilege_type"
                    " FROM information_schema.role_table_grants"
                    " WHERE grantee = 'app_runtime' AND table_name = :t"
                ),
                {"t": table},
            )
        }
        assert privs == {"SELECT"}, f"{table}: {privs}"


def test_function_privileges_and_definition(conn: Connection) -> None:
    """Functions: SECURITY DEFINER, pinned search_path, EXECUTE to
    app_runtime but not PUBLIC (AC-01e / D1-9)."""
    for fn in ("ai_reserve_run", "ai_settle_run"):
        row = conn.execute(
            text(
                "SELECT prosecdef, proconfig, proacl::text AS acl"
                " FROM pg_proc WHERE proname = :fn"
            ),
            {"fn": fn},
        ).one()
        assert row.prosecdef is True
        # F1 (correctness seat): pg_temp MUST be pinned (last) so a caller
        # with TEMP privilege cannot shadow public tables and defeat the cap.
        # Substring "search_path=public" alone passed for both the safe and
        # the unsafe value -- assert the exact pinned config.
        assert row.proconfig == ["search_path=public, pg_temp"], (
            fn,
            row.proconfig,
        )
        assert "app_runtime=X" in (row.acl or "")
        # no PUBLIC grant: an ACL entry granting to PUBLIC starts with '=X'
        assert "{=X" not in (row.acl or "") and ",=X" not in (row.acl or "")
    # the teardown helper stays owner-only
    acl = conn.execute(
        text(
            "SELECT proacl::text FROM pg_proc"
            " WHERE proname = 'delete_user_with_history'"
        )
    ).scalar()
    assert "app_runtime" not in (acl or "")


def test_runtime_cannot_create_in_public_schema(conn: Connection) -> None:
    ok = conn.execute(
        text("SELECT has_schema_privilege('app_runtime', 'public', 'CREATE')")
    ).scalar_one()
    assert ok is False


def test_temp_table_shadow_cannot_defeat_the_cap(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """F1 regression (correctness seat, HIGH): with pg_temp pinned LAST, a
    caller who forges a same-named TEMP user_ai_budget with an inflated cap
    cannot fool ai_reserve_run's guard -- the function reads the REAL public
    row. Before the fix (bare 'search_path = public') the temp table was
    searched first and a real over-reservation was created."""
    owner, _ = tenants
    job = _mk_job(conn, owner)
    resume = _mk_resume(conn, owner)
    # a real budget row with almost no headroom
    _guc(conn, owner)
    first = _reserve(conn, job, resume, max_usd="19.94", cap_usd="20.00")
    _settle(conn, first["run_id"], "succeeded", actual_usd="19.94")
    real_budget_id = conn.execute(
        text("SELECT id FROM user_ai_budget WHERE user_id = :u"), {"u": owner}
    ).scalar_one()

    # forge a temp shadow with the SAME id but a 9999 cap, as app_runtime
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(
        text(
            "CREATE TEMP TABLE user_ai_budget (id uuid, user_id uuid,"
            " month_start date, cap_usd numeric, reserved_usd numeric,"
            " spent_usd numeric)"
        )
    )
    conn.execute(
        text(
            "INSERT INTO user_ai_budget"
            " SELECT :bid, :uid, now()::date, 9999, 0, 0"
        ),
        {"bid": real_budget_id, "uid": owner},
    )
    job2 = None
    conn.execute(text("RESET ROLE"))
    job2 = _mk_job(conn, owner)
    _guc(conn, owner)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    # the guard reads the REAL 0.06 headroom, not the temp 9999 -> refused
    # (the raise aborts the txn; the conn fixture rolls back at teardown)
    with pytest.raises(DBAPIError) as ei:
        _reserve(conn, job2, resume, max_usd="5.00", cap_usd="20.00")
    assert _sqlstate(ei.value) == "EMP30"


# --------------------------------------------- AC-02: append-only + RLS


@pytest.mark.parametrize("table", TABLES)
def test_rls_enabled_forced(conn: Connection, table: str) -> None:
    row = conn.execute(
        text(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname = :t"
        ),
        {"t": table},
    ).one()
    assert row.relrowsecurity is True
    assert row.relforcerowsecurity is True


def _walk_one_run(
    conn: Connection,
    user_id: uuid.UUID,
    *,
    settle_outcome: str | None = "succeeded",
    max_usd: str = "0.14",
    cap_usd: str = "20.00",
) -> dict[str, Any]:
    """Function-walk one run for a fresh job+resume as the given tenant."""
    job = _mk_job(conn, user_id)
    resume = _mk_resume(conn, user_id)
    _guc(conn, user_id)
    reserved = _reserve(conn, job, resume, max_usd=max_usd, cap_usd=cap_usd)
    if settle_outcome is not None:
        settled = _settle(conn, reserved["run_id"], settle_outcome)
        return {**reserved, **settled, "job_id": str(job), "resume_id": str(resume)}
    return {**reserved, "job_id": str(job), "resume_id": str(resume)}


def test_rls_filters_cross_tenant_under_runtime(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, intruder = tenants
    _walk_one_run(conn, owner)
    _as_runtime(conn, intruder)
    for table in TABLES:
        n = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()  # noqa: S608
        assert n == 0, f"intruder sees {n} rows of {table}"
    conn.execute(text("RESET ROLE"))


def test_rls_zero_rows_without_guc(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, _ = tenants
    _walk_one_run(conn, owner)
    conn.execute(text("SELECT set_config('app.user_id', '', true)"))
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    for table in TABLES:
        n = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()  # noqa: S608
        assert n == 0
    conn.execute(text("RESET ROLE"))


@pytest.mark.parametrize("table", APPEND_ONLY)
def test_append_only_refused_under_runtime_role(
    scratch_engine: Engine, tenants_committed: dict[str, Any], table: str
) -> None:
    owner = tenants_committed["owner"]
    for stmt in (
        f"UPDATE {table} SET user_id = user_id",  # noqa: S608
        f"DELETE FROM {table}",  # noqa: S608
        f"TRUNCATE {table}",
        # INSERT is also revoked (PIN-A1): probe with a bare defaults row
        f"INSERT INTO {table} (id, user_id) VALUES (gen_random_uuid(), '{owner}')",  # noqa: S608
    ):
        with scratch_engine.connect() as c:
            _as_runtime(c, owner)
            with pytest.raises(DBAPIError) as ei:
                c.execute(text(stmt))
            assert ei.value.orig is not None
            assert "permission denied" in str(ei.value.orig)
            c.rollback()


def test_budget_dml_refused_under_runtime_role(
    scratch_engine: Engine, tenants_committed: dict[str, Any]
) -> None:
    owner = tenants_committed["owner"]
    for stmt in (
        "UPDATE user_ai_budget SET spent_usd = 0",
        "DELETE FROM user_ai_budget",
        "INSERT INTO user_ai_budget (id, user_id, month_start, cap_usd)"
        f" VALUES (gen_random_uuid(), '{owner}', now()::date, 1)",
    ):
        with scratch_engine.connect() as c:
            _as_runtime(c, owner)
            with pytest.raises(DBAPIError) as ei:
                c.execute(text(stmt))
            assert "permission denied" in str(ei.value.orig)
            c.rollback()


@pytest.mark.parametrize("table", APPEND_ONLY)
def test_append_only_trigger_blocks_even_the_owner(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID], table: str
) -> None:
    owner, _ = tenants
    _walk_one_run(conn, owner)
    with pytest.raises(DBAPIError) as ei:
        conn.execute(text(f"UPDATE {table} SET user_id = user_id"))  # noqa: S608
    assert "append-only table" in str(ei.value.orig)


# --------------------------------------------- AC-02c: direct-call boundary
# Committed fixture world (own connections; the failing calls must roll back
# without touching committed state, which uncommitted fixtures cannot show).


@pytest.fixture(scope="module")
def tenants_committed(scratch_engine: Engine) -> Generator[dict[str, Any]]:
    """Committed owner (with one settled run) + intruder; torn down via
    delete_user_with_history -- which is itself AC-11 coverage."""
    with scratch_engine.connect() as c:
        owner = _mk_user(c, f"owner-{uuid.uuid4()}@example.com")
        intruder = _mk_user(c, f"intruder-{uuid.uuid4()}@example.com")
        walked = _walk_one_run(c, owner)
        c.commit()
    yield {"owner": owner, "intruder": intruder, **walked}
    with scratch_engine.connect() as c:
        for uid in (owner, intruder):
            c.execute(text("SELECT delete_user_with_history(:uid)"), {"uid": uid})
        c.commit()


def _snapshot_state(engine: Engine) -> tuple[dict[str, int], list[Any]]:
    with engine.connect() as c:
        counts = _counts(c)
        budgets = c.execute(
            text(
                "SELECT user_id, spent_usd, reserved_usd FROM user_ai_budget"
                " ORDER BY user_id"
            )
        ).all()
    return counts, budgets


def test_direct_call_boundary_zero_mutation(
    scratch_engine: Engine, tenants_committed: dict[str, Any]
) -> None:
    """Every refused direct call leaves committed state byte-identical
    (AC-02c): cross-tenant reserve, unset-GUC reserve, foreign settle,
    double settle, illegal payload shapes."""
    owner = tenants_committed["owner"]
    intruder = tenants_committed["intruder"]
    run_id = tenants_committed["run_id"]
    job = tenants_committed["job_id"]
    resume = tenants_committed["resume_id"]
    before = _snapshot_state(scratch_engine)

    attacks: list[tuple[str, uuid.UUID | None, str]] = [
        # (description, acting tenant GUC (None = unset), expected SQLSTATE)
        ("reserve against foreign job/resume", intruder, "EMP33"),
        ("reserve with unset GUC", None, "EMP00"),
        ("settle a foreign run", intruder, "EMP31"),
        ("double settle", owner, "EMP32"),
        ("illegal outcome", owner, "EMP34"),
        ("succeeded without payload", owner, "EMP34"),
    ]
    for label, actor, expected in attacks:
        with scratch_engine.connect() as c:
            if actor is not None:
                _as_runtime(c, actor)
            else:
                c.execute(text("SET LOCAL ROLE app_runtime"))
            with pytest.raises(DBAPIError) as ei:
                if label.startswith("reserve"):
                    _reserve(c, uuid.UUID(job), uuid.UUID(resume))
                elif label == "settle a foreign run" or label == "double settle":
                    _settle(c, run_id, "failed")
                elif label == "illegal outcome":
                    _settle(c, run_id, "cancelled")
                else:
                    c.execute(
                        text("SELECT ai_settle_run(:r, 'succeeded')"),
                        {"r": run_id},
                    )
            assert _sqlstate(ei.value) == expected, label
            c.rollback()

    assert _snapshot_state(scratch_engine) == before


def test_actual_cost_above_reservation_refused(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, _ = tenants
    walked = _walk_one_run(conn, owner, settle_outcome=None)
    with pytest.raises(DBAPIError) as ei:
        _settle(conn, walked["run_id"], "succeeded", actual_usd="0.20")
    assert _sqlstate(ei.value) == "EMP34"


def test_negative_actual_cost_refused_zero_mutation(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """D2-2: a negative actual cost is refused (EMP34 guard + the
    ck_ai_run_event_cost_nonneg CHECK belt); the reservation is untouched.
    A SAVEPOINT isolates the refused settle so the outer reservation survives
    for the post-check."""
    owner, _ = tenants
    walked = _walk_one_run(conn, owner, settle_outcome=None)
    before = _budget(conn, owner)
    sp = conn.begin_nested()
    with pytest.raises(DBAPIError) as ei:
        _settle(conn, walked["run_id"], "succeeded", actual_usd="-0.01")
    assert _sqlstate(ei.value) == "EMP34"
    sp.rollback()
    # nothing settled: the run is still open, the reservation still held
    assert _budget(conn, owner) == before == (Decimal("0"), Decimal("0.14"))
    n_events = conn.execute(
        text(
            "SELECT count(*) FROM ai_run_event WHERE run_id = :r"
            " AND kind IN ('succeeded', 'failed')"
        ),
        {"r": walked["run_id"]},
    ).scalar_one()
    assert n_events == 0


# --------------------------------------------- AC-05/AC-06: reservation cap,
# idempotency, settlement liveness (SQL level; route level in tests/api)


def test_cap_guarded_update_refuses_over_cap(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, _ = tenants
    job = _mk_job(conn, owner)
    resume = _mk_resume(conn, owner)
    _guc(conn, owner)
    with pytest.raises(DBAPIError) as ei:
        _reserve(conn, job, resume, max_usd="0.14", cap_usd="0.10")
    assert _sqlstate(ei.value) == "EMP30"


def test_settlement_converts_reservation_to_actual(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, _ = tenants
    walked = _walk_one_run(conn, owner, settle_outcome=None)
    assert _budget(conn, owner) == (Decimal("0"), Decimal("0.14"))
    _settle(conn, walked["run_id"], "succeeded")
    assert _budget(conn, owner) == (Decimal("0.14"), Decimal("0"))
    # liveness: the headroom is reservable again (D1-1)
    second = _walk_one_run(conn, owner, settle_outcome=None)
    assert second["adopted"] is False


def test_failed_settlement_releases_reservation(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, _ = tenants
    walked = _walk_one_run(conn, owner, settle_outcome="failed")
    assert _budget(conn, owner) == (Decimal("0"), Decimal("0"))
    n_reports = conn.execute(
        text("SELECT count(*) FROM match_report WHERE user_id = :u"),
        {"u": owner},
    ).scalar_one()
    assert n_reports == 0
    # a later request for the same triple is a NEW run (terminal bumped seq)
    _guc(conn, owner)
    again = _reserve(conn, uuid.UUID(walked["job_id"]), uuid.UUID(walked["resume_id"]))
    assert again["adopted"] is False
    assert again["run_id"] != walked["run_id"]


def test_open_run_adoption_no_double_reserve(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Retry after a post-reservation failure adopts the open run (AC-06)."""
    owner, _ = tenants
    walked = _walk_one_run(conn, owner, settle_outcome=None)
    retry = _reserve(conn, uuid.UUID(walked["job_id"]), uuid.UUID(walked["resume_id"]))
    assert retry["adopted"] is True
    assert retry["run_id"] == walked["run_id"]
    # exactly one reservation was charged
    assert _budget(conn, owner) == (Decimal("0"), Decimal("0.14"))
    n_runs = conn.execute(
        text("SELECT count(*) FROM ai_run WHERE user_id = :u"), {"u": owner}
    ).scalar_one()
    assert n_runs == 1
    # settle once: exactly one charge
    _settle(conn, walked["run_id"], "succeeded")
    assert _budget(conn, owner) == (Decimal("0.14"), Decimal("0"))


def test_idempotency_key_unique_constraint_backstop(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    owner, _ = tenants
    walked = _walk_one_run(conn, owner, settle_outcome=None)
    with pytest.raises(DBAPIError) as ei:
        conn.execute(
            text(
                "INSERT INTO ai_run (id, user_id, job_id, resume_id, budget_id,"
                " kind, provider, model, reserved_max_usd, idempotency_key)"
                " SELECT gen_random_uuid(), user_id, job_id, resume_id,"
                " budget_id, kind, provider, model, reserved_max_usd,"
                " idempotency_key FROM ai_run WHERE id = :r"
            ),
            {"r": walked["run_id"]},
        )
    assert "uq_ai_run_idempotency" in str(ei.value.orig)


def test_report_versions_are_immutable_and_current_is_max(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """PIN-A7: two settled runs for one triple -> versions 1 and 2; the
    MAX(version) row is the current one; rows are immutable."""
    owner, _ = tenants
    walked = _walk_one_run(conn, owner)
    assert walked["version"] == 1
    _guc(conn, owner)
    second = _reserve(conn, uuid.UUID(walked["job_id"]), uuid.UUID(walked["resume_id"]))
    settled = _settle(conn, second["run_id"], "succeeded")
    assert settled["version"] == 2
    current = conn.execute(
        text(
            "SELECT version FROM match_report WHERE user_id = :uid"
            " AND job_id = :jid AND resume_id = :rid"
            " ORDER BY version DESC LIMIT 1"
        ),
        {
            "uid": owner,
            "jid": walked["job_id"],
            "rid": walked["resume_id"],
        },
    ).scalar_one()
    assert current == 2


def test_ck_budget_cap_is_the_belt(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Even the OWNER cannot push spent+reserved past cap (the DB belt)."""
    owner, _ = tenants
    _walk_one_run(conn, owner)
    with pytest.raises(DBAPIError) as ei:
        conn.execute(text("UPDATE user_ai_budget SET spent_usd = cap_usd + 1"))
    assert "ck_user_ai_budget" in str(ei.value.orig)


def test_two_connection_reservation_race_cap_never_exceeded(
    scratch_engine: Engine,
) -> None:
    """AC-05: two connections race for headroom that fits only one
    reservation. The loser BLOCKS on the budget row lock (real contention),
    then loses to EMP30. Committed state asserted under the runtime role.
    PR-7: every connection is invalidate()'d."""
    setup = scratch_engine.connect()
    conn_a = scratch_engine.connect()
    conn_b = scratch_engine.connect()
    verify = scratch_engine.connect()
    try:
        owner = _mk_user(setup, f"race-{uuid.uuid4()}@example.com")
        job_a = _mk_job(setup, owner)
        job_b = _mk_job(setup, owner)
        resume = _mk_resume(setup, owner)
        # pre-fill the month: cap 1.00, spent 0.80 -> one 0.14 fits, two don't
        _guc(setup, owner)
        first = _reserve(setup, job_a, resume, max_usd="0.80", cap_usd="1.00")
        _settle(setup, first["run_id"], "succeeded", actual_usd="0.80")
        setup.commit()

        # A reserves inside an open transaction (holds the budget row lock)
        _as_runtime(conn_a, owner)
        got_a = _reserve(conn_a, job_a, resume, max_usd="0.14", cap_usd="1.00")
        assert got_a["adopted"] is False

        # B blocks on the lock -- REAL contention, not sequential luck
        _as_runtime(conn_b, owner)
        conn_b.execute(text("SET LOCAL lock_timeout = '250ms'"))
        with pytest.raises(OperationalError):
            _reserve(conn_b, job_b, resume, max_usd="0.14", cap_usd="1.00")
        conn_b.rollback()

        conn_a.commit()

        # B retries in a fresh transaction: the winner took the headroom
        _as_runtime(conn_b, owner)
        with pytest.raises(DBAPIError) as ei:
            _reserve(conn_b, job_b, resume, max_usd="0.14", cap_usd="1.00")
        assert _sqlstate(ei.value) == "EMP30"
        conn_b.rollback()

        # committed state, asserted UNDER THE RUNTIME ROLE (sprint-04 D2-3)
        _as_runtime(verify, owner)
        runs = verify.execute(
            text("SELECT count(*) FROM ai_run WHERE job_id = :j"),
            {"j": job_a},
        ).scalar_one()
        assert runs == 2  # the setup run + A's reservation; B inserted nothing
        spent, reserved = _budget(verify, owner)
        assert spent == Decimal("0.80")
        assert reserved == Decimal("0.14")
        assert spent + reserved <= Decimal("1.00")
        verify.execute(text("RESET ROLE"))
        # teardown the committed world
        verify.execute(text("SELECT delete_user_with_history(:uid)"), {"uid": owner})
        verify.commit()
    finally:
        for c in (setup, conn_a, conn_b, verify):
            c.invalidate()


def test_two_connection_same_triple_second_adopts(
    scratch_engine: Engine,
) -> None:
    """AC-05 adoption cardinality: two concurrent identical requests -> ONE
    reservation; the blocked second request adopts the winner's open run."""
    setup = scratch_engine.connect()
    conn_a = scratch_engine.connect()
    conn_b = scratch_engine.connect()
    try:
        owner = _mk_user(setup, f"adopt-{uuid.uuid4()}@example.com")
        job = _mk_job(setup, owner)
        resume = _mk_resume(setup, owner)
        setup.commit()

        _as_runtime(conn_a, owner)
        got_a = _reserve(conn_a, job, resume)

        _as_runtime(conn_b, owner)
        conn_b.execute(text("SET LOCAL lock_timeout = '250ms'"))
        with pytest.raises(OperationalError):
            _reserve(conn_b, job, resume)
        conn_b.rollback()

        conn_a.commit()

        _as_runtime(conn_b, owner)
        got_b = _reserve(conn_b, job, resume)
        conn_b.commit()
        assert got_b["adopted"] is True
        assert got_b["run_id"] == got_a["run_id"]

        # D2-3: committed cardinality asserted UNDER THE RUNTIME ROLE on a
        # fresh connection -- exactly one run, one reserved event, one
        # idempotency key, exact balances.
        _as_runtime(setup, owner)
        runs = setup.execute(
            text("SELECT id, idempotency_key FROM ai_run WHERE user_id = :u"),
            {"u": owner},
        ).all()
        assert len(runs) == 1
        assert runs[0].id == uuid.UUID(got_a["run_id"])
        assert len({r.idempotency_key for r in runs}) == 1
        reserved_events = setup.execute(
            text(
                "SELECT count(*) FROM ai_run_event"
                " WHERE run_id = :r AND kind = 'reserved'"
            ),
            {"r": got_a["run_id"]},
        ).scalar_one()
        assert reserved_events == 1
        assert _budget(setup, owner) == (Decimal("0"), Decimal("0.14"))
        setup.execute(text("RESET ROLE"))
        setup.execute(text("SELECT delete_user_with_history(:u)"), {"u": owner})
        setup.commit()
    finally:
        for c in (setup, conn_a, conn_b):
            c.invalidate()


# --------------------------------------------- AC-11: teardown


def test_user_teardown_with_ai_history(conn: Connection) -> None:
    """delete_user_with_history covers the new append-only tables (PIN-A14)
    and leaves the other tenant's AI history intact."""
    victim = _mk_user(conn, f"teardown-{uuid.uuid4()}@example.com")
    bystander = _mk_user(conn, f"bystander-{uuid.uuid4()}@example.com")
    _walk_one_run(conn, victim)
    _walk_one_run(conn, bystander)
    conn.execute(text("SELECT delete_user_with_history(:uid)"), {"uid": victim})
    for table in TABLES:
        remaining = conn.execute(
            text(f"SELECT count(*) FROM {table} WHERE user_id = :uid"),  # noqa: S608
            {"uid": victim},
        ).scalar_one()
        assert remaining == 0, table
        bystander_rows = conn.execute(
            text(f"SELECT count(*) FROM {table} WHERE user_id = :uid"),  # noqa: S608
            {"uid": bystander},
        ).scalar_one()
        assert bystander_rows >= 1, table
