"""The shortlist_entry child-exemplar migration, per binding convention.

Mirrors test_job_table.py (the parent exemplar) and adds the NET-NEW child
mechanics: the composite FK (user_id, job_id) -> job(user_id, id) rejecting a
cross-tenant job_id, and the PARTIAL dedup unique(user_id, job_id) WHERE
job_id IS NOT NULL. RLS is proven under the app_runtime role with raw SQL, no
route in the loop.
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
VALID_SALARY = '{"min": 200000, "max": 250000, "extra": []}'


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


def _insert_entry(
    conn: Connection,
    user_id: uuid.UUID,
    *,
    job_id: uuid.UUID | None = None,
    salary: str | None = VALID_SALARY,
    source: str = "you",
    schema_version: int = 1,
) -> uuid.UUID:
    eid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO shortlist_entry (id, user_id, job_id, company, role,"
            " location, salary, match, source, schema_version)"
            " VALUES (:id, :uid, :jid, 'Stripe', 'Staff Engineer', 'Remote',"
            " CAST(:salary AS jsonb), 92, :source, :sv)"
        ),
        {
            "id": eid,
            "uid": user_id,
            "jid": job_id,
            "salary": salary,
            "source": source,
            "sv": schema_version,
        },
    )
    return eid


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


# --------------------------------------------- AC-01a anchor + tenant user_id


def test_composite_unique_anchor_exists(conn: Connection) -> None:
    cols = conn.execute(
        text(
            "SELECT array_agg(a.attname ORDER BY k.ord) FROM pg_constraint c"
            " JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)"
            "   ON true"
            " JOIN pg_attribute a ON a.attrelid = c.conrelid"
            "   AND a.attnum = k.attnum"
            " WHERE c.conname = 'uq_shortlist_user_id_id' AND c.contype = 'u'"
            " GROUP BY c.oid"
        )
    ).scalar()
    assert cols == ["user_id", "id"]


def test_user_id_not_null_cascade(conn: Connection) -> None:
    nullable = conn.execute(
        text(
            "SELECT is_nullable FROM information_schema.columns"
            " WHERE table_name = 'shortlist_entry' AND column_name = 'user_id'"
        )
    ).scalar()
    assert nullable == "NO"
    deltype = conn.execute(
        text(
            "SELECT confdeltype FROM pg_constraint"
            " WHERE conname = 'shortlist_entry_user_id_fkey'"
        )
    ).scalar()
    assert deltype == "c"  # CASCADE


# ---------------------------------------------- AC-02 composite FK to parent


def test_composite_fk_rejects_cross_tenant_job(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    b_job = _mk_job(conn, b)
    # a tries to shortlist b's job -> composite FK (a, b_job) has no match
    with pytest.raises(DBAPIError, match="fk_shortlist_job|foreign key"):
        _insert_entry(conn, a, job_id=b_job)


def test_composite_fk_accepts_own_job(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    a_job = _mk_job(conn, a)
    eid = _insert_entry(conn, a, job_id=a_job)
    assert (
        conn.execute(
            text("SELECT count(*) FROM shortlist_entry WHERE id = :id"), {"id": eid}
        ).scalar()
        == 1
    )


def test_null_job_id_accepted_fk_skipped(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    _insert_entry(conn, a, job_id=None)  # MATCH SIMPLE skips the FK on NULL


def test_composite_fk_is_the_backstop_under_app_runtime(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """The FK refuses a cross-tenant job_id under the RUNTIME role too (D2-2):
    the route's app-level pre-check is the belt, but if it were dropped the DB
    must still refuse. Insert directly under app_runtime + the caller's GUC,
    bypassing any route logic."""
    a, b = tenants
    b_job = _mk_job(conn, b)  # created as owner, before the role switch
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    # a (the GUC tenant) shortlists b's job: (a, b_job) is not in job, so the
    # composite FK refuses regardless of RLS visibility.
    with pytest.raises(DBAPIError, match="fk_shortlist_job|foreign key"):
        _insert_entry(conn, a, job_id=b_job)


# --------------------------------------------- AC-02b partial dedup


def test_dedup_index_is_partial_on_job_id(conn: Connection) -> None:
    indexdef = conn.execute(
        text(
            "SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_shortlist_user_job'"
        )
    ).scalar()
    assert indexdef is not None
    assert "UNIQUE" in indexdef
    assert "(user_id, job_id)" in indexdef
    assert "WHERE (job_id IS NOT NULL)" in indexdef


def test_dedup_rejects_duplicate_job_allows_nulls(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    a_job = _mk_job(conn, a)
    _insert_entry(conn, a, job_id=a_job)
    # two NULL-job rows: both allowed (display-only, not deduped)
    _insert_entry(conn, a, job_id=None)
    _insert_entry(conn, a, job_id=None)
    # same (user, job): rejected
    with pytest.raises(DBAPIError, match="uq_shortlist_user_job"):
        _insert_entry(conn, a, job_id=a_job)


# ------------------------------------------------------- AC-01b RLS


def test_rls_enabled_forced_owner_not_runtime(conn: Connection) -> None:
    row = conn.execute(
        text(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname = 'shortlist_entry'"
        )
    ).one()
    assert row == (True, True)
    policy = conn.execute(
        text(
            "SELECT polname FROM pg_policy WHERE polrelid = 'shortlist_entry'::regclass"
        )
    ).scalar()
    assert policy == "shortlist_tenant_isolation"
    owner = conn.execute(
        text("SELECT tableowner FROM pg_tables WHERE tablename = 'shortlist_entry'")
    ).scalar()
    assert owner != "app_runtime"


def test_rls_filters_without_where(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    a_entry = _insert_entry(conn, a, job_id=None)
    _insert_entry(conn, b, job_id=None)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    rows = conn.execute(text("SELECT id FROM shortlist_entry")).all()
    assert [r[0] for r in rows] == [a_entry]


def test_rls_zero_rows_without_guc(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    _insert_entry(conn, a, job_id=None)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    assert conn.execute(text("SELECT count(*) FROM shortlist_entry")).scalar() == 0


def test_rls_with_check_rejects_cross_tenant_insert(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)})
    with pytest.raises(DBAPIError, match="row-level security"):
        _insert_entry(conn, b, job_id=None)


# --------------------------------------------- AC-01c/d timestamptz + JSONB


def test_saved_is_timestamptz(conn: Connection) -> None:
    dt = conn.execute(
        text(
            "SELECT data_type FROM information_schema.columns"
            " WHERE table_name = 'shortlist_entry' AND column_name = 'saved'"
        )
    ).scalar()
    assert dt == "timestamp with time zone"
    offenders = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_name = 'shortlist_entry'"
            " AND data_type = 'timestamp without time zone'"
        )
    ).all()
    assert offenders == []


def test_named_checks_exist(conn: Connection) -> None:
    """The named CHECKs are actually on the table (D2-4: introspect, don't
    infer from negative inserts alone)."""
    names = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT conname FROM pg_constraint"
                " WHERE conrelid = 'shortlist_entry'::regclass AND contype = 'c'"
            )
        )
    }
    assert {
        "ck_shortlist_salary_shape",
        "ck_shortlist_source",
        "ck_shortlist_schema_version",
    } <= names


@pytest.mark.parametrize(
    ("constraint", "kwargs"),
    [
        ("ck_shortlist_salary_shape", {"salary": "[]"}),
        ("ck_shortlist_salary_shape", {"salary": '{"value": "lots", "extra": []}'}),
        # jsonb 'null' literal: SQL-not-null but jsonb-null -- the IS TRUE
        # wrapping must still reject it (D2-4; distinct from SQL NULL, which is
        # a legal absent salary).
        ("ck_shortlist_salary_shape", {"salary_raw": "'null'::jsonb"}),
        ("ck_shortlist_source", {"source": "robot"}),
        ("ck_shortlist_schema_version", {"schema_version": 0}),
    ],
)
def test_named_checks_reject_bad_payloads(
    conn: Connection,
    tenants: tuple[uuid.UUID, uuid.UUID],
    constraint: str,
    kwargs: dict[str, object],
) -> None:
    a, _ = tenants
    if "salary_raw" in kwargs:
        # A jsonb 'null' cannot go through the parametrized-CAST helper (that
        # would send SQL NULL), so insert it as a raw literal.
        with pytest.raises(DBAPIError, match=constraint):
            conn.execute(
                text(
                    "INSERT INTO shortlist_entry (id, user_id, company, role,"
                    " location, salary, match, source) VALUES"
                    f" (:id, :uid, 'S', 'E', 'R', {kwargs['salary_raw']}, 90, 'you')"
                ),
                {"id": uuid.uuid4(), "uid": a},
            )
        return
    with pytest.raises(DBAPIError, match=constraint):
        _insert_entry(conn, a, job_id=None, **kwargs)  # type: ignore[arg-type]


def test_schema_version_defaults_to_one(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    eid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO shortlist_entry (id, user_id, company, role, location,"
            " match, source) VALUES (:id, :uid, 'Stripe', 'Eng', 'Remote', 90,"
            " 'you')"
        ),
        {"id": eid, "uid": a},
    )
    row = conn.execute(
        text("SELECT schema_version, saved FROM shortlist_entry WHERE id = :id"),
        {"id": eid},
    ).one()
    assert row[0] == 1
    assert row[1] is not None
