"""The stage-mutation function's privilege boundary + teardown helper
(7a2c91d40e88, sprint-04 3b spec PIN-1/PIN-11).

Mirrors ``test_sprint04_tables.py``'s scratch_engine world and owner-SQL
helpers. Covers what that migration-gate file does NOT: EXECUTE privilege on
the three functions (PIN-19: app_runtime gets the two runtime-facing
functions, never ``delete_user_with_history``), the teardown helper
end-to-end (cross-tenant isolation + append-only triggers re-enabled
afterward), and the function's fail-closed GUC requirement (EMP00).

``application_stage_transition``'s transactional/locking/atomicity behavior
itself is covered at the route layer in
``tests/api/routes/test_transitions.py`` (AC-04a/b/c) -- this file is the
function's OWN privilege surface and the two smaller helper functions.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

VALID_JOB_LOCATION = '{"raw": "Remote - US"}'
VALID_JOB_EMPLOYMENT = (
    '{"classification": "w2", "cadence": "salary", "commitment": "full-time"}'
)
VALID_JOB_SOURCE = (
    '{"board": "greenhouse", "channel": "url", "capturedAt": "2026-07-13T00:00:00Z"}'
)


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
            "INSERT INTO resume (id, user_id, name, subtitle, version, used_in, tag)"
            " VALUES (:id, :uid, 'Probe Resume', 'sub', 'v1', 0, 'DRAFT')"
        ),
        {"id": rid, "uid": user_id},
    )
    return rid


def _mk_application(
    conn: Connection, user_id: uuid.UUID, job_id: uuid.UUID, *, stage: str = "drafting"
) -> uuid.UUID:
    aid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO application (id, user_id, job_id, stage, version)"
            " VALUES (:id, :uid, :jid, :stage, 1)"
        ),
        {"id": aid, "uid": user_id, "jid": job_id, "stage": stage},
    )
    return aid


def _mk_transition(
    conn: Connection,
    user_id: uuid.UUID,
    application_id: uuid.UUID,
    *,
    seq: int = 1,
    to_stage: str = "applied",
) -> uuid.UUID:
    tid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO stage_transition (id, user_id, application_id, seq,"
            " from_stage, to_stage, source)"
            " VALUES (:id, :uid, :aid, :seq, 'drafting', :to_stage, 'user')"
        ),
        {
            "id": tid,
            "uid": user_id,
            "aid": application_id,
            "seq": seq,
            "to_stage": to_stage,
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


# --------------------------------------- PIN-19 EXECUTE privilege matrix


def test_execute_privilege_matrix(conn: Connection) -> None:
    """app_runtime gets EXECUTE on the two runtime-facing functions but NOT
    on delete_user_with_history (owner/admin-path only, PIN-11)."""
    expected = {
        "application_stage_transition": True,
        "application_soft_remove": True,
        "delete_user_with_history": False,
    }
    for fn_name, granted in expected.items():
        oid = conn.execute(
            text("SELECT oid FROM pg_proc WHERE proname = :n"), {"n": fn_name}
        ).scalar()
        assert oid is not None, f"function {fn_name} does not exist"
        actual = conn.execute(
            text("SELECT has_function_privilege('app_runtime', :oid, 'EXECUTE')"),
            {"oid": oid},
        ).scalar()
        assert actual is granted, f"{fn_name}: expected EXECUTE={granted}"


def test_delete_user_with_history_refused_under_app_runtime(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Behavioral proof backing the introspection above: app_runtime cannot
    call delete_user_with_history even against its own tenant."""
    a, _ = tenants
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="permission denied"):
        conn.execute(text("SELECT delete_user_with_history(:uid)"), {"uid": a})


# --------------------------------------- PIN-11 delete_user_with_history


def test_delete_user_with_history_end_to_end(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Two tenants, each with a full job/resume/application/transition/
    snapshot graph (owner inserts). Deleting tenant A via the function
    removes every one of A's rows and leaves B's completely intact, and the
    append-only triggers are re-enabled afterward (an owner UPDATE on
    stage_transition still raises)."""
    a, b = tenants

    def _build(uid: uuid.UUID) -> dict[str, uuid.UUID]:
        job = _mk_job(conn, uid)
        resume = _mk_resume(conn, uid)
        app_id = _mk_application(conn, uid, job, stage="applied")
        tr = _mk_transition(conn, uid, app_id)
        snap = _mk_snapshot(conn, uid, app_id, resume)
        return {"job": job, "resume": resume, "app": app_id, "tr": tr, "snap": snap}

    a_rows = _build(a)
    b_rows = _build(b)

    conn.execute(text("SELECT delete_user_with_history(:uid)"), {"uid": a})

    assert (
        conn.execute(
            text('SELECT count(*) FROM "user" WHERE id = :uid'), {"uid": a}
        ).scalar()
        == 0
    )
    for table, row_id in (
        ("job", a_rows["job"]),
        ("resume", a_rows["resume"]),
        ("application", a_rows["app"]),
        ("stage_transition", a_rows["tr"]),
        ("resume_snapshot", a_rows["snap"]),
    ):
        assert (
            conn.execute(
                text(f"SELECT count(*) FROM {table} WHERE id = :id"),  # noqa: S608
                {"id": row_id},
            ).scalar()
            == 0
        ), f"{table}: A's row survived"

    assert (
        conn.execute(
            text('SELECT count(*) FROM "user" WHERE id = :uid'), {"uid": b}
        ).scalar()
        == 1
    )
    for table, row_id in (
        ("job", b_rows["job"]),
        ("resume", b_rows["resume"]),
        ("application", b_rows["app"]),
        ("stage_transition", b_rows["tr"]),
        ("resume_snapshot", b_rows["snap"]),
    ):
        assert (
            conn.execute(
                text(f"SELECT count(*) FROM {table} WHERE id = :id"),  # noqa: S608
                {"id": row_id},
            ).scalar()
            == 1
        ), f"{table}: B's row did not survive"

    # append-only triggers are re-enabled -- not left disabled after teardown.
    with pytest.raises(DBAPIError, match="append-only"):
        conn.execute(
            text("UPDATE stage_transition SET schema_version = 2 WHERE id = :id"),
            {"id": b_rows["tr"]},
        )


# --------------------------------------- fail-closed GUC requirement


def test_stage_transition_requires_guc(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Calling the function under app_runtime WITHOUT the app.user_id GUC
    set raises EMP00 (fail closed, never a silent no-tenant write)."""
    a, _ = tenants
    app_id = _mk_application(conn, a, _mk_job(conn, a))
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    with pytest.raises(DBAPIError, match="GUC"):
        conn.execute(
            text(
                "SELECT application_stage_transition("
                " p_application_id => :aid, p_target_stage => 'dismissed',"
                " p_allowed_from => ARRAY['drafting'])"
            ),
            {"aid": app_id},
        )


def test_soft_remove_requires_guc(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app_id = _mk_application(conn, a, _mk_job(conn, a))
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    with pytest.raises(DBAPIError, match="GUC"):
        conn.execute(
            text("SELECT application_soft_remove(:aid)"),
            {"aid": app_id},
        )


# --------------------------------------- application_soft_remove (PIN-14)


def test_soft_remove_sets_removed_at_for_precommit_stage(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app_id = _mk_application(conn, a, _mk_job(conn, a), stage="drafting")
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    conn.execute(text("SELECT application_soft_remove(:aid)"), {"aid": app_id})
    removed_at = conn.execute(
        text("SELECT removed_at FROM application WHERE id = :id"), {"id": app_id}
    ).scalar()
    assert removed_at is not None


def test_soft_remove_refuses_post_commit_stage(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    app_id = _mk_application(conn, a, _mk_job(conn, a), stage="applied")
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="EMP04|not found"):
        conn.execute(text("SELECT application_soft_remove(:aid)"), {"aid": app_id})


def test_soft_remove_cross_tenant_is_not_found(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_app = _mk_application(conn, b, _mk_job(conn, b), stage="drafting")
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="EMP04|not found"):
        conn.execute(text("SELECT application_soft_remove(:aid)"), {"aid": b_app})
