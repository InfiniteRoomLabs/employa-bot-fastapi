"""Shortlist resource (ORI-014).

Since sprint-03 the shortlist is DB-backed (the first child table that
composite-FKs the ``job`` parent; see docs/sprints/sprint-03-spec.md).
Queries run through ``TenantSession`` (the ``app_runtime`` role + the
``app.user_id`` GUC behind RLS) with app-level ``user_id`` predicates as the
belt.

* ``getShortlist`` DEFAULT view (no ``searchId``) is DB-backed; a
  ``searchId``-scoped view stays MOCK (PIN-3): the per-search shortlist is a
  saved-search projection keyed by mock search ids, and searches stay mock
  through Release 0.1 (persisting them would reference a mock entity).
* ``addToShortlist`` persists a real caller-owned entry. A duplicate
  ``(user_id, job_id)`` violates the partial unique index and surfaces as a
  409 ``conflict`` via the existing envelope (PO decision; NOT idempotent).
* ``dismissFromShortlist`` deletes by entry id; a cross-tenant or unknown id
  is a tenant-indistinguishable 404.

The ``addToShortlist`` request body has no named contract schema (inline
object), so ``AddToShortlistBody`` is a route-local model.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from app import models, store
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.api.errors import ConflictError, NotFoundError
from app.schemas import SalaryPoint, SalaryRange, ShortlistEntry, Source
from app.shortlist_mapper import row_to_wire_shortlist, wire_shortlist_to_row

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["shortlist"])


def _constraint_name(exc: IntegrityError) -> str | None:
    """The DB constraint that an IntegrityError violated (psycopg diag), or
    None. Lets a route 409 on the dedup index only, not on every violation."""
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None)


class AddToShortlistBody(BaseModel):
    """Inline requestBody for ``POST /shortlist`` (no named contract schema)."""

    jobId: UUID | None = None
    company: str
    role: str
    location: str
    salary: SalaryPoint | SalaryRange | None
    match: int


@router.get(
    "/shortlist", operation_id="getShortlist", response_model=list[ShortlistEntry]
)
def get_shortlist(
    session: TenantSession,
    current_user: CurrentUser,
    searchId: UUID | None = Query(default=None),  # noqa: N803 -- wire name verbatim
) -> list[ShortlistEntry]:
    """Shortlist entries (getShortlist).

    Default view (no searchId): DB-backed, the caller's saved entries. A
    RECOGNIZED ``searchId`` returns the mock per-search projection (PIN-3 --
    searches are mock through Release 0.1). An unrecognized ``searchId`` falls
    through to the DB default (SIM-2: the old mock-era fallback to
    ``store.shortlist`` is now write-dead since add/dismiss moved to the DB, so
    serving it would be a frozen disconnected snapshot -- the caller's real
    shortlist is the right answer).
    """
    if searchId is not None and searchId in store.SHORTLIST_BY_SEARCH:
        return store.SHORTLIST_BY_SEARCH[searchId]
    rows = session.exec(
        select(models.ShortlistEntry)
        .where(models.ShortlistEntry.user_id == current_user.id)
        .order_by(col(models.ShortlistEntry.saved), col(models.ShortlistEntry.id))
    ).all()
    return [row_to_wire_shortlist(row) for row in rows]


@router.post(
    "/shortlist",
    operation_id="addToShortlist",
    response_model=ShortlistEntry,
    status_code=201,
)
def add_to_shortlist(
    body: AddToShortlistBody, session: TenantSession, current_user: CurrentUser
) -> ShortlistEntry:
    """Add a job to the shortlist (addToShortlist, DB-backed).

    A ``jobId`` the caller does not own (cross-tenant or unknown) is a
    tenant-indistinguishable 404 -- the app-level ownership check is the belt
    (matching the job routes), the composite FK is the DB backstop. A
    duplicate ``(user_id, job_id)`` -> 409 ``conflict`` (the partial unique
    index; PO decision, not idempotent).
    """
    if body.jobId is not None:
        owns_job = session.exec(
            select(models.Job.id)
            .where(models.Job.id == body.jobId)
            .where(models.Job.user_id == current_user.id)
        ).first()
        if owns_job is None:
            raise NotFoundError(f"jobs/{body.jobId}")
    entry = ShortlistEntry(
        id=uuid4(),
        jobId=body.jobId,
        company=body.company,
        role=body.role,
        location=body.location,
        salary=body.salary,
        match=body.match,
        saved=datetime.now(UTC),
        source=Source.you,
    )
    session.add(wire_shortlist_to_row(entry, user_id=current_user.id))
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        # Only the dedup index means "already shortlisted" -> 409. Any OTHER
        # integrity violation (e.g. the composite FK firing because the job was
        # deleted between the ownership pre-check and the commit -- a TOCTOU
        # window) is NOT a conflict; re-raise rather than mislabel it a 409
        # (QA-1/COR-2/SIM-1). The exemplar disambiguates by constraint name so
        # sprint-04's children -- whose parents ARE deletable mid-request --
        # inherit correct error taxonomy, not a catch-all.
        if _constraint_name(exc) == "uq_shortlist_user_job":
            raise ConflictError(
                f"shortlist: job {body.jobId} already shortlisted"
            ) from exc
        raise
    return entry


@router.delete(
    "/shortlist/{id}",
    operation_id="dismissFromShortlist",
    status_code=204,
    response_model=None,
)
def dismiss_from_shortlist(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> Response:
    """Remove a shortlist entry by id (dismissFromShortlist, DB-backed).

    Unknown id and cross-tenant id are indistinguishable: both fall out of the
    tenant-filtered lookup and raise the same 404 envelope.
    """
    row = session.exec(
        select(models.ShortlistEntry)
        .where(models.ShortlistEntry.id == id)
        .where(models.ShortlistEntry.user_id == current_user.id)
    ).first()
    if row is None:
        raise NotFoundError(f"shortlist/{id}")
    session.delete(row)
    session.commit()
    return Response(status_code=204)
