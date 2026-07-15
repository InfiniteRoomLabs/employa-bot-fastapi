"""Sprint-04 tables (5f1fb22cd505) under the binding conventions.

Mirrors test_shortlist_entry.py (the child exemplar) across the five new
tables and adds the sprint's NET-NEW mechanics (docs/sprints/sprint-04-spec.md):
append-only enforcement on stage_transition/resume_snapshot incl. TRUNCATE and
the owner-blocking trigger (PIN-7), the PIN-19 hardened privilege matrix
(application UPDATE/DELETE revoked; history/grants SELECT-only), the
one-DEFAULT-resume partial index (PIN-5), and the dirty-representative-data
upgrade path (PIN-8 / AC-01g). Assertions are on DB state under the runtime
role, never code shape.
"""

from __future__ import annotations

import os
import subprocess
import sys
import uuid
from collections.abc import Generator

import pytest
from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.exc import DBAPIError

from tests.migrations.conftest import BACKEND_DIR, server_url

VALID_JOB_LOCATION = '{"raw": "Remote - US"}'
VALID_JOB_EMPLOYMENT = (
    '{"classification": "w2", "cadence": "salary", "commitment": "full-time"}'
)
VALID_JOB_SOURCE = (
    '{"board": "greenhouse", "channel": "url", "capturedAt": "2026-07-13T00:00:00Z"}'
)

TABLES = ("application", "stage_transition", "resume", "resume_snapshot", "undo_grant")
APPEND_ONLY = ("stage_transition", "resume_snapshot")


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


def _mk_resume(
    conn: Connection,
    user_id: uuid.UUID,
    *,
    tag: str = "DRAFT",
    used_in: int = 0,
    fork_job_id: uuid.UUID | None = None,
) -> uuid.UUID:
    rid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO resume (id, user_id, name, subtitle, version, used_in,"
            " tag, fork_job_id)"
            " VALUES (:id, :uid, 'Probe Resume', 'sub', 'v1', :used_in, :tag,"
            " :fork_job_id)"
        ),
        {
            "id": rid,
            "uid": user_id,
            "tag": tag,
            "used_in": used_in,
            "fork_job_id": fork_job_id,
        },
    )
    return rid


def _mk_application(
    conn: Connection,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    *,
    resume_id: uuid.UUID | None = None,
    stage: str = "drafting",
    version: int = 1,
    flag: str | None = None,
    outcome: str | None = None,
    outcome_reasons: str | None = None,
    schema_version: int = 1,
) -> uuid.UUID:
    aid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO application (id, user_id, job_id, resume_id, stage,"
            " version, flag, outcome, outcome_reasons, schema_version)"
            " VALUES (:id, :uid, :jid, :rid, :stage, :version, :flag, :outcome,"
            " CAST(:outcome_reasons AS jsonb), :sv)"
        ),
        {
            "id": aid,
            "uid": user_id,
            "jid": job_id,
            "rid": resume_id,
            "stage": stage,
            "version": version,
            "flag": flag,
            "outcome": outcome,
            "outcome_reasons": outcome_reasons,
            "sv": schema_version,
        },
    )
    return aid


def _mk_transition(
    conn: Connection,
    user_id: uuid.UUID,
    application_id: uuid.UUID,
    *,
    seq: int = 1,
    from_stage: str | None = "drafting",
    to_stage: str = "applied",
    source: str = "user",
    reasons: str | None = None,
) -> uuid.UUID:
    tid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO stage_transition (id, user_id, application_id, seq,"
            " from_stage, to_stage, source, reasons)"
            " VALUES (:id, :uid, :aid, :seq, :from_stage, :to_stage, :source,"
            " CAST(:reasons AS jsonb))"
        ),
        {
            "id": tid,
            "uid": user_id,
            "aid": application_id,
            "seq": seq,
            "from_stage": from_stage,
            "to_stage": to_stage,
            "source": source,
            "reasons": reasons,
        },
    )
    return tid


def _mk_snapshot(
    conn: Connection,
    user_id: uuid.UUID,
    application_id: uuid.UUID,
    resume_id: uuid.UUID,
) -> uuid.UUID:
    sid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO resume_snapshot (id, user_id, application_id, resume_id,"
            " name, body, template_version)"
            " VALUES (:id, :uid, :aid, :rid, 'Probe Resume', 'body', 'v1')"
        ),
        {"id": sid, "uid": user_id, "aid": application_id, "rid": resume_id},
    )
    return sid


def _mk_grant(
    conn: Connection,
    user_id: uuid.UUID,
    application_id: uuid.UUID,
    transition_id: uuid.UUID,
) -> uuid.UUID:
    gid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO undo_grant (id, user_id, application_id,"
            " corrects_transition_id, expires_at)"
            " VALUES (:id, :uid, :aid, :tid, now() + interval '300 seconds')"
        ),
        {"id": gid, "uid": user_id, "aid": application_id, "tid": transition_id},
    )
    return gid


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


# --------------------------------------------- AC-01a anchors + tenant user_id


@pytest.mark.parametrize("table", TABLES)
def test_composite_unique_anchor_exists(conn: Connection, table: str) -> None:
    anchor = {
        "application": "uq_application_user_id_id",
        "stage_transition": "uq_stage_transition_user_id_id",
        "resume": "uq_resume_user_id_id",
        "resume_snapshot": "uq_resume_snapshot_user_id_id",
        "undo_grant": "uq_undo_grant_user_id_id",
    }[table]
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
        text("SELECT confdeltype FROM pg_constraint WHERE conname = :c"),
        {"c": f"{table}_user_id_fkey"},
    ).scalar()
    assert deltype == "c"  # CASCADE


# ------------------------------------------- AC-01a composite FKs (cross-tenant)


def test_application_fk_rejects_cross_tenant_job(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_job = _mk_job(conn, b)
    with pytest.raises(DBAPIError, match="fk_application_job|foreign key"):
        _mk_application(conn, a, b_job)


def test_application_fk_rejects_cross_tenant_resume(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    a_job = _mk_job(conn, a)
    b_resume = _mk_resume(conn, b)
    with pytest.raises(DBAPIError, match="fk_application_resume|foreign key"):
        _mk_application(conn, a, a_job, resume_id=b_resume)


def test_application_accepts_own_refs_and_null_resume(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    a_job = _mk_job(conn, a)
    a_resume = _mk_resume(conn, a)
    _mk_application(conn, a, a_job, resume_id=a_resume)
    _mk_application(conn, a, _mk_job(conn, a), resume_id=None)  # MATCH SIMPLE


def test_transition_fk_rejects_cross_tenant_application(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_app = _mk_application(conn, b, _mk_job(conn, b))
    with pytest.raises(DBAPIError, match="fk_stage_transition_application|foreign key"):
        _mk_transition(conn, a, b_app)


def test_snapshot_fks_reject_cross_tenant(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_app = _mk_application(conn, b, _mk_job(conn, b))
    b_resume = _mk_resume(conn, b)
    with pytest.raises(DBAPIError, match="fk_resume_snapshot_|foreign key"):
        _mk_snapshot(conn, a, b_app, b_resume)


def test_undo_grant_fks_reject_cross_tenant(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_app = _mk_application(conn, b, _mk_job(conn, b))
    b_tr = _mk_transition(conn, b, b_app)
    with pytest.raises(DBAPIError, match="fk_undo_grant_|foreign key"):
        _mk_grant(conn, a, b_app, b_tr)


def test_resume_fork_fk_rejects_cross_tenant_job(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_job = _mk_job(conn, b)
    with pytest.raises(DBAPIError, match="fk_resume_fork_job|foreign key"):
        _mk_resume(conn, a, fork_job_id=b_job)


def test_composite_fk_is_the_backstop_under_app_runtime(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """The cross-tenant refusal holds under the RUNTIME role too (sprint-03
    D2-2 pattern): insert directly under app_runtime + the caller's GUC,
    bypassing any route pre-check."""
    a, b = tenants
    b_job = _mk_job(conn, b)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="fk_application_job|foreign key"):
        _mk_application(conn, a, b_job)


def test_transition_resume_fk_rejects_cross_tenant(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """D2-1: the historical resume reference on stage_transition carries the
    composite FK too -- a cross-tenant resume_id fails at the DB."""
    a, b = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    b_resume = _mk_resume(conn, b)
    tid = uuid.uuid4()
    with pytest.raises(DBAPIError, match="fk_stage_transition_resume|foreign key"):
        conn.execute(
            text(
                "INSERT INTO stage_transition (id, user_id, application_id, seq,"
                " from_stage, to_stage, source, resume_id)"
                " VALUES (:id, :uid, :aid, 1, 'drafting', 'applied', 'user', :rid)"
            ),
            {"id": tid, "uid": a, "aid": app, "rid": b_resume},
        )


def test_snapshot_resume_fk_blocks_resume_delete(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """RV-3 closure, exercised at the CONSTRAINT (not the app-level 409):
    deleting a resume referenced by a resume_snapshot fails on
    fk_resume_snapshot_resume even as the owner -- constraints are
    role-independent, so this is the delete backstop behind PIN-17."""
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    resume = _mk_resume(conn, a)
    _mk_snapshot(conn, a, app, resume)
    with pytest.raises(DBAPIError, match="fk_resume_snapshot_resume"):
        conn.execute(text("DELETE FROM resume WHERE id = :id"), {"id": resume})


def test_corrects_transition_fk_self_reference(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    t1 = _mk_transition(conn, a, app, seq=1)
    # a compensating row pointing at t1 is accepted...
    tid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO stage_transition (id, user_id, application_id, seq,"
            " from_stage, to_stage, source, corrects_transition_id)"
            " VALUES (:id, :uid, :aid, 2, 'won', 'offer', 'user_correction', :ct)"
        ),
        {"id": tid, "uid": a, "aid": app, "ct": t1},
    )
    # ...an unknown corrects id is not
    with pytest.raises(DBAPIError, match="fk_stage_transition_corrects|foreign key"):
        conn.execute(
            text(
                "INSERT INTO stage_transition (id, user_id, application_id, seq,"
                " from_stage, to_stage, source, corrects_transition_id)"
                " VALUES (:id, :uid, :aid, 3, 'won', 'offer', 'user_correction',"
                " :ct)"
            ),
            {"id": uuid.uuid4(), "uid": a, "aid": app, "ct": uuid.uuid4()},
        )


def test_seq_unique_per_application(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    _mk_transition(conn, a, app, seq=1)
    with pytest.raises(DBAPIError, match="uq_stage_transition_seq"):
        _mk_transition(conn, a, app, seq=1)


def test_one_snapshot_per_application(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    resume = _mk_resume(conn, a)
    _mk_snapshot(conn, a, app, resume)
    with pytest.raises(DBAPIError, match="uq_resume_snapshot_application"):
        _mk_snapshot(conn, a, app, resume)


# --------------------------------------------- PIN-5 one DEFAULT per tenant


def test_default_resume_partial_unique(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    _mk_resume(conn, a, tag="DEFAULT")
    _mk_resume(conn, b, tag="DEFAULT")  # other tenant: fine
    _mk_resume(conn, a, tag="VARIANT")
    _mk_resume(conn, a, tag="VARIANT")  # non-DEFAULT dupes: fine
    with pytest.raises(DBAPIError, match="uq_resume_user_default"):
        _mk_resume(conn, a, tag="DEFAULT")


# ------------------------------------------------------- AC-01b RLS


@pytest.mark.parametrize("table", TABLES)
def test_rls_enabled_forced_owner_not_runtime(conn: Connection, table: str) -> None:
    row = conn.execute(
        text(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname = :t"
        ),
        {"t": table},
    ).one()
    assert row == (True, True)
    policy = conn.execute(
        text("SELECT polname FROM pg_policy WHERE polrelid = CAST(:t AS regclass)"),
        {"t": table},
    ).scalar()
    assert policy == f"{table}_tenant_isolation"
    owner = conn.execute(
        text("SELECT tableowner FROM pg_tables WHERE tablename = :t"),
        {"t": table},
    ).scalar()
    assert owner != "app_runtime"


def test_rls_filters_without_where_across_tables(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """One row per tenant in every table (as owner), then a bare SELECT under
    app_runtime + a's GUC sees ONLY a's rows -- no WHERE in the query."""
    a, b = tenants
    ids: dict[str, uuid.UUID] = {}
    for uid, keep in ((a, True), (b, False)):
        job = _mk_job(conn, uid)
        resume = _mk_resume(conn, uid)
        app = _mk_application(conn, uid, job, resume_id=resume)
        tr = _mk_transition(conn, uid, app)
        snap = _mk_snapshot(conn, uid, app, resume)
        grant = _mk_grant(conn, uid, app, tr)
        if keep:
            ids = {
                "application": app,
                "stage_transition": tr,
                "resume": resume,
                "resume_snapshot": snap,
                "undo_grant": grant,
            }
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    for table, expected in ids.items():
        rows = conn.execute(text(f"SELECT id FROM {table}")).all()  # noqa: S608
        assert [r[0] for r in rows] == [expected], table


def test_rls_zero_rows_without_guc(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    _mk_transition(conn, a, app)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    for table in TABLES:
        assert (
            conn.execute(text(f"SELECT count(*) FROM {table}")).scalar() == 0  # noqa: S608
        ), table


def test_rls_with_check_rejects_cross_tenant_insert(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_job = _mk_job(conn, b)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    # spoofing b's user_id under a's GUC: RLS WITH CHECK refuses before any FK
    with pytest.raises(DBAPIError, match="row-level security"):
        _mk_application(conn, b, b_job)


# ----------------------------------- AC-02 + PIN-7/19 append-only + privileges


def test_privilege_matrix_introspection(conn: Connection) -> None:
    """PIN-19: the exact app_runtime privilege matrix, asserted."""
    expected = {
        "application": {"SELECT": True, "INSERT": True, "UPDATE": False, "DELETE": False},
        "stage_transition": {
            "SELECT": True,
            "INSERT": False,
            "UPDATE": False,
            "DELETE": False,
        },
        "resume_snapshot": {
            "SELECT": True,
            "INSERT": False,
            "UPDATE": False,
            "DELETE": False,
        },
        "undo_grant": {
            "SELECT": True,
            "INSERT": False,
            "UPDATE": False,
            "DELETE": False,
        },
        "resume": {"SELECT": True, "INSERT": True, "UPDATE": True, "DELETE": True},
    }
    for table, privs in expected.items():
        for priv, granted in privs.items():
            actual = conn.execute(
                text("SELECT has_table_privilege('app_runtime', :t, :p)"),
                {"t": table, "p": priv},
            ).scalar()
            assert actual is granted, f"{table}.{priv}: expected {granted}"


@pytest.mark.parametrize("table", APPEND_ONLY)
@pytest.mark.parametrize("stmt", ["UPDATE", "DELETE", "TRUNCATE"])
def test_append_only_refused_under_runtime_role(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID], table: str, stmt: str
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    resume = _mk_resume(conn, a)
    _mk_transition(conn, a, app)
    _mk_snapshot(conn, a, app, resume)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    sql = {
        "UPDATE": f"UPDATE {table} SET schema_version = 2",
        "DELETE": f"DELETE FROM {table}",
        "TRUNCATE": f"TRUNCATE {table}",
    }[stmt]
    with pytest.raises(DBAPIError, match="permission denied"):
        conn.execute(text(sql))


@pytest.mark.parametrize("table", APPEND_ONLY)
def test_history_insert_refused_under_runtime_role(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID], table: str
) -> None:
    """PIN-19 hardening: history is forge-proof -- app_runtime cannot even
    INSERT; only the 3b stage-mutation function (owner) writes these tables."""
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    resume = _mk_resume(conn, a)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="permission denied"):
        if table == "stage_transition":
            _mk_transition(conn, a, app)
        else:
            _mk_snapshot(conn, a, app, resume)


@pytest.mark.parametrize("table", APPEND_ONLY)
@pytest.mark.parametrize("stmt", ["UPDATE", "DELETE", "TRUNCATE"])
def test_append_only_trigger_blocks_even_the_owner(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID], table: str, stmt: str
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    resume = _mk_resume(conn, a)
    _mk_transition(conn, a, app)
    _mk_snapshot(conn, a, app, resume)
    sql = {
        "UPDATE": f"UPDATE {table} SET schema_version = 2",
        "DELETE": f"DELETE FROM {table}",
        # CASCADE so the statement gets PAST the FK-reference pre-check
        # (undo_grant/application reference these tables) and actually reaches
        # the BEFORE TRUNCATE trigger under test.
        "TRUNCATE": f"TRUNCATE {table} CASCADE",
    }[stmt]
    with pytest.raises(DBAPIError, match="append-only"):
        conn.execute(text(sql))


def test_application_update_refused_under_runtime_role(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """AC-03b: nothing but the mutation function can move stage/version."""
    a, _ = tenants
    _mk_application(conn, a, _mk_job(conn, a))
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="permission denied"):
        conn.execute(text("UPDATE application SET stage = 'applied', version = 2"))


def test_undo_grant_update_refused_under_runtime_role(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    tr = _mk_transition(conn, a, app)
    _mk_grant(conn, a, app, tr)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="permission denied"):
        conn.execute(text("UPDATE undo_grant SET consumed_at = NULL"))


# --------------------------------------------- AC-01c/d timestamptz + CHECKs


@pytest.mark.parametrize("table", TABLES)
def test_no_naive_timestamp_columns(conn: Connection, table: str) -> None:
    offenders = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_name = :t"
            " AND data_type = 'timestamp without time zone'"
        ),
        {"t": table},
    ).all()
    assert offenders == []


def test_named_checks_exist(conn: Connection) -> None:
    names = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT conname FROM pg_constraint WHERE contype = 'c'"
                " AND conrelid IN (SELECT oid FROM pg_class WHERE relname IN"
                " ('application', 'stage_transition', 'resume', 'resume_snapshot',"
                "  'undo_grant'))"
            )
        )
    }
    assert {
        "ck_application_stage",
        "ck_application_version",
        "ck_application_flag",
        "ck_application_outcome",
        "ck_application_outcome_reasons",
        "ck_application_system_reasons",
        "ck_application_schema_version",
        "ck_stage_transition_from_stage",
        "ck_stage_transition_to_stage",
        "ck_stage_transition_source",
        "ck_stage_transition_seq_positive",
        "ck_stage_transition_reasons",
        "ck_resume_tag",
        "ck_resume_used_in",
        "ck_resume_snapshot_schema_version",
        "ck_undo_grant_schema_version",
    } <= names


def test_application_checks_reject_bad_payloads(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    job = _mk_job(conn, a)
    for constraint, kwargs in [
        ("ck_application_stage", {"stage": "limbo"}),
        ("ck_application_version", {"version": 0}),
        ("ck_application_flag", {"flag": "urgent"}),
        ("ck_application_outcome", {"outcome": "removed"}),
        ("ck_application_outcome_reasons", {"outcome_reasons": '"nope"'}),
        (
            "ck_application_outcome_reasons",
            {"outcome_reasons": '["1","2","3","4","5","6","7","8","9"]'},
        ),
        ("ck_application_schema_version", {"schema_version": 0}),
    ]:
        nested = conn.begin_nested()
        with pytest.raises(DBAPIError, match=constraint):
            _mk_application(conn, a, job, **kwargs)  # type: ignore[arg-type]
        nested.rollback()


def test_transition_checks_reject_bad_payloads(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app = _mk_application(conn, a, _mk_job(conn, a))
    for constraint, kwargs in [
        ("ck_stage_transition_to_stage", {"to_stage": "limbo"}),
        ("ck_stage_transition_from_stage", {"from_stage": "limbo"}),
        ("ck_stage_transition_source", {"source": "robot"}),
        ("ck_stage_transition_seq_positive", {"seq": 0}),
        (
            "ck_stage_transition_reasons",
            {"reasons": '["1","2","3","4","5","6","7","8","9"]'},
        ),
    ]:
        nested = conn.begin_nested()
        with pytest.raises(DBAPIError, match=constraint):
            _mk_transition(conn, a, app, **kwargs)  # type: ignore[arg-type]
        nested.rollback()


def test_resume_checks_reject_bad_payloads(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    for constraint, kwargs in [
        ("ck_resume_tag", {"tag": "SHINY"}),
        ("ck_resume_used_in", {"used_in": -1}),
    ]:
        nested = conn.begin_nested()
        with pytest.raises(DBAPIError, match=constraint):
            _mk_resume(conn, a, **kwargs)  # type: ignore[arg-type]
        nested.rollback()


def test_defaults_applied(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    aid = _mk_application(conn, a, _mk_job(conn, a))
    row = conn.execute(
        text(
            "SELECT schema_version, created_at, version FROM application"
            " WHERE id = :id"
        ),
        {"id": aid},
    ).one()
    assert row[0] == 1
    assert row[1] is not None
    assert row[2] == 1


# --------------------------------------------- AC-01g dirty-data upgrade path


def test_upgrade_from_declared_parent_with_dirty_data() -> None:
    """PIN-8: a database at the declared parent (4317eb75f1cd) carrying
    representative rows (user/job/shortlist_entry) upgrades to head with the
    pre-existing rows intact. The five new tables are born empty, so the
    expand/backfill/validate dance is N/A -- this proves the upgrade is
    shippable over existing data, not just an empty database."""
    from app.core.config import settings

    dirty_db = "employa_migration_dirty_test"
    admin = create_engine(
        server_url(settings.POSTGRES_DB or settings.POSTGRES_USER),
        isolation_level="AUTOCOMMIT",
    )
    try:
        with admin.connect() as c:
            c.execute(text(f"DROP DATABASE IF EXISTS {dirty_db} WITH (FORCE)"))
            c.execute(text(f"CREATE DATABASE {dirty_db}"))

        def run_alembic(*args: str) -> None:
            result = subprocess.run(
                [sys.executable, "-m", "alembic", *args],
                cwd=BACKEND_DIR,
                env={**os.environ, "POSTGRES_DB": dirty_db},
                capture_output=True,
                text=True,
            )
            assert result.returncode == 0, (
                f"alembic {args} failed:\n{result.stdout}\n{result.stderr}"
            )

        run_alembic("upgrade", "4317eb75f1cd")  # the declared parent

        engine = create_engine(server_url(dirty_db))
        with engine.begin() as c:
            uid = _mk_user(c, f"dirty-{uuid.uuid4()}@example.com")
            jid = _mk_job(c, uid)
            c.execute(
                text(
                    "INSERT INTO shortlist_entry (id, user_id, job_id, company,"
                    " role, location, match, source) VALUES (:id, :uid, :jid,"
                    " 'S', 'E', 'R', 90, 'you')"
                ),
                {"id": uuid.uuid4(), "uid": uid, "jid": jid},
            )
        engine.dispose()

        run_alembic("upgrade", "head")

        engine = create_engine(server_url(dirty_db))
        with engine.connect() as c:
            assert c.execute(text('SELECT count(*) FROM "user"')).scalar() == 1
            assert c.execute(text("SELECT count(*) FROM job")).scalar() == 1
            assert (
                c.execute(text("SELECT count(*) FROM shortlist_entry")).scalar() == 1
            )
            for table in TABLES:
                assert (
                    c.execute(text(f"SELECT count(*) FROM {table}")).scalar() == 0  # noqa: S608
                ), table
        engine.dispose()
    finally:
        with admin.connect() as c:
            c.execute(text(f"DROP DATABASE IF EXISTS {dirty_db} WITH (FORCE)"))
        admin.dispose()
