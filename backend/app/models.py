import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from pydantic import EmailStr
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    initials: str | None = Field(default=None, max_length=8)
    city: str | None = Field(default=None, max_length=255)
    current: str | None = Field(default=None, max_length=255)
    years: float | None = Field(default=None)
    comp_floor: float | None = Field(default=None)
    target_titles: list[str] = Field(
        default_factory=list,
        sa_type=ARRAY(String),  # type: ignore
    )


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    # Bumping invalidates every outstanding token for this user (JWT sv claim).
    session_version: int = Field(default=0, nullable=False)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class Job(SQLModel, table=True):
    """A captured posting (ADR-006 canonical collection) -- the first tenant
    table, and the exemplar for plan v3's binding Design conventions.

    Every convention decision is pinned in ``docs/sprints/sprint-02-spec.md``
    (PIN-2..PIN-7): tenant ``user_id`` + composite ``UNIQUE(user_id, id)`` as
    the composite-FK anchor for child tables, FORCE row-level security under
    the ``app_runtime`` role (policy lives in the migration), ``timestamptz``
    timestamps, named JSONB CHECKs for the opaque wire sub-objects, an
    explicit ``schema_version``, and the partial-unique dedup index on
    ``(user_id, source_url)`` reserved for captureJob. ``source_url`` is
    normalized out of the ``source`` document because the dedup constraint
    needs a column. Wire mapping (schemas.Job <-> this row) lives in
    ``app/job_mapper.py``.

    Named-CHECK bodies are wrapped in ``(...) IS TRUE`` because a bare CHECK
    treats NULL as satisfied -- a missing JSONB key yields NULL, which would
    otherwise slip through.
    """

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_job_user_id_id"),
        CheckConstraint(
            "(jsonb_typeof(location) = 'object'"
            " AND jsonb_typeof(location->'raw') = 'string'"
            " AND (NOT location ? 'locality'"
            "      OR jsonb_typeof(location->'locality') IN ('string', 'null'))"
            " AND (NOT location ? 'region'"
            "      OR jsonb_typeof(location->'region') IN ('string', 'null'))"
            " AND (NOT location ? 'country'"
            "      OR jsonb_typeof(location->'country') IN ('string', 'null'))"
            ") IS TRUE",
            name="ck_job_location_shape",
        ),
        CheckConstraint(
            "(jsonb_typeof(employment) = 'object'"
            " AND employment->>'classification' IN ('w2', 'contract', '1099')"
            " AND employment->>'cadence' IN ('hourly', 'salary')"
            " AND employment->>'commitment' IN ('full-time', 'part-time')"
            ") IS TRUE",
            name="ck_job_employment_shape",
        ),
        CheckConstraint(
            "compensation IS NULL OR ("
            "jsonb_typeof(compensation) = 'object'"
            " AND jsonb_typeof(compensation->'extra') = 'array'"
            " AND (jsonb_typeof(compensation->'value') = 'number'"
            "      OR (jsonb_typeof(compensation->'min') = 'number'"
            "          AND jsonb_typeof(compensation->'max') = 'number'))"
            ") IS TRUE",
            name="ck_job_compensation_shape",
        ),
        CheckConstraint(
            "(jsonb_typeof(source) = 'object'"
            " AND jsonb_typeof(source->'board') = 'string'"
            " AND source->>'channel' IN"
            "     ('url', 'jd-text', 'extension', 'email-forward')"
            " AND jsonb_typeof(source->'capturedAt') = 'string'"
            ") IS TRUE",
            name="ck_job_source_shape",
        ),
        CheckConstraint(
            '"match" IS NULL OR ('
            "jsonb_typeof(\"match\") = 'object'"
            " AND jsonb_typeof(\"match\"->'score') = 'number'"
            ") IS TRUE",
            name="ck_job_match_shape",
        ),
        CheckConstraint(
            "tags IS NULL OR jsonb_typeof(tags) = 'array' IS TRUE",
            name="ck_job_tags_array",
        ),
        CheckConstraint(
            "requirements IS NULL OR jsonb_typeof(requirements) = 'array' IS TRUE",
            name="ck_job_requirements_array",
        ),
        CheckConstraint(
            "work_mode IN ('remote', 'hybrid', 'onsite')",
            name="ck_job_work_mode",
        ),
        CheckConstraint("schema_version >= 1", name="ck_job_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # ondelete CASCADE: a tenant's rows die with the tenant. This is the
    # convention for every tenant-child FK (sprint-02 spec SIM-2) -- it keeps
    # user teardown a single DELETE instead of an ordered manual chain that
    # grows with each child table.
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    company: str
    title: str
    location: dict[str, Any] = Field(sa_type=JSONB)
    work_mode: str
    employment: dict[str, Any] = Field(sa_type=JSONB)
    compensation: dict[str, Any] | None = Field(
        default=None,
        # none_as_null: an absent document is SQL NULL, never jsonb 'null'
        # (psycopg would otherwise send Jsonb(None) and trip the named CHECK).
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    seniority: str | None = None
    source: dict[str, Any] = Field(sa_type=JSONB)
    source_url: str | None = Field(default=None)
    is_new: bool | None = None
    posted: datetime = Field(sa_type=DateTime(timezone=True))  # type: ignore
    summary: str | None = None
    tags: list[str] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    requirements: list[str] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    description: str | None = None
    match: dict[str, Any] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )


class ShortlistEntry(SQLModel, table=True):
    """A saved (shortlisted) job -- the FIRST child table that composite-FKs a
    parent (``job``). The exemplar sprint-04's children copy
    (docs/sprints/sprint-03-spec.md).

    Copies the job exemplar's tenancy (PR-1..PR-4): tenant ``user_id`` with a
    composite ``UNIQUE(user_id, id)`` anchor + ``ON DELETE CASCADE``, FORCE
    row-level security (policy in the migration), ``timestamptz``, named
    ``(...) IS TRUE``-wrapped JSONB CHECKs, ``schema_version``.

    NET-NEW here (PIN-1/PIN-2): ``job_id`` is NULLABLE (the wire ``jobId`` is
    optional) with a composite FK ``(user_id, job_id) -> job(user_id, id)``
    (MATCH SIMPLE: enforced only when ``job_id`` is non-null, so a cross-tenant
    job_id fails at the DB) and a PARTIAL dedup index
    ``UNIQUE(user_id, job_id) WHERE job_id IS NOT NULL``. Display fields are a
    client-supplied snapshot at save (PIN-4). The composite FK, partial index,
    and RLS live only in the migration (raw ``op.execute``), not here -- DEBT-6.
    """

    __tablename__ = "shortlist_entry"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_shortlist_user_id_id"),
        CheckConstraint(
            "salary IS NULL OR ("
            "jsonb_typeof(salary) = 'object'"
            " AND jsonb_typeof(salary->'extra') = 'array'"
            " AND (jsonb_typeof(salary->'value') = 'number'"
            "      OR (jsonb_typeof(salary->'min') = 'number'"
            "          AND jsonb_typeof(salary->'max') = 'number'))"
            ") IS TRUE",
            name="ck_shortlist_salary_shape",
        ),
        CheckConstraint("source IN ('you')", name="ck_shortlist_source"),
        CheckConstraint("schema_version >= 1", name="ck_shortlist_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    # Nullable (wire jobId is optional). The composite FK to job(user_id, id)
    # + partial dedup index are added in the migration, not here.
    job_id: uuid.UUID | None = Field(default=None)
    company: str
    role: str
    location: str
    salary: dict[str, Any] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    match: int
    saved: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    source: str = Field(default="you")
    why: str | None = None
    stale: bool | None = None
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


_STAGE_VALUES = (
    "'saved', 'drafting', 'applied', 'screening', 'interview', 'offer',"
    " 'won', 'rejected', 'ghosted', 'withdrew', 'dismissed', 'offer_rescinded'"
)


class Resume(SQLModel, table=True):
    """Minimal resume (sprint-04 3a, plan v3 Phase B item 3): just enough for
    the journey -- CRUD, the DEFAULT swap, and the APPLIED lock. Full resume
    management (uploads/templates/projections/exports) is Release 0.2; their
    ids stay plain uuid columns with NO FK (mock entities, spec PIN-18).

    Lock semantics (PIN-17): ``used_in > 0`` or tag in {TAILORED, MASTER,
    DEFAULT} refuses deleteResume app-side (409 resume-lock-conflict); the
    resume_snapshot/application composite FKs are the DB backstop. The
    at-most-one-DEFAULT-per-user invariant is a partial unique index in the
    migration (uq_resume_user_default, PIN-5). ``fork_job_id`` carries the
    forkResumeAsDraft provenance with a composite FK to job (migration-only,
    DEBT-6). Wire mapping in ``app/resume_mapper.py``; wire ``version`` is a
    display STRING (unlike Application.version).
    """

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_resume_user_id_id"),
        CheckConstraint(
            "tag IN ('MASTER', 'DEFAULT', 'VARIANT', 'TAILORED', 'DRAFT', 'FORMAT')",
            name="ck_resume_tag",
        ),
        CheckConstraint("used_in >= 0", name="ck_resume_used_in"),
        CheckConstraint("schema_version >= 1", name="ck_resume_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    name: str
    subtitle: str
    version: str
    used_in: int = Field(default=0, nullable=False)
    updated: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    tag: str
    match: int | None = None
    body: str | None = None
    source_upload_id: uuid.UUID | None = Field(default=None)
    template_id: uuid.UUID | None = Field(default=None)
    target_role: str | None = None
    scoring_enabled: bool | None = None
    fork_job_id: uuid.UUID | None = Field(default=None)
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class Application(SQLModel, table=True):
    """An application (sprint-04, plan v3 Phase B item 3). Copies the job/
    shortlist exemplars (tenant user_id + CASCADE, UNIQUE(user_id, id) anchor,
    FORCE RLS in the migration, timestamptz, schema_version).

    ``stage``/``version``/outcome fields are mutated ONLY by the single
    stage-mutation DB function (spec PIN-1/PIN-19; app_runtime has no UPDATE
    on this table). ``removed_at`` is the internal soft-remove for pre-commit
    dismiss (PIN-14; never on the wire -- runtime hard-deletes are impossible
    under append-only children). ``search_id`` has NO FK (searches stay mock
    through 0.1, PIN-18). Composite FKs to job/resume/resume_snapshot live in
    the migration (DEBT-6). Wire mapping in ``app/application_mapper.py``.
    """

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_application_user_id_id"),
        CheckConstraint(f"stage IN ({_STAGE_VALUES})", name="ck_application_stage"),
        CheckConstraint("version >= 1", name="ck_application_version"),
        CheckConstraint(
            "flag IS NULL OR flag IN ('stale', 'offer')",
            name="ck_application_flag",
        ),
        CheckConstraint(
            "outcome IS NULL OR outcome IN ('won', 'rejected', 'withdrawn')",
            name="ck_application_outcome",
        ),
        CheckConstraint(
            "outcome_reasons IS NULL OR (jsonb_typeof(outcome_reasons) = 'array'"
            " AND jsonb_array_length(outcome_reasons) <= 8) IS TRUE",
            name="ck_application_outcome_reasons",
        ),
        CheckConstraint(
            "system_reasons IS NULL OR jsonb_typeof(system_reasons) = 'array' IS TRUE",
            name="ck_application_system_reasons",
        ),
        CheckConstraint("schema_version >= 1", name="ck_application_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    job_id: uuid.UUID = Field(nullable=False)
    resume_id: uuid.UUID | None = Field(default=None)
    stage: str
    version: int = Field(default=1, nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    flag: str | None = None
    contact: str | None = None
    coach_nudge: bool | None = None
    resurrected: bool | None = None
    outcome: str | None = None
    outcome_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    outcome_reason: str | None = None
    outcome_reasons: list[str] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    system_reasons: list[str] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    submitted_snapshot_id: uuid.UUID | None = Field(default=None)
    search_id: uuid.UUID | None = Field(default=None)
    removed_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class StageTransition(SQLModel, table=True):
    """Append-only stage history (sprint-04 3b, v3 Data-integrity #3/#4/#8).

    enforce_append_only + PIN-19 in the migration make this table SELECT-only
    for app_runtime: rows are written exclusively by the stage-mutation DB
    function (owner-owned SECURITY DEFINER). ``seq`` is per-application
    monotonic under the function's row lock (UNIQUE(user_id, application_id,
    seq)). Undo writes a compensating row (source='user_correction' +
    corrects_transition_id), never deletes (PIN-3). ``resume_id`` carries the
    composite FK to resume like every other DB-entity reference (D2-1;
    migration-only, MATCH SIMPLE) on top of the function's write-time check.
    """

    __tablename__ = "stage_transition"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_stage_transition_user_id_id"),
        UniqueConstraint(
            "user_id", "application_id", "seq", name="uq_stage_transition_seq"
        ),
        CheckConstraint(
            f"from_stage IS NULL OR from_stage IN ({_STAGE_VALUES})",
            name="ck_stage_transition_from_stage",
        ),
        CheckConstraint(
            f"to_stage IN ({_STAGE_VALUES})", name="ck_stage_transition_to_stage"
        ),
        CheckConstraint(
            "source IN ('user', 'user_correction', 'user_reactivation', 'system')",
            name="ck_stage_transition_source",
        ),
        CheckConstraint("seq >= 1", name="ck_stage_transition_seq_positive"),
        CheckConstraint(
            "reasons IS NULL OR (jsonb_typeof(reasons) = 'array'"
            " AND jsonb_array_length(reasons) <= 8) IS TRUE",
            name="ck_stage_transition_reasons",
        ),
        CheckConstraint(
            "schema_version >= 1", name="ck_stage_transition_schema_version"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    application_id: uuid.UUID = Field(nullable=False)
    seq: int = Field(nullable=False)
    from_stage: str | None = None
    to_stage: str
    source: str
    reason: str | None = None
    reasons: list[str] | None = Field(
        default=None,
        sa_type=JSONB(none_as_null=True),  # type: ignore
    )
    resume_id: uuid.UUID | None = Field(default=None)
    corrects_transition_id: uuid.UUID | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class ResumeSnapshot(SQLModel, table=True):
    """Append-only immutable resume copy captured at APPLIED (D10, sprint-04
    3b). SELECT-only for app_runtime (PIN-19); written exclusively by the
    stage-mutation function in the SAME transaction as the applied transition
    and the resume lock (PIN-2). UNIQUE(user_id, application_id): the mock
    keys snapshots by application id (PIN-15). The composite FK to resume is
    the delete backstop behind the 409 resume-lock-conflict (PIN-17).
    """

    __tablename__ = "resume_snapshot"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_resume_snapshot_user_id_id"),
        UniqueConstraint(
            "user_id", "application_id", name="uq_resume_snapshot_application"
        ),
        CheckConstraint(
            "schema_version >= 1", name="ck_resume_snapshot_schema_version"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    application_id: uuid.UUID = Field(nullable=False)
    resume_id: uuid.UUID = Field(nullable=False)
    name: str
    body: str
    template_version: str
    captured_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class UndoGrant(SQLModel, table=True):
    """Persistent, restart-safe undo grant for markWon (v3 Data-integrity #7,
    spec PIN-4). The row id IS the wire undoToken. Minted and consumed ONLY
    inside the stage-mutation function (SELECT-only for app_runtime, PIN-19);
    the claim is one atomic UPDATE on ``consumed_at IS NULL AND expires_at >=
    statement_timestamp()`` -- all timestamps from PostgreSQL expressions.
    ``corrects_transition_id`` names the won transition the undo compensates.
    """

    __tablename__ = "undo_grant"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_undo_grant_user_id_id"),
        CheckConstraint("schema_version >= 1", name="ck_undo_grant_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    application_id: uuid.UUID = Field(nullable=False)
    corrects_transition_id: uuid.UUID = Field(nullable=False)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    expires_at: datetime = Field(
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    consumed_at: datetime | None = Field(
        default=None,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class UserAiBudget(SQLModel, table=True):
    """Per-tenant, per-UTC-month AI budget row (sprint-05, v3 Data-integrity
    #5/#6). The ONE mutable row of the AI seam: reserved/spent move ONLY
    inside the SECURITY DEFINER ``ai_reserve_run``/``ai_settle_run`` functions
    (SELECT-only for app_runtime; spec PIN-A1). ``ck_user_ai_budget_cap`` is
    the DB belt under the functions' guarded-UPDATE suspenders: the cap can
    never be exceeded even if the function arithmetic regresses. Rows are
    created on first reservation of a month (PIN-A12); ``cap_usd`` is stamped
    from Settings at creation.
    """

    __tablename__ = "user_ai_budget"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_user_ai_budget_user_id_id"),
        UniqueConstraint("user_id", "month_start", name="uq_user_ai_budget_month"),
        CheckConstraint("cap_usd > 0", name="ck_user_ai_budget_cap_positive"),
        CheckConstraint("spent_usd >= 0", name="ck_user_ai_budget_spent_nonneg"),
        CheckConstraint("reserved_usd >= 0", name="ck_user_ai_budget_reserved_nonneg"),
        CheckConstraint(
            "spent_usd + reserved_usd <= cap_usd", name="ck_user_ai_budget_cap"
        ),
        CheckConstraint("schema_version >= 1", name="ck_user_ai_budget_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    month_start: date = Field(sa_type=Date)
    cap_usd: Decimal = Field(sa_type=Numeric(10, 6))  # type: ignore
    reserved_usd: Decimal = Field(
        default=Decimal("0"),
        sa_type=Numeric(10, 6),  # type: ignore
        sa_column_kwargs={"server_default": "0"},
    )
    spent_usd: Decimal = Field(
        default=Decimal("0"),
        sa_type=Numeric(10, 6),  # type: ignore
        sa_column_kwargs={"server_default": "0"},
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class AiRun(SQLModel, table=True):
    """Append-only AI-run header (sprint-05, spec PIN-A1/A2). Immutable:
    INSERT happens ONLY inside ``ai_reserve_run`` (SELECT-only for
    app_runtime; enforce_append_only on top). Carries NO status column --
    status derives from ai_run_event (reserved-only = open; terminal event =
    settled). ``idempotency_key`` is server-derived under the budget row lock
    (PIN-A3): ``{kind}:{job_id}:{resume_id}:{settled-count}``, so a retry of
    an open run adopts it while a post-settlement re-run mints a fresh run.
    """

    __tablename__ = "ai_run"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_ai_run_user_id_id"),
        UniqueConstraint("user_id", "idempotency_key", name="uq_ai_run_idempotency"),
        CheckConstraint("kind IN ('deep_match_score')", name="ck_ai_run_kind"),
        CheckConstraint("reserved_max_usd > 0", name="ck_ai_run_reserved_max_positive"),
        CheckConstraint("schema_version >= 1", name="ck_ai_run_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    job_id: uuid.UUID = Field(nullable=False)
    resume_id: uuid.UUID = Field(nullable=False)
    budget_id: uuid.UUID = Field(nullable=False)
    kind: str
    provider: str
    model: str
    reserved_max_usd: Decimal = Field(sa_type=Numeric(10, 6))  # type: ignore
    idempotency_key: str
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class AiRunEvent(SQLModel, table=True):
    """Append-only AI-run lifecycle event (sprint-05, spec PIN-A2). Exactly
    one ``reserved`` and at most one terminal (``succeeded``/``failed``) event
    per run -- enforced by partial unique indexes (migration-only, DEBT-6).
    ``actual_cost_usd`` is present iff succeeded (``ck_ai_run_event_cost``).
    Written ONLY inside the two budget functions.
    """

    __tablename__ = "ai_run_event"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_ai_run_event_user_id_id"),
        CheckConstraint(
            "kind IN ('reserved', 'succeeded', 'failed')", name="ck_ai_run_event_kind"
        ),
        CheckConstraint(
            "(kind = 'succeeded') = (actual_cost_usd IS NOT NULL)",
            name="ck_ai_run_event_cost",
        ),
        CheckConstraint(
            "actual_cost_usd IS NULL OR actual_cost_usd >= 0",
            name="ck_ai_run_event_cost_nonneg",
        ),
        CheckConstraint("schema_version >= 1", name="ck_ai_run_event_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    run_id: uuid.UUID = Field(nullable=False)
    kind: str
    actual_cost_usd: Decimal | None = Field(
        default=None,
        sa_type=Numeric(10, 6),  # type: ignore
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


class MatchReport(SQLModel, table=True):
    """Append-only immutable match-report version (sprint-05, spec PIN-A7).
    One report per ai_run (UNIQUE(user_id, ai_run_id)); versions per
    (user, job, resume) are collision-free (UNIQUE + assigned inside
    ``ai_settle_run`` under the budget lock). The CURRENT report is
    MAX(version) -- derived, no mutable pointer state. Written ONLY inside
    ``ai_settle_run`` on a succeeded settlement.
    """

    __tablename__ = "match_report"

    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_match_report_user_id_id"),
        UniqueConstraint("user_id", "ai_run_id", name="uq_match_report_run"),
        UniqueConstraint(
            "user_id", "job_id", "resume_id", "version", name="uq_match_report_version"
        ),
        CheckConstraint("version >= 1", name="ck_match_report_version"),
        CheckConstraint("score BETWEEN 0 AND 100", name="ck_match_report_score"),
        CheckConstraint(
            "(jsonb_typeof(rubric) = 'array') IS TRUE", name="ck_match_report_rubric"
        ),
        CheckConstraint(
            "(jsonb_typeof(gaps) = 'array') IS TRUE", name="ck_match_report_gaps"
        ),
        CheckConstraint(
            "(jsonb_typeof(strengths) = 'array') IS TRUE",
            name="ck_match_report_strengths",
        ),
        CheckConstraint("schema_version >= 1", name="ck_match_report_schema_version"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", ondelete="CASCADE", nullable=False, index=True
    )
    job_id: uuid.UUID = Field(nullable=False)
    resume_id: uuid.UUID = Field(nullable=False)
    ai_run_id: uuid.UUID = Field(nullable=False)
    version: int = Field(nullable=False)
    score: int = Field(nullable=False)
    rubric: list[dict[str, Any]] = Field(sa_type=JSONB)
    gaps: list[dict[str, Any]] = Field(sa_type=JSONB)
    strengths: list[str] = Field(sa_type=JSONB)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
        sa_column_kwargs={"server_default": sa_text("now()")},
    )
    schema_version: int = Field(
        default=1, nullable=False, sa_column_kwargs={"server_default": "1"}
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token (claim set: plan v3 Auth conventions). ``sub`` is
# UUID-typed so a signed-but-garbage subject fails pydantic validation and
# lands in the uniform 401 instead of a DataError 500 (panel COR-3).
class TokenPayload(SQLModel):
    sub: uuid.UUID | None = None
    sv: int = 0


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
