"""Shortlist resource (ORI-014).

Follows the searches.py pattern exactly (see that file's header for the full
rule list).

The contract has no named request-body schema for ``addToShortlist`` (the
``mvp-api.yaml`` requestBody is an inline object, so ``datamodel-codegen``
never emitted a model for it -- ``models.py`` only gets a class per
``$ref``-named schema). Judgment call: ``AddToShortlistBody`` below is a
route-local model, not a generated one, built to match the inline schema
field-for-field.

``dismissFromShortlist`` is UUID-ified per the contract (DELETE
``/shortlist/{id}``) even though the mock keys removal by role string --
see ``app.scaffold.store``'s shortlist section docstring for the id scheme
and the mutable-vs-per-search-view split ported from api.ts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Query, Response
from pydantic import BaseModel

from app.scaffold import store
from app.scaffold.errors import NotFoundError
from app.scaffold.models import SalaryPoint, SalaryRange, ShortlistEntry, Source

router = APIRouter(tags=["shortlist"])


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
    searchId: UUID | None = Query(default=None),  # noqa: N803 -- wire name verbatim
) -> list[ShortlistEntry]:
    """Shortlist entries, optionally scoped to one saved search (getShortlist)."""
    if searchId is not None and searchId in store.SHORTLIST_BY_SEARCH:
        return store.SHORTLIST_BY_SEARCH[searchId]
    return list(store.shortlist.values())


@router.post(
    "/shortlist",
    operation_id="addToShortlist",
    response_model=ShortlistEntry,
    status_code=201,
)
def add_to_shortlist(body: AddToShortlistBody) -> ShortlistEntry:
    """Add a job to the shortlist (addToShortlist, ORI-014).

    Mirrors mock api.ts: new entry appended with ``source=you`` and
    ``saved=now``. Only mutates the default (no-searchId) view -- see the
    store docstring for why the per-search index is untouched.
    """
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
    store.shortlist[entry.id] = entry
    return entry


@router.delete(
    "/shortlist/{id}",
    operation_id="dismissFromShortlist",
    status_code=204,
    response_model=None,
)
def dismiss_from_shortlist(id: UUID) -> Response:
    """Remove a shortlist entry by id (dismissFromShortlist).

    UUID-ified per the contract note: keyed by the shortlist entry id, not
    the mock's role-string key. 404 envelope on unknown id.
    """
    if id not in store.shortlist:
        raise NotFoundError(f"shortlist/{id}")
    del store.shortlist[id]
    return Response(status_code=204)
