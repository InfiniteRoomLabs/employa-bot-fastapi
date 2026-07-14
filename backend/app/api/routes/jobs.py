"""Jobs resource (ADR-006 canonical posting collection).

Since sprint-02 the Job-resource operations (``getJobs``, ``getJob``) are
served from the DATABASE -- the first DB-backed vertical (see
docs/sprints/sprint-02-spec.md). Queries run through ``TenantSession``
(``app_runtime`` role + the ``app.user_id`` GUC behind the job RLS policy)
and keep their explicit ``user_id`` predicates; RLS is the backstop. An
id-addressed miss and a cross-tenant hit exit through the SAME
``NotFoundError`` -- tenant-indistinguishable 404s by construction.

``getJobsInbox`` stays mock-served (PIN-2): the inbox is the search-feed
projection keyed by mock search ids, and searches stay mock through
Release 0.1 -- persisting inbox rows would make DB state depend on mock
entities, the seam v3's abandonment-safety rule forbids.

Mock-era rules that still apply: explicit ``operation_id`` verbatim from the
contract, generated ``response_model``, typed errors (never
``HTTPException``).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlmodel import col, select

from app import models, store
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.api.errors import NotFoundError
from app.job_mapper import row_to_wire_job
from app.schemas import Job, JobInboxItem

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["jobs"])


@router.get("/jobs", operation_id="getJobs", response_model=list[Job])
def get_jobs(session: TenantSession, current_user: CurrentUser) -> list[Job]:
    """All captured postings for the caller (getJobs, DB-backed)."""
    rows = session.exec(
        select(models.Job)
        .where(models.Job.user_id == current_user.id)
        .order_by(col(models.Job.created_at), col(models.Job.id))
    ).all()
    return [row_to_wire_job(row) for row in rows]


@router.get(
    "/jobs/inbox", operation_id="getJobsInbox", response_model=list[JobInboxItem]
)
def get_jobs_inbox(
    searchId: UUID | None = Query(default=None),  # noqa: N803 -- wire name verbatim
) -> list[JobInboxItem]:
    """Jobs inbox, optionally scoped to one saved search (getJobsInbox).

    Mock-served (PIN-2). When ``searchId`` is omitted or unknown, the
    canonical (platform-search) inbox is returned -- the mock has no
    "unknown search" error path here, so neither does this route.
    """
    if searchId is not None and searchId in store.JOBS_INBOX_BY_SEARCH:
        return store.JOBS_INBOX_BY_SEARCH[searchId]
    return list(store.jobs_inbox)


@router.get("/jobs/{id}", operation_id="getJob", response_model=Job)
def get_job(id: UUID, session: TenantSession, current_user: CurrentUser) -> Job:
    """One captured posting (getJob, DB-backed).

    Unknown id and cross-tenant id are indistinguishable: both fall out of
    the tenant-filtered query as ``None`` and raise the same 404 envelope.
    """
    row = session.exec(
        select(models.Job)
        .where(models.Job.id == id)
        .where(models.Job.user_id == current_user.id)
    ).first()
    if row is None:
        raise NotFoundError(f"jobs/{id}")
    return row_to_wire_job(row)
