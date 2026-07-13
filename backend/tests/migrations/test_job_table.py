"""The job-table exemplar migration, judged per binding convention.

One test (or parametrized group) per AC-01 sub-criterion in
docs/sprints/sprint-02-spec.md: introspection proves the schema shape,
negative inserts prove the named CHECKs bite, and the RLS group proves
row-level security is the enforcement mechanism -- raw SQL under the
``app_runtime`` role, no application route in the loop.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator

import pytest
from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import DBAPIError

VALID_LOCATION = '{"raw": "Remote - US"}'
VALID_EMPLOYMENT = (
    '{"classification": "w2", "cadence": "salary", "commitment": "full-time"}'
)
VALID_SOURCE = (
    '{"board": "greenhouse", "channel": "url", "capturedAt": "2026-07-13T00:00:00Z"}'
)
VALID_COMP = '{"min": 200000, "max": 250000, "extra": []}'


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


def _insert_job(
    conn: Connection,
    user_id: uuid.UUID,
    *,
    job_id: uuid.UUID | None = None,
    location: str = VALID_LOCATION,
    employment: str = VALID_EMPLOYMENT,
    source: str = VALID_SOURCE,
    compensation: str | None = VALID_COMP,
    match: str | None = None,
    tags: str | None = None,
    work_mode: str = "remote",
    schema_version: int = 1,
    source_url: str | None = None,
    override_user_in_row: uuid.UUID | None = None,
) -> uuid.UUID:
    jid = job_id or uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO job (id, user_id, company, title, location, work_mode,"
            " employment, compensation, source, source_url, posted, \"match\","
            " tags, schema_version)"
            " VALUES (:id, :user_id, 'Probe Co', 'Staff Engineer',"
            " CAST(:location AS jsonb), :work_mode, CAST(:employment AS jsonb),"
            " CAST(:compensation AS jsonb), CAST(:source AS jsonb), :source_url,"
            " now(), CAST(:match AS jsonb), CAST(:tags AS jsonb),"
            " :schema_version)"
        ),
        {
            "id": jid,
            "user_id": override_user_in_row or user_id,
            "location": location,
            "work_mode": work_mode,
            "employment": employment,
            "compensation": compensation,
            "source": source,
            "source_url": source_url,
            "match": match,
            "tags": tags,
            "schema_version": schema_version,
        },
    )
    return jid


@pytest.fixture()
def conn(scratch_engine: Engine) -> Generator[Connection]:
    """One rolled-back connection per test; two probe tenants pre-created."""
    with scratch_engine.connect() as connection:
        yield connection
        connection.rollback()


@pytest.fixture()
def tenants(conn: Connection) -> tuple[uuid.UUID, uuid.UUID]:
    return (
        _mk_user(conn, f"a-{uuid.uuid4()}@example.com"),
        _mk_user(conn, f"b-{uuid.uuid4()}@example.com"),
    )


# ------------------------------------------------- AC-01a composite unique


def test_composite_unique_user_id_id_exists(conn: Connection) -> None:
    cols = conn.execute(
        text(
            "SELECT array_agg(a.attname ORDER BY k.ord) FROM pg_constraint c"
            " JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)"
            "   ON true"
            " JOIN pg_attribute a ON a.attrelid = c.conrelid"
            "   AND a.attnum = k.attnum"
            " WHERE c.conname = 'uq_job_user_id_id' AND c.contype = 'u'"
            " GROUP BY c.oid"
        )
    ).scalar()
    assert cols == ["user_id", "id"]


# ------------------------------------------- AC-01b tenant user_id NOT NULL


def test_user_id_not_null_fk(conn: Connection) -> None:
    nullable = conn.execute(
        text(
            "SELECT is_nullable FROM information_schema.columns"
            " WHERE table_name = 'job' AND column_name = 'user_id'"
        )
    ).scalar()
    assert nullable == "NO"
    fk_target = conn.execute(
        text(
            "SELECT confrelid::regclass::text FROM pg_constraint"
            " WHERE conrelid = 'job'::regclass AND contype = 'f'"
        )
    ).scalar()
    assert fk_target == '"user"'


def test_unknown_user_id_rejected(conn: Connection) -> None:
    with pytest.raises(DBAPIError, match="foreign key"):
        _insert_job(conn, uuid.uuid4())


# ------------------------------------------------------------- AC-01c RLS


def test_rls_enabled_forced_policy_present_owner_not_runtime(
    conn: Connection,
) -> None:
    row = conn.execute(
        text(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class"
            " WHERE relname = 'job'"
        )
    ).one()
    assert row == (True, True)
    policy = conn.execute(
        text(
            "SELECT polname FROM pg_policy"
            " WHERE polrelid = 'job'::regclass"
        )
    ).scalar()
    assert policy == "job_tenant_isolation"
    owner = conn.execute(
        text("SELECT tableowner FROM pg_tables WHERE tablename = 'job'")
    ).scalar()
    assert owner != "app_runtime"


def test_rls_filters_without_any_where_clause(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """The backstop property: under app_runtime, an unfiltered SELECT only
    sees the GUC tenant's rows."""
    a, b = tenants
    a_job = _insert_job(conn, a)
    _insert_job(conn, b)

    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(
        text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)}
    )
    rows = conn.execute(text("SELECT id, user_id FROM job")).all()
    assert [(r[0], r[1]) for r in rows] == [(a_job, a)]


def test_rls_yields_zero_rows_without_the_guc(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    _insert_job(conn, a)
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    assert conn.execute(text("SELECT count(*) FROM job")).scalar() == 0


def test_rls_with_check_rejects_cross_tenant_insert(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    conn.execute(text("SET LOCAL ROLE app_runtime"))
    conn.execute(
        text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(a)}
    )
    with pytest.raises(DBAPIError, match="row-level security"):
        _insert_job(conn, b)


# ----------------------------------------------------- AC-01d/e time+money


def test_all_timestamp_columns_are_timestamptz(conn: Connection) -> None:
    offenders = conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns"
            " WHERE table_name = 'job'"
            " AND data_type = 'timestamp without time zone'"
        )
    ).all()
    assert offenders == []
    tz_cols = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns"
                " WHERE table_name = 'job'"
                " AND data_type = 'timestamp with time zone'"
            )
        )
    }
    assert tz_cols == {"posted", "created_at"}


def test_no_floating_or_money_scalar_columns(conn: Connection) -> None:
    """PIN-6: compensation is JSONB Salary by convention; the table must not
    smuggle a float/real/money scalar."""
    offenders = conn.execute(
        text(
            "SELECT column_name, data_type FROM information_schema.columns"
            " WHERE table_name = 'job'"
            " AND data_type IN ('real', 'double precision', 'money')"
        )
    ).all()
    assert offenders == []


# ------------------------------------------------- AC-01f named JSONB CHECKs


def test_named_checks_exist(conn: Connection) -> None:
    names = {
        r[0]
        for r in conn.execute(
            text(
                "SELECT conname FROM pg_constraint"
                " WHERE conrelid = 'job'::regclass AND contype = 'c'"
            )
        )
    }
    assert {
        "ck_job_location_shape",
        "ck_job_employment_shape",
        "ck_job_compensation_shape",
        "ck_job_source_shape",
        "ck_job_match_shape",
        "ck_job_tags_array",
        "ck_job_requirements_array",
        "ck_job_work_mode",
        "ck_job_schema_version",
    } <= names


@pytest.mark.parametrize(
    ("constraint", "kwargs"),
    [
        ("ck_job_location_shape", {"location": '"just a string"'}),
        ("ck_job_location_shape", {"location": '{"city": "Lexington"}'}),
        ("ck_job_location_shape", {"location": '{"raw": 42}'}),
        ("ck_job_employment_shape", {"employment": '{"classification": "w2"}'}),
        (
            "ck_job_employment_shape",
            {
                "employment": '{"classification": "volunteer",'
                ' "cadence": "salary", "commitment": "full-time"}'
            },
        ),
        ("ck_job_compensation_shape", {"compensation": "[]"}),
        ("ck_job_compensation_shape", {"compensation": '{"extra": []}'}),
        (
            "ck_job_compensation_shape",
            {"compensation": '{"value": "lots", "extra": []}'},
        ),
        (
            "ck_job_source_shape",
            {
                "source": '{"board": "greenhouse", "channel": "carrier-pigeon",'
                ' "capturedAt": "2026-07-13T00:00:00Z"}'
            },
        ),
        (
            "ck_job_source_shape",
            {"source": '{"board": "greenhouse", "channel": "url"}'},
        ),
        ("ck_job_match_shape", {"match": '{"strengths": []}'}),
        ("ck_job_tags_array", {"tags": '{"tag": "python"}'}),
        ("ck_job_work_mode", {"work_mode": "vanlife"}),
        ("ck_job_schema_version", {"schema_version": 0}),
    ],
)
def test_named_checks_reject_bad_payloads(
    conn: Connection,
    tenants: tuple[uuid.UUID, uuid.UUID],
    constraint: str,
    kwargs: dict[str, str | int],
) -> None:
    a, _ = tenants
    with pytest.raises(DBAPIError, match=constraint):
        _insert_job(conn, a, **kwargs)  # type: ignore[arg-type]


def test_valid_insert_accepted(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    """Sanity for the negatives: the canonical happy row inserts."""
    a, _ = tenants
    jid = _insert_job(
        conn, a, match='{"score": 92, "strengths": [], "gaps": []}', tags="[]"
    )
    assert (
        conn.execute(
            text("SELECT count(*) FROM job WHERE id = :id"), {"id": jid}
        ).scalar()
        == 1
    )


# ------------------------------------------- AC-01g partial-unique dedup idx


def test_dedup_index_is_partial_on_source_url(conn: Connection) -> None:
    indexdef = conn.execute(
        text(
            "SELECT indexdef FROM pg_indexes"
            " WHERE tablename = 'job' AND indexname = 'uq_job_user_source_url'"
        )
    ).scalar()
    assert indexdef is not None
    assert "UNIQUE" in indexdef
    assert "(user_id, source_url)" in indexdef
    assert "WHERE (source_url IS NOT NULL)" in indexdef


def test_dedup_index_behavior(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, b = tenants
    url = "https://boards.example.com/probe/1"
    _insert_job(conn, a, source_url=url)
    # Same URL, other tenant: allowed (dedup is per-user).
    _insert_job(conn, b, source_url=url)
    # NULL URLs never collide (manual captures are not deduped).
    _insert_job(conn, a, source_url=None)
    _insert_job(conn, a, source_url=None)
    with pytest.raises(DBAPIError, match="uq_job_user_source_url"):
        _insert_job(conn, a, source_url=url)


# --------------------------------------------------- AC-01h schema_version


def test_schema_version_defaults_to_one(
    conn: Connection, tenants: tuple[uuid.UUID, uuid.UUID]
) -> None:
    a, _ = tenants
    jid = uuid.uuid4()
    conn.execute(
        text(
            "INSERT INTO job (id, user_id, company, title, location, work_mode,"
            " employment, source, posted)"
            " VALUES (:id, :user_id, 'Probe Co', 'Staff Engineer',"
            " CAST(:location AS jsonb), 'remote', CAST(:employment AS jsonb),"
            " CAST(:source AS jsonb), now())"
        ),
        {
            "id": jid,
            "user_id": a,
            "location": VALID_LOCATION,
            "employment": VALID_EMPLOYMENT,
            "source": VALID_SOURCE,
        },
    )
    row = conn.execute(
        text("SELECT schema_version, created_at FROM job WHERE id = :id"),
        {"id": jid},
    ).one()
    assert row[0] == 1
    assert row[1] is not None
