"""Wire <-> row mapping for the jobs vertical (sprint-02 exemplar).

``schemas.Job`` is the frozen contract shape; ``models.Job`` is the tenant
row. Two deliberate asymmetries (docs/sprints/sprint-02-spec.md):

* ``source.url`` is additionally normalized to the ``source_url`` column
  because the partial-unique dedup index needs a column (PIN-3); the JSONB
  ``source`` document keeps the url too, staying wire-verbatim.
* the row stamps ``user_id`` (tenancy) and ``schema_version`` -- neither
  exists on the wire.

JSONB documents are stored in wire shape (camelCase keys, ``mode="json"``)
so the named CHECK constraints and the drift round-trip test judge the same
bytes the API serves. ``row_to_wire_job`` funnels through
``schemas.Job.model_validate`` -- any row the DB can hold that the wire
schema cannot express fails loudly here, which IS the drift guard at
runtime.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app import schemas
from app.models import Job as JobRow


def wire_job_to_row(job: schemas.Job, *, user_id: UUID) -> JobRow:
    """Build the tenant row for a wire Job (capture path, seeds)."""
    return JobRow(
        id=job.id,
        user_id=user_id,
        company=job.company,
        title=job.title,
        location=job.location.model_dump(mode="json", exclude_none=True),
        work_mode=job.workMode.value,
        employment=job.employment.model_dump(mode="json"),
        compensation=(
            job.compensation.model_dump(mode="json")
            if job.compensation is not None
            else None
        ),
        seniority=job.seniority,
        source=job.source.model_dump(mode="json", exclude_none=True),
        source_url=str(job.source.url) if job.source.url is not None else None,
        is_new=job.isNew,
        posted=job.posted,
        summary=job.summary,
        tags=list(job.tags) if job.tags is not None else None,
        requirements=list(job.requirements) if job.requirements is not None else None,
        description=job.description,
        match=(
            job.match.model_dump(mode="json", exclude_none=True)
            if job.match is not None
            else None
        ),
    )


def row_to_wire_job(row: JobRow) -> schemas.Job:
    """Validate the tenant row back into the wire shape the contract serves."""
    payload: dict[str, Any] = {
        "id": row.id,
        "company": row.company,
        "title": row.title,
        "location": row.location,
        "workMode": row.work_mode,
        "employment": row.employment,
        "compensation": row.compensation,
        "seniority": row.seniority,
        "source": row.source,
        "isNew": row.is_new,
        "posted": row.posted,
        "summary": row.summary,
        "tags": row.tags,
        "requirements": row.requirements,
        "description": row.description,
        "match": row.match,
    }
    return schemas.Job.model_validate(payload)
