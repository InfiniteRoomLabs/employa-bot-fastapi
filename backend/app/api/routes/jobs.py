"""Jobs resource (ADR-006 canonical posting collection).

Follows the searches.py pattern exactly (see that file's header for the full
rule list): explicit ``operation_id`` verbatim from the contract, generated
``response_model``, store access via ``app.store`` dicts/lists,
typed errors (never ``HTTPException``), no auth deps.

``getJobsInbox`` takes an optional ``searchId`` query param. Judgment call
(mirrors the mock's api.ts ``getJobsInbox`` exactly): when ``searchId`` is
omitted or unknown, the canonical (platform-search) inbox is returned rather
than an empty list or a 404 -- the mock has no "unknown search" error path
here, so neither does this route.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app import store
from app.api.deps import get_current_user
from app.api.errors import NotFoundError
from app.schemas import Job, JobInboxItem

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["jobs"])


@router.get("/jobs", operation_id="getJobs", response_model=list[Job])
def get_jobs() -> list[Job]:
    """All captured postings (getJobs, ADR-006 canonical collection)."""
    return list(store.jobs.values())


@router.get(
    "/jobs/inbox", operation_id="getJobsInbox", response_model=list[JobInboxItem]
)
def get_jobs_inbox(
    searchId: UUID | None = Query(default=None),  # noqa: N803 -- wire name verbatim
) -> list[JobInboxItem]:
    """Jobs inbox, optionally scoped to one saved search (getJobsInbox)."""
    if searchId is not None and searchId in store.JOBS_INBOX_BY_SEARCH:
        return store.JOBS_INBOX_BY_SEARCH[searchId]
    return list(store.jobs_inbox)


@router.get("/jobs/{id}", operation_id="getJob", response_model=Job)
def get_job(id: UUID) -> Job:
    """One captured posting (getJob). 404 envelope on unknown id."""
    hit = store.jobs.get(id)
    if hit is None:
        raise NotFoundError(f"jobs/{id}")
    return hit
