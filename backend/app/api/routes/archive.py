"""Archive resource (ORI-009) -- outcome-bucketed closed applications.

Follows the MOCK ROUTE PATTERN in ``routes/searches.py``. Two read-only ops
tagged ``archive`` per ``mvp-api.yaml``. The ``kind`` -> outcome mapping mirrors
the mock exactly: ``won`` -> outcome WON; ``passed`` -> outcome in
(REJECTED, WITHDRAWN).
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app import store
from app.schemas import ApplicationView, Outcome

router = APIRouter(tags=["archive"])

_PASSED_OUTCOMES: frozenset[Outcome] = frozenset({Outcome.rejected, Outcome.withdrawn})


@router.get("/archive", operation_id="getArchive", response_model=list[ApplicationView])
def get_archive(kind: str = Query(...)) -> list[ApplicationView]:
    """Archived applications by outcome bucket (getArchive, ORI-009).

    ``kind=won`` -> outcome WON; ``kind=passed`` -> outcome in
    (REJECTED, WITHDRAWN). Any other ``kind`` yields the passed bucket's
    predicate falling through to an empty list.
    """
    if kind == "won":
        wanted: frozenset[Outcome] = frozenset({Outcome.won})
    else:
        wanted = _PASSED_OUTCOMES
    return [
        store.application_view(app)
        for app in store.archive.values()
        if app.outcome in wanted
    ]


@router.get("/archive/counts", operation_id="getArchiveCounts")
def get_archive_counts() -> dict[str, int]:
    """Live archive badge counts (getArchiveCounts).

    ``won`` = outcome WON; ``passed`` = outcome in (REJECTED, WITHDRAWN).
    """
    won = sum(1 for app in store.archive.values() if app.outcome == Outcome.won)
    passed = sum(1 for app in store.archive.values() if app.outcome in _PASSED_OUTCOMES)
    return {"won": won, "passed": passed}
