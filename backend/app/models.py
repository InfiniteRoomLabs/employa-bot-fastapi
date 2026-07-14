import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import EmailStr
from sqlalchemy import CheckConstraint, DateTime, String, UniqueConstraint
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
