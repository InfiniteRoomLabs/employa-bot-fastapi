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
from uuid import NAMESPACE_URL, UUID, uuid5

from pydantic import AnyUrl

from app.scaffold.models import (
    Accomplishment,
    Answer,
    Category,
    Contact,
    Credential,
    Link,
    Project,
    RemotePolicy,
    Search,
    SearchCriteria,
    Source1,
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


def _fixture_uuid(legacy_id: str) -> UUID:
    """Deterministic UUID5 for a fixtures.ts legacy slug id (library resources).

    fixtures.ts library entries use human-readable slugs ("ct-sarah-chen",
    "pj-ingest", ...) instead of UUIDs, but the wire contract requires
    ``format: uuid`` ids. Each slug maps to a stable uuid5 derived from it
    (stdlib ``NAMESPACE_URL`` + a namespaced string), so the mapping is
    reproducible across process restarts without hard-coding random UUIDs.
    """
    return uuid5(NAMESPACE_URL, f"employa-bot-front-end/fixtures:{legacy_id}")


# Library well-known ids (deterministic uuid5 from fixtures.ts slugs, see
# ``_fixture_uuid`` above -- these are NOT verbatim fixture ids, unlike the
# searches ids above which already were real UUIDs in fixtures.ts).
CONTACT_ID_SARAH_CHEN = _fixture_uuid("ct-sarah-chen")
CONTACT_ID_MARCUS_LEE = _fixture_uuid("ct-marcus-lee")
CONTACT_ID_PRIYA_R = _fixture_uuid("ct-priya-r")

PROJECT_ID_INGEST = _fixture_uuid("pj-ingest")
PROJECT_ID_TOOLING = _fixture_uuid("pj-tooling")

ACCOMPLISHMENT_ID_P99 = _fixture_uuid("ac-p99")
ACCOMPLISHMENT_ID_PLATFORM = _fixture_uuid("ac-platform")
ACCOMPLISHMENT_ID_COST = _fixture_uuid("ac-cost")

ANSWER_ID_COMP = _fixture_uuid("an-comp")
ANSWER_ID_WHY = _fixture_uuid("an-why")
ANSWER_ID_AUTH = _fixture_uuid("an-auth")
ANSWER_ID_NOTICE = _fixture_uuid("an-notice")


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
# library: contacts, projects, accomplishments, answers, credentials
# ---------------------------------------------------------------------------
#
# Ported verbatim (content-wise) from fixtures.ts CONTACTS/PROJECTS/
# ACCOMPLISHMENTS/ANSWERS/CREDENTIALS. Relative "updated" ages become
# ``iso_ago(...)`` instants; slug ids become ``_fixture_uuid(...)`` (see
# above). CREDENTIALS is empty in fixtures.ts too -- no seed data yet.


def _seed_contacts() -> dict[UUID, Contact]:
    return {
        CONTACT_ID_SARAH_CHEN: Contact(
            id=CONTACT_ID_SARAH_CHEN,
            name="Sarah Chen",
            role="Staff Recruiter",
            org="Vercel",
            email="sarah.chen@example.com",
            phone="",
            relationship="Recruiter (inbound via LinkedIn)",
            isReference=False,
            tags=["recruiter", "vercel"],
            links=[
                Link(label="LinkedIn", url=AnyUrl("https://linkedin.com/in/example"))
            ],
            notes="Sourced the Edge Runtime Staff role. Responsive over email.",
            updated=iso_ago(days=3),
        ),
        CONTACT_ID_MARCUS_LEE: Contact(
            id=CONTACT_ID_MARCUS_LEE,
            name="Marcus Lee",
            role="Engineering Manager",
            org="Northwind",
            email="marcus@example.com",
            phone="",
            relationship="Former manager",
            isReference=True,
            tags=["reference", "former-manager"],
            links=[],
            notes=(
                "Will vouch for the payments-core p99 work. Confirmed "
                "willing to be a reference."
            ),
            updated=iso_ago(days=7),
        ),
        CONTACT_ID_PRIYA_R: Contact(
            id=CONTACT_ID_PRIYA_R,
            name="Priya Raman",
            role="Principal Engineer",
            org="Lumen Labs",
            email="priya@example.com",
            phone="",
            relationship="Former peer",
            isReference=True,
            tags=["reference", "peer"],
            links=[],
            notes="Co-built the internal tooling platform. Strong technical reference.",
            updated=iso_ago(days=14),
        ),
    }


def _seed_projects() -> dict[UUID, Project]:
    return {
        PROJECT_ID_INGEST: Project(
            id=PROJECT_ID_INGEST,
            title="Real-time ingest pipeline",
            employer="Northwind",
            body=(
                "Rebuilt the events ingest path: backpressure, batching, and a "
                "workload-aware autoscaler. Cut p99 340ms -> 45ms at 2M events/sec. "
                "The migration was the hard part -- dual-writing while draining the "
                "old queue."
            ),
            tags=["distributed-systems", "performance", "kafka"],
            updated=iso_ago(days=14),
        ),
        PROJECT_ID_TOOLING: Project(
            id=PROJECT_ID_TOOLING,
            title="Internal developer platform",
            employer="Lumen Labs",
            body=(
                "Built the paved-road tooling 120+ engineers use daily: project "
                "scaffolding, CI templates, and a service catalog. Halved build "
                "times and cut the flake rate 80% by quarantining and "
                "auto-retrying known-flaky tests."
            ),
            tags=["platform", "developer-experience", "ci"],
            updated=iso_ago(days=21),
        ),
    }


def _seed_accomplishments() -> dict[UUID, Accomplishment]:
    return {
        ACCOMPLISHMENT_ID_P99: Accomplishment(
            id=ACCOMPLISHMENT_ID_P99,
            title="Cut ingest p99 by 87%",
            summary=(
                "Led the redesign of the events ingest pipeline, cutting p99 "
                "latency from 340ms to 45ms at 2M events/sec."
            ),
            tags=["performance", "distributed-systems"],
            source=Source1(projectId=PROJECT_ID_INGEST),
            usedIn=3,
            updated=iso_ago(days=14),
        ),
        ACCOMPLISHMENT_ID_PLATFORM: Accomplishment(
            id=ACCOMPLISHMENT_ID_PLATFORM,
            title="Platform used by 120+ engineers",
            summary=(
                "Built and ran the internal developer platform adopted by "
                "every engineering team; halved build times."
            ),
            tags=["platform", "leadership"],
            source=Source1(projectId=PROJECT_ID_TOOLING),
            usedIn=2,
            updated=iso_ago(days=21),
        ),
        ACCOMPLISHMENT_ID_COST: Accomplishment(
            id=ACCOMPLISHMENT_ID_COST,
            title="Reduced compute cost 38%",
            summary=(
                "Designed workload-aware autoscaling that cut compute spend "
                "38% with no latency regression."
            ),
            tags=["cost", "infrastructure"],
            source=None,
            usedIn=1,
            updated=iso_ago(days=30),
        ),
    }


def _seed_answers() -> dict[UUID, Answer]:
    return {
        ANSWER_ID_COMP: Answer(
            id=ANSWER_ID_COMP,
            question="What are your compensation expectations?",
            body=(
                "Targeting total comp in the 280-340k range for a Staff-level "
                "role, flexible on the base/equity split. Open to discussing "
                "once I understand the full picture."
            ),
            category=Category.compensation,
            tags=["salary"],
            updated=iso_ago(days=7),
        ),
        ANSWER_ID_WHY: Answer(
            id=ANSWER_ID_WHY,
            question="Why are you interested in this company?",
            body=(
                "I gravitate toward teams shipping developer-facing "
                "infrastructure where reliability is a feature. [Customize "
                "per company.]"
            ),
            category=Category.motivation,
            tags=["why-us"],
            updated=iso_ago(days=14),
        ),
        ANSWER_ID_AUTH: Answer(
            id=ANSWER_ID_AUTH,
            question="Are you authorized to work in the US?",
            body="Yes -- US citizen, no sponsorship required.",
            category=Category.work_authorization,
            tags=["work-auth"],
            updated=iso_ago(days=30),
        ),
        ANSWER_ID_NOTICE: Answer(
            id=ANSWER_ID_NOTICE,
            question="What is your notice period / availability?",
            body=(
                "Two weeks from signing. Currently between roles, so timing "
                "is flexible."
            ),
            category=Category.logistics,
            tags=["notice"],
            updated=iso_ago(days=30),
        ),
    }


def _seed_credentials() -> dict[UUID, Credential]:
    return {}


# Live stores. Never reassigned -- mutated in place so imported references
# stay valid. Routes read/write ``store.<resource>``.
contacts: dict[UUID, Contact] = _seed_contacts()
projects: dict[UUID, Project] = _seed_projects()
accomplishments: dict[UUID, Accomplishment] = _seed_accomplishments()
answers: dict[UUID, Answer] = _seed_answers()
credentials: dict[UUID, Credential] = _seed_credentials()


# ---------------------------------------------------------------------------
# reset -- restore every store to pristine fixture state. Called by the
# scaffold test conftest between tests; phase-2 agents extend this.
# ---------------------------------------------------------------------------


def reset() -> None:
    """Restore all in-memory stores to their pristine seeded state."""
    searches.clear()
    searches.update(_seed_searches())
    contacts.clear()
    contacts.update(_seed_contacts())
    projects.clear()
    projects.update(_seed_projects())
    accomplishments.clear()
    accomplishments.update(_seed_accomplishments())
    answers.clear()
    answers.update(_seed_answers())
    credentials.clear()
    credentials.update(_seed_credentials())
    # Phase-2 agents: add ``<res>.clear(); <res>.update(_seed_<res>())`` here.
