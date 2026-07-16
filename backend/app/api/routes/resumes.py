"""Resumes resource -- CRUD + lifecycle actions (RES-019 / CUR-020).

Since sprint-04 3a the 8 resume CRUD/lifecycle ops are DB-backed (the
sprint-04 spec's operation boundary, PIN-6). Queries run through
``TenantSession`` (the ``app_runtime`` role + the ``app.user_id`` GUC behind
RLS) with app-level ``user_id`` predicates as the belt, mirroring the
shortlist exemplar (``routes/shortlist.py``).

Full resume management (uploads/templates/projections/exports) stays mock in
``routes/resume_lifecycle.py`` through Release 0.1 (PIN-6); those ops read
``store.resumes``, a store now write-dead by these routes -- DB-created
resumes do not appear in mock projection lists and vice versa (accepted
deviation, same class as the sprint-02/03 mock-search seams).

Wire mapping in ``app/resume_mapper.py``. ``mvp-api.yaml`` inlines the
``patchResume`` and ``forkResumeAsDraft`` request bodies as anonymous objects
(no ``$ref``), so ``datamodel-codegen`` never emitted models for them in
``app.schemas``. ``PatchResumeBody`` / ``ForkResumeInput`` below are small
hand-authored request models for those two bodies only -- every response
still uses the generated ``Resume`` model.

IMPORTANT (deps.get_tenant_session docstring): ``SET LOCAL ROLE`` +
``app.user_id`` are transaction-scoped -- a commit ends them. Every mutating
route below builds its wire response BEFORE calling ``session.commit()`` and
never touches ORM row attributes afterward (a post-commit lazy-refresh would
run outside the tenant role/GUC and silently return zero rows under RLS).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from app import models
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.api.errors import ConflictError, NotFoundError
from app.resume_mapper import row_to_wire_resume, wire_resume_to_row
from app.schemas import Resume, ResumeTag

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["resumes"])

# Tags a resume must NOT have (plus usedIn > 0) to be deletable (deleteResume).
LOCKED_TAGS = frozenset({ResumeTag.TAILORED, ResumeTag.MASTER, ResumeTag.DEFAULT})

# FK constraints that back-stop the app-level delete-lock check (PIN-17): any
# OTHER IntegrityError on the same commit is a real bug, not a lock conflict,
# and must re-raise (COR-2/SIM-1 -- same disambiguation discipline as
# shortlist.py's dedup-index check). Inbound references only (RV-2/D2-6: the
# outbound fk_resume_fork_job can never fire on a DELETE of the referencing
# row and was removed as a dead branch); fk_stage_transition_resume joined
# the set when D2-1 added that composite FK.
_DELETE_BACKSTOP_CONSTRAINTS = frozenset(
    {
        "fk_application_resume",
        "fk_resume_snapshot_resume",
        "fk_stage_transition_resume",
        # sprint-05 (PIN-A14): a scored resume is referenced by its runs and
        # reports -- both append-only, so the reference can never be cleared
        # at runtime; deletion refuses with the same 409 lock conflict.
        "fk_ai_run_resume",
        "fk_match_report_resume",
    }
)


def _constraint_name(exc: IntegrityError) -> str | None:
    """The DB constraint an IntegrityError violated (psycopg diag), or None."""
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None)


def _caller_resumes_query(current_user_id: UUID):  # type: ignore[no-untyped-def]
    """The caller's resumes, stable order (updated DESC, then id)."""
    return (
        select(models.Resume)
        .where(models.Resume.user_id == current_user_id)
        .order_by(col(models.Resume.updated).desc(), col(models.Resume.id))
    )


class PatchResumeBody(BaseModel):
    """Anonymous inline body for ``PATCH /resumes/{id}``.

    Collapses 3 mock mutations (renameResume/saveResumeBody/
    patchResumeScoring) onto one PATCH; every field optional, only
    client-sent fields are applied (exclude_unset merge in the route).
    """

    name: str | None = None
    body: str | None = None
    scoringEnabled: bool | None = None


class ForkResumeInput(BaseModel):
    """Anonymous inline body for ``POST /resumes/{id}/fork``."""

    jobId: UUID


@router.get("/resumes", operation_id="getResumes", response_model=list[Resume])
def get_resumes(session: TenantSession, current_user: CurrentUser) -> list[Resume]:
    """All resumes for the caller (getResumes, DB-backed)."""
    rows = session.exec(_caller_resumes_query(current_user.id)).all()
    return [row_to_wire_resume(row) for row in rows]


@router.post(
    "/resumes", operation_id="createResume", response_model=Resume, status_code=201
)
def create_resume(session: TenantSession, current_user: CurrentUser) -> Resume:
    """Create a blank draft resume (createResume, RES-019, DB-backed).

    Mirrors mock api.ts ``createResume``: no request body, fixed blank
    defaults, tag=DRAFT.
    """
    new_resume = Resume(
        id=uuid4(),
        name="Untitled revision",
        subtitle="",
        version="v1",
        usedIn=0,
        updated=datetime.now(UTC),
        tag=ResumeTag.DRAFT,
        body="",
    )
    session.add(wire_resume_to_row(new_resume, user_id=current_user.id))
    session.commit()
    return new_resume


@router.get("/resumes/{id}", operation_id="getResume", response_model=Resume)
def get_resume(id: UUID, session: TenantSession, current_user: CurrentUser) -> Resume:
    """One resume, id-only (getResume, DB-backed).

    Unknown id and cross-tenant id are indistinguishable: both fall out of
    the tenant-filtered lookup and raise the same 404 envelope.
    """
    row = session.exec(
        select(models.Resume)
        .where(models.Resume.id == id)
        .where(models.Resume.user_id == current_user.id)
    ).first()
    if row is None:
        raise NotFoundError(f"resumes/{id}")
    return row_to_wire_resume(row)


@router.patch("/resumes/{id}", operation_id="patchResume", response_model=Resume)
def patch_resume(
    id: UUID, body: PatchResumeBody, session: TenantSession, current_user: CurrentUser
) -> Resume:
    """Patch a resume: rename / save body / toggle scoring (patchResume).

    Collapses 3 mock mutations onto one PATCH; only client-sent fields are
    merged in (``exclude_unset``), matching mock api.ts semantics -- none of
    the three mock mutations touch ``updated`` either, so this route doesn't.
    """
    row = session.exec(
        select(models.Resume)
        .where(models.Resume.id == id)
        .where(models.Resume.user_id == current_user.id)
    ).first()
    if row is None:
        raise NotFoundError(f"resumes/{id}")
    updates = body.model_dump(exclude_unset=True)
    if "name" in updates:
        row.name = updates["name"]
    if "body" in updates:
        row.body = updates["body"]
    if "scoringEnabled" in updates:
        row.scoring_enabled = updates["scoringEnabled"]
    # Build the wire response NOW, while row attributes are still fresh
    # in-memory and the tenant role/GUC are still live for this transaction.
    result = row_to_wire_resume(row)
    session.commit()
    return result


@router.delete("/resumes/{id}", operation_id="deleteResume", status_code=204)
def delete_resume(id: UUID, session: TenantSession, current_user: CurrentUser) -> None:
    """Delete a resume (deleteResume, RES-019, DB-backed).

    Guards locked resumes app-side: TAILORED / MASTER / DEFAULT tag, or
    ``usedIn`` > 0 -> 409 conflict envelope (mirrors mock api.ts
    ``deleteResume``, PIN-17). The composite FKs from ``application`` and
    ``resume_snapshot`` are the DB backstop for any reference the app-level
    check misses; a violation there disambiguates BY CONSTRAINT NAME to the
    SAME 409 envelope. Any other IntegrityError re-raises (not a lock
    conflict, a real bug).
    """
    row = session.exec(
        select(models.Resume)
        .where(models.Resume.id == id)
        .where(models.Resume.user_id == current_user.id)
    ).first()
    if row is None:
        raise NotFoundError(f"resumes/{id}")
    if row.tag in LOCKED_TAGS or row.used_in > 0:
        raise ConflictError(f"resumes/{id}/delete")
    session.delete(row)
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        if _constraint_name(exc) in _DELETE_BACKSTOP_CONSTRAINTS:
            raise ConflictError(f"resumes/{id}/delete") from exc
        raise


@router.post(
    "/resumes/{id}/duplicate",
    operation_id="duplicateResume",
    response_model=Resume,
    status_code=201,
)
def duplicate_resume(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> Resume:
    """Duplicate a resume as a DRAFT (duplicateResume, RES-019, DB-backed).

    Unknown/cross-tenant basis id -> tenant-indistinguishable 404. The fresh
    copy is a new DRAFT, never a fork -- ``fork_job_id`` is NOT inherited.
    """
    source = session.exec(
        select(models.Resume)
        .where(models.Resume.id == id)
        .where(models.Resume.user_id == current_user.id)
    ).first()
    if source is None:
        raise NotFoundError(f"resumes/{id}")
    source_wire = row_to_wire_resume(source)
    copy = source_wire.model_copy(
        update={
            "id": uuid4(),
            "name": f"{source_wire.name} (copy)",
            "tag": ResumeTag.DRAFT,
            "usedIn": 0,
            "updated": datetime.now(UTC),
        }
    )
    session.add(wire_resume_to_row(copy, user_id=current_user.id))
    session.commit()
    return copy


@router.post(
    "/resumes/{id}/set-default",
    operation_id="setDefaultResume",
    response_model=list[Resume],
)
def set_default_resume(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> list[Resume]:
    """Set a resume as DEFAULT, demoting the previous DEFAULT to VARIANT.

    Returns the full updated collection (setDefaultResume, RES-019,
    DB-backed). PIN-5 fixed order: lock the stable user row FIRST (closes the
    concurrent-swap race the DB backstop -- ``uq_resume_user_default`` --
    would otherwise only catch after the fact), THEN demote the current
    DEFAULT to VARIANT, THEN promote the target to DEFAULT. Unknown/
    cross-tenant target id -> 404. Mirrors mock api.ts: only ``tag`` changes,
    ``updated`` is left untouched on both the promoted and demoted resumes.
    """
    session.connection().execute(
        text('SELECT id FROM "user" WHERE id = :uid FOR UPDATE'),
        {"uid": str(current_user.id)},
    )
    rows = session.exec(_caller_resumes_query(current_user.id)).all()
    target = next((row for row in rows if row.id == id), None)
    if target is None:
        raise NotFoundError(f"resumes/{id}")
    for row in rows:
        if row.id != target.id and row.tag == ResumeTag.DEFAULT:
            row.tag = ResumeTag.VARIANT.value
    # Flush the demotion as its OWN statement before the promotion is even
    # staged: the unit-of-work does not order UPDATEs by attribute-mutation
    # order, only by flush batch, so without this explicit flush the promote
    # and demote can land in the same executemany batch in the wrong order
    # and transiently violate uq_resume_user_default (PIN-5's fixed order is
    # a SQL-statement-order guarantee, not a Python-attribute-order one).
    session.flush()
    target.tag = ResumeTag.DEFAULT.value
    # Build the wire response NOW (rows are mutated in-memory, not yet
    # committed) -- the tenant role/GUC are still live for this transaction.
    result = [row_to_wire_resume(row) for row in rows]
    session.commit()
    return result


@router.post(
    "/resumes/{id}/fork",
    operation_id="forkResumeAsDraft",
    response_model=Resume,
    status_code=201,
)
def fork_resume_as_draft(
    id: UUID,
    body: ForkResumeInput,
    session: TenantSession,
    current_user: CurrentUser,
) -> Resume:
    """Fork a resume as a tailored draft for a job (forkResumeAsDraft, CUR-020).

    Mirrors mock api.ts ``forkResumeAsDraft``: copies the basis resume, tags
    the fork DRAFT, resets usedIn/updated. Deviation from mock (AC-08): both
    the basis resume id and ``body.jobId`` are now ownership-checked --
    unknown/cross-tenant for EITHER is a tenant-indistinguishable 404 (the
    mock never validated ``jobId`` at all). ``fork_job_id`` carries the
    provenance as a row-only column (no field on the ``Resume`` wire shape).
    """
    basis = session.exec(
        select(models.Resume)
        .where(models.Resume.id == id)
        .where(models.Resume.user_id == current_user.id)
    ).first()
    if basis is None:
        raise NotFoundError(f"resumes/{id}")
    owns_job = session.exec(
        select(models.Job.id)
        .where(models.Job.id == body.jobId)
        .where(models.Job.user_id == current_user.id)
    ).first()
    if owns_job is None:
        raise NotFoundError(f"jobs/{body.jobId}")
    basis_wire = row_to_wire_resume(basis)
    fork = basis_wire.model_copy(
        update={
            "id": uuid4(),
            "name": f"{basis_wire.name} - tailored draft",
            "tag": ResumeTag.DRAFT,
            "usedIn": 0,
            "updated": datetime.now(UTC),
        }
    )
    session.add(
        wire_resume_to_row(fork, user_id=current_user.id, fork_job_id=body.jobId)
    )
    session.commit()
    return fork
