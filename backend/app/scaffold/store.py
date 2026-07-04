"""In-memory data store for the scaffold backend.

This is the server-side port of the mockup's mock data layer
(``../employa-bot-front-end/src/data/fixtures.ts``). It holds one module-level
dict per resource, keyed by the resource's UUID, seeded from the ported
fixtures. There is NO database: the scaffold exists so the mockup UI can run
against real FastAPI routes while the real persistence layer is written later.

Conventions for phase-2 agents adding resources:

* One ``_<resource>: dict[UUID, <Model>]`` module global per resource.
* One ``_seed_<resource>() -> dict[UUID, <Model>]`` pure builder that returns a
  fresh pristine copy from fixtures (no shared mutable state across resets).
* Register the resource in :func:`reset` so ``reset()`` restores every store.
* Expose the live dict via a module-level name (routes read ``store._<res>``)
  OR add a small accessor; keep it boring and consistent.
* Well-known UUIDs from ``fixtures.ts`` are reproduced VERBATIM (see the search
  ids below) so the frontend's hard-coded ids resolve.
* Fixtures with RELATIVE timestamps ("2d ago") become absolute ISO instants
  computed relative to :data:`PROCESS_START` (see ``iso_ago`` helper). Search
  fixtures have no timestamps, so none are used here yet -- the helper is
  provided for phase-2 resources (applications, jobs, agents, ...).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.scaffold.models import (
    RemotePolicy,
    Search,
    SearchCriteria,
    State,
)

# Baseline captured once at import so relative fixture ages are stable for the
# life of the process and reproducible across a reset().
PROCESS_START: datetime = datetime.now(UTC)


def iso_ago(*, days: float = 0, hours: float = 0, minutes: float = 0) -> datetime:
    """Absolute instant ``PROCESS_START - delta``, for porting relative ages.

    Phase-2 helper: a fixture that read "2d ago" becomes
    ``iso_ago(days=2)``. Returns a timezone-aware datetime; pydantic's
    ``AwareDatetime`` fields serialize it to ISO-8601 UTC.
    """
    return PROCESS_START - timedelta(days=days, hours=hours, minutes=minutes)


# ---------------------------------------------------------------------------
# Well-known UUIDs (verbatim from fixtures.ts). Keep these EXACT.
# ---------------------------------------------------------------------------

SEARCH_ID_PLATFORM = UUID("7c0b1f3a-2d4e-4a8c-9b21-1f8c5e3a0d12")
SEARCH_ID_BACKEND = UUID("b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30")
SEARCH_ID_AI_INFRA = UUID("ad9e6c14-5b80-4f17-a3d2-7e6f9c1b0a55")


# ---------------------------------------------------------------------------
# searches (exemplar resource)
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts SEARCHES to the FROZEN wire shape (CONTRACT-NOTES.md):
#   remotePolicy 'Required'   -> RemotePolicy.required
#   baseFloor    '$210k'      -> baseFloorUsd    210000
#   baseCeiling  '$285k'      -> baseCeilingUsd  285000
#   yearsExperience '8-14 yrs'-> yearsExperienceMin 8 / yearsExperienceMax 14
#   spendMo      '$0.56'      -> spendMoUsd       0.56
#   eyebrow field             -> dropped (presentation copy; client owns it)


def _seed_searches() -> dict[UUID, Search]:
    return {
        SEARCH_ID_PLATFORM: Search(
            id=SEARCH_ID_PLATFORM,
            name="Staff / Principal - Platform - remote",
            state=State.active,
            criteria=SearchCriteria(
                titlesInclude=[
                    "Staff Engineer",
                    "Senior Staff Engineer",
                    "Principal Engineer",
                    "Platform Lead",
                ],
                titlesExclude=["Engineering Manager", "Director", "On-call lead"],
                locations=["Remote - US", "Remote - US/EU", "Remote - global"],
                remotePolicy=RemotePolicy.required,
                maxCommuteMin=0,
                baseFloorUsd=210000,
                baseCeilingUsd=285000,
                yearsExperienceMin=8,
                yearsExperienceMax=14,
            ),
            jobsInInbox=42,
            activeApplications=14,
            shortlisted=22,
            offers=1,
            spendMoUsd=0.56,
        ),
        SEARCH_ID_BACKEND: Search(
            id=SEARCH_ID_BACKEND,
            name="Senior+ Backend - remote",
            state=State.active,
            criteria=SearchCriteria(
                titlesInclude=[
                    "Staff Engineer",
                    "Senior Staff Engineer",
                    "Principal Engineer",
                ],
                titlesExclude=["Engineering Manager", "Director"],
                locations=["Remote - US", "Remote - US/EU"],
                remotePolicy=RemotePolicy.required,
                maxCommuteMin=0,
                baseFloorUsd=220000,
                baseCeilingUsd=320000,
                yearsExperienceMin=8,
                yearsExperienceMax=14,
            ),
            jobsInInbox=9,
            activeApplications=3,
            shortlisted=6,
            offers=0,
            spendMoUsd=0.31,
        ),
        SEARCH_ID_AI_INFRA: Search(
            id=SEARCH_ID_AI_INFRA,
            name="AI infra / inference - remote",
            state=State.paused,
            criteria=SearchCriteria(
                titlesInclude=[
                    "Staff Engineer",
                    "Member of Technical Staff",
                    "Principal Engineer",
                ],
                titlesExclude=["Engineering Manager", "Director"],
                locations=["Remote - US", "Remote - global"],
                remotePolicy=RemotePolicy.required,
                maxCommuteMin=0,
                baseFloorUsd=230000,
                baseCeilingUsd=320000,
                yearsExperienceMin=8,
                yearsExperienceMax=14,
            ),
            jobsInInbox=2,
            activeApplications=1,
            shortlisted=4,
            offers=0,
            spendMoUsd=0.04,
        ),
    }


# Live store. Never reassigned -- mutated in place so imported references stay
# valid. Routes read/write ``store.searches``.
searches: dict[UUID, Search] = _seed_searches()


# ---------------------------------------------------------------------------
# Blank defaults (createSearch merge base). Mirrors fixtures.ts BLANK_CRITERIA
# semantics: unset criteria fields take empty/zero defaults.
# ---------------------------------------------------------------------------

BLANK_CRITERIA: SearchCriteria = SearchCriteria(
    titlesInclude=[],
    titlesExclude=[],
    locations=[],
    remotePolicy=RemotePolicy.remote_ok,
    maxCommuteMin=0,
    baseFloorUsd=0,
    baseCeilingUsd=0,
)


# ---------------------------------------------------------------------------
# reset -- restore every store to pristine fixture state. Called by the
# scaffold test conftest between tests; phase-2 agents extend this.
# ---------------------------------------------------------------------------


def reset() -> None:
    """Restore all in-memory stores to their pristine seeded state."""
    searches.clear()
    searches.update(_seed_searches())
    # Phase-2 agents: add ``<res>.clear(); <res>.update(_seed_<res>())`` here.
