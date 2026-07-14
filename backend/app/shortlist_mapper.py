"""Wire <-> row mapping for the shortlist vertical (sprint-03 child exemplar).

``schemas.ShortlistEntry`` is the frozen contract shape; ``models.ShortlistEntry``
is the tenant child row. The display fields (company/role/location/salary/match)
are a client-supplied SNAPSHOT at save time (PIN-4) -- stored, not derived from
the joined job. ``job_id`` is nullable (the wire ``jobId`` is optional).

``row_to_wire_shortlist`` funnels through ``schemas.ShortlistEntry.model_validate``
so any row the DB can hold that the wire cannot express fails loudly (the runtime
drift guard).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app import schemas
from app.models import ShortlistEntry as ShortlistRow


def wire_shortlist_to_row(
    entry: schemas.ShortlistEntry, *, user_id: UUID
) -> ShortlistRow:
    """Build the tenant child row for a wire ShortlistEntry (add path, seeds)."""
    return ShortlistRow(
        id=entry.id,
        user_id=user_id,
        job_id=entry.jobId,
        company=entry.company,
        role=entry.role,
        location=entry.location,
        salary=(
            entry.salary.model_dump(mode="json") if entry.salary is not None else None
        ),
        match=entry.match,
        saved=entry.saved,
        source=entry.source.value,
        why=entry.why,
        stale=entry.stale,
    )


def row_to_wire_shortlist(row: ShortlistRow) -> schemas.ShortlistEntry:
    """Validate the tenant child row back into the wire shape."""
    payload: dict[str, Any] = {
        "id": row.id,
        "jobId": row.job_id,
        "company": row.company,
        "role": row.role,
        "location": row.location,
        "salary": row.salary,
        "match": row.match,
        "saved": row.saved,
        "source": row.source,
        "why": row.why,
        "stale": row.stale,
    }
    return schemas.ShortlistEntry.model_validate(payload)
