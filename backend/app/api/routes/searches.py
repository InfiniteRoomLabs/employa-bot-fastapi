"""Searches resource -- the MOCK ROUTE PATTERN exemplar.

======================================================================
PATTERN RULES (phase-2 agents: copy this file, keep every rule)
======================================================================

1. ROUTER
   * One ``APIRouter`` per resource, ``tags=[<contract tag>]``.
   * The tag MUST match the resource's ``tags:`` in mvp-api.yaml.
   * Register the router in ``app/api/main.py``.

2. operationId  (NON-NEGOTIABLE)
   * Every route sets ``operation_id="<exactContractId>"`` EXPLICITLY,
     matching mvp-api.yaml verbatim (getSearch, createSearch, ...).
     The drift test fails if an id is missing, wrong, or extra.

3. response_model + status_code
   * Set ``response_model=`` to the generated model from
     ``app.schemas`` (or ``list[Model]`` for collections).
   * POST creators set ``status_code=201`` to match the contract.
   * NO auth dependencies on mock-API routes -- mock parity, the mock
     api.ts is unauthenticated.

4. STORE ACCESS
   * Read/write ``app.store`` module dicts directly
     (``store.searches``). Never hold a copy across a request.
   * Path ids arrive as ``uuid.UUID`` (declare the param as ``UUID``);
     the store is keyed by ``UUID``.

5. ERROR RAISING
   * Raise the typed domain errors from ``app.api.errors``
     (``NotFoundError`` etc.) -- NEVER ``HTTPException``. The registered
     handlers turn them into the ``{kind, path, message}`` envelope with
     the correct status. Unknown id on an id-addressed route -> 404.

6. MERGE SEMANTICS
   * Mirror the mock api.ts behavior exactly (read it first). For partial
     updates use ``model_copy(update=incoming.model_dump(exclude_unset=True))``
     so only client-sent fields override.

Note for later phases (transitionApplication): pydantic does NOT enforce the
contract's conditional rule (``resumeId`` required when ``targetStage=applied``).
That if/then lives in ROUTE LOGIC -- raise ``ValidationTaggedError`` (422) there,
do not expect the model to catch it.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Body

from app import store
from app.api.errors import NotFoundError
from app.schemas import CreateSearchInput, Search, SearchCriteria, State

router = APIRouter(tags=["searches"])


@router.get("/searches", operation_id="getSearches", response_model=list[Search])
def get_searches() -> list[Search]:
    """Saved searches (getSearches)."""
    return list(store.searches.values())


@router.get("/searches/{id}", operation_id="getSearch", response_model=Search)
def get_search(id: UUID) -> Search:
    """One saved search (getSearch). 404 envelope on unknown id."""
    hit = store.searches.get(id)
    if hit is None:
        raise NotFoundError(f"searches/{id}")
    return hit


@router.post(
    "/searches",
    operation_id="createSearch",
    response_model=Search,
    status_code=201,
)
def create_search(body: CreateSearchInput) -> Search:
    """Create a saved search (createSearch, ADD-010).

    Mirrors mock api.ts: new id, ``state=active``, zeroed counts and spend,
    criteria = blank defaults overlaid with the client-sent criteria fields.
    """
    merged = store.BLANK_CRITERIA.model_copy(
        update=body.criteria.model_dump(exclude_unset=True)
    )
    new_search = Search(
        id=uuid4(),
        name=body.name,
        state=State.active,
        criteria=merged,
        jobsInInbox=0,
        activeApplications=0,
        shortlisted=0,
        offers=0,
        spendMoUsd=0,
    )
    store.searches[new_search.id] = new_search
    return new_search


@router.patch(
    "/searches/{id}", operation_id="updateSearchCriteria", response_model=Search
)
def update_search_criteria(
    id: UUID,
    criteria: Annotated[SearchCriteria, Body(embed=True)],
) -> Search:
    """Update search criteria in-place (updateSearchCriteria, ADD-006).

    Request body is ``{"criteria": {...}}`` per the contract (``embed=True``).
    Mirrors mock api.ts merge semantics: existing criteria overlaid with the
    client-sent criteria fields; all other Search fields are preserved.
    """
    existing = store.searches.get(id)
    if existing is None:
        raise NotFoundError(f"searches/{id}")
    merged = existing.criteria.model_copy(
        update=criteria.model_dump(exclude_unset=True)
    )
    updated = existing.model_copy(update={"criteria": merged})
    store.searches[id] = updated
    return updated
