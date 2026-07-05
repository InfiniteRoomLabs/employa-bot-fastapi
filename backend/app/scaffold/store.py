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

from app.scaffold.models import (
    Agent,
    AgentLogEntry,
    AgentLogKind,
    AgentPermission,
    AgentState,
    AgentTrustTier,
    Author,
    CoachDiff,
    CoachMessage,
    CoachProposal,
    CoachSubject,
    CoachThread,
    CoachThreadScope,
    ContextCard,
    DraftAttachment,
    Kind4,
    RemotePolicy,
    ReviewQueueItem,
    Search,
    SearchCriteria,
    State,
    TrustTierRung,
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


def _mock_uuid(slug: str) -> UUID:
    """Deterministic ``uuid5`` for a fixture identifier that is NOT already
    UUID-shaped (``AGENTS_DATA`` ids like ``"stale"``, ``COACH_THREADS`` ids
    like ``"stripe-followup"``, and synthetic review-queue entries derived
    from ``AGENT_LOG``). Namespaced under the stdlib ``NAMESPACE_URL`` with a
    ``"mock:"`` prefix so the same slug always yields the same id across
    process restarts -- callers never need to persist a slug -> UUID mapping.
    """
    return uuid5(NAMESPACE_URL, f"mock:{slug}")


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
# agents
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts AGENTS_DATA to the FROZEN wire shape:
#   icon, stateLabel  -> dropped (presentation copy; client owns it, like
#                        Search's `eyebrow`)
#   cost   '$0.08'    -> costUsd  0.08
#   lastActivity 'Xh ago' / 'just now' -> iso_ago(hours=X) / iso_ago()
#
# Agent ids are non-UUID slugs in fixtures.ts ("stale", "ghost", "coach") --
# converted via the deterministic ``_mock_uuid`` helper (see above).

AGENT_ID_STALE = _mock_uuid("agent:stale")
AGENT_ID_GHOST = _mock_uuid("agent:ghost")
AGENT_ID_COACH = _mock_uuid("agent:coach")


def _seed_agents() -> dict[UUID, Agent]:
    return {
        AGENT_ID_STALE: Agent(
            id=AGENT_ID_STALE,
            name="Stale-detector",
            state=AgentState.running,
            lastActivity=iso_ago(hours=1),
            actions=88,
            costUsd=0.08,
            description="Flags applications past usual response time for that company / role.",
            live=True,
            trustTier=AgentTrustTier.suggest,
        ),
        AGENT_ID_GHOST: Agent(
            id=AGENT_ID_GHOST,
            name="Ghost-detector",
            state=AgentState.running,
            lastActivity=iso_ago(hours=4),
            actions=64,
            costUsd=0.06,
            description="Auto-marks REJECTED after 21 days of silence. Configurable threshold.",
            live=True,
            trustTier=AgentTrustTier.act_with_approval,
        ),
        AGENT_ID_COACH: Agent(
            id=AGENT_ID_COACH,
            name="Coach",
            state=AgentState.demand,
            lastActivity=iso_ago(),
            actions=23,
            costUsd=0.92,
            description='Reactive -- runs when you open chat or click "draft follow-up".',
            live=None,
            trustTier=AgentTrustTier.observe,
        ),
    }


# Live store. Never reassigned -- mutated in place so imported references stay
# valid. Routes read/write ``store.agents``.
agents: dict[UUID, Agent] = _seed_agents()


# Trust-tier ladder (D25 / AGT-031) -- shared across all agents. Only ``tier``
# survives to the wire shape; fixtures.ts label/blurb are client-owned copy
# (TrustTierRung schema comment: "label/blurb were UI copy").
TRUST_TIER_LADDER: list[TrustTierRung] = [
    TrustTierRung(tier=AgentTrustTier.observe),
    TrustTierRung(tier=AgentTrustTier.suggest),
    TrustTierRung(tier=AgentTrustTier.act_with_approval),
    TrustTierRung(tier=AgentTrustTier.autonomous),
]

# Maps a permission label to the trust tier at which it becomes in-tier
# (fixtures.ts PERMISSION_REQUIRED_TIER). getAgentPermissions enriches each
# grant with this at read time; unknown permissions default to 'observe'.
PERMISSION_REQUIRED_TIER: dict[str, AgentTrustTier] = {
    "Read application stage": AgentTrustTier.observe,
    "Write follow-up draft": AgentTrustTier.suggest,
    "Auto-send follow-ups": AgentTrustTier.autonomous,
    "Mark applications rejected": AgentTrustTier.autonomous,
}


def _seed_agent_permissions() -> dict[UUID, list[AgentPermission]]:
    """Ported from fixtures.ts PER_AGENT_PERMISSIONS. ``requiredTier`` is
    deliberately NOT baked in here -- the route enriches it at read time via
    ``PERMISSION_REQUIRED_TIER``, mirroring the mock's ``getAgentPermissions``.
    """
    return {
        AGENT_ID_STALE: [
            AgentPermission(permission="Read application stage", granted=True),
            AgentPermission(permission="Write follow-up draft", granted=True),
            AgentPermission(permission="Auto-send follow-ups", granted=False),
            AgentPermission(permission="Mark applications rejected", granted=False),
        ],
        AGENT_ID_GHOST: [
            AgentPermission(permission="Read application stage", granted=True),
            AgentPermission(permission="Write follow-up draft", granted=False),
            AgentPermission(permission="Auto-send follow-ups", granted=False),
            AgentPermission(permission="Mark applications rejected", granted=True),
        ],
        AGENT_ID_COACH: [
            AgentPermission(permission="Read application stage", granted=True),
            AgentPermission(permission="Write follow-up draft", granted=True),
            AgentPermission(permission="Auto-send follow-ups", granted=False),
            AgentPermission(permission="Mark applications rejected", granted=False),
        ],
    }


agent_permissions: dict[UUID, list[AgentPermission]] = _seed_agent_permissions()


# Ported from fixtures.ts AGENT_LOG. The fixture's clock-time strings ("12:51",
# "Yesterday 18:43", ...) don't carry a fixed "today" anchor to reconstruct
# exact offsets from, so timestamps below are a JUDGMENT CALL: monotonically
# increasing ``iso_ago`` offsets that preserve the fixture's newest-first
# ordering and rough same-day-vs-yesterday spacing, not exact wall-clock
# reproductions.
def _seed_agent_log() -> list[AgentLogEntry]:
    return [
        AgentLogEntry(
            time=iso_ago(minutes=9),
            agentId=AGENT_ID_STALE,
            kind=AgentLogKind.auto,
            message="Flagged Stripe as stale (9d, median 6d)",
            ref="Stripe · Staff Engineer",
        ),
        AgentLogEntry(
            time=iso_ago(minutes=10),
            agentId=AGENT_ID_COACH,
            kind=AgentLogKind.await_,
            message="Drafted follow-up for Stripe — awaiting your send",
            ref="Stripe · Staff Engineer",
        ),
        AgentLogEntry(
            time=iso_ago(hours=1, minutes=46),
            agentId=AGENT_ID_GHOST,
            kind=AgentLogKind.auto,
            message="Auto-marked Convex REJECTED — no response 28d",
            ref="Convex · Staff Engineer",
        ),
        AgentLogEntry(
            time=iso_ago(hours=4, minutes=46),
            agentId=AGENT_ID_STALE,
            kind=AgentLogKind.auto,
            message="Checked 14 applications · 1 newly stale",
            ref="Tracked applications",
        ),
        AgentLogEntry(
            time=iso_ago(hours=20, minutes=17),
            agentId=AGENT_ID_COACH,
            kind=AgentLogKind.success,
            message="Sent follow-up to Linear (your click)",
            ref="Linear · Staff Engineer",
        ),
        AgentLogEntry(
            time=iso_ago(days=1, hours=3, minutes=30),
            agentId=AGENT_ID_GHOST,
            kind=AgentLogKind.skipped,
            message="Held off on Sentry — recruiter replied within window",
            ref="Sentry · Staff Engineer",
        ),
    ]


agent_log: list[AgentLogEntry] = _seed_agent_log()


def review_queue_items() -> list[ReviewQueueItem]:
    """Derive the review queue from ``agent_log`` (kind == 'await'), mirroring
    the mock's ``getReviewQueue`` (a filtered view over AGENT_LOG, no separate
    store). DEFERRED op (DECISIONS-NEEDED #1) -- stubbed for UI parity.

    Each item's ``id`` is a deterministic ``uuid5`` of its ``(ref, message)``
    pair (AgentLogEntry itself has no ``id`` in the contract), so the same
    pending entry always resolves to the same approve/reject id.
    """
    return [
        ReviewQueueItem(
            id=_mock_uuid(f"review-queue:{entry.ref}:{entry.message}"),
            agentId=entry.agentId,
            message=entry.message,
            time=entry.time,
        )
        for entry in agent_log
        if entry.kind == AgentLogKind.await_
    ]


# ---------------------------------------------------------------------------
# coach
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts COACH_THREADS / COACH_MESSAGES / COACH_CONTEXT_*.
# Thread ids are non-UUID slugs in fixtures.ts ("stripe-followup", ...) --
# converted via the deterministic ``_mock_uuid`` helper. ``when`` values
# ("now", "1h", "3h", "Yesterday", "1w") map onto ``iso_ago`` accordingly.

THREAD_ID_STRIPE = _mock_uuid("coach-thread:stripe-followup")
THREAD_ID_LINEAR = _mock_uuid("coach-thread:linear-prep")
THREAD_ID_VERCEL = _mock_uuid("coach-thread:vercel-counter")
THREAD_ID_SUPABASE = _mock_uuid("coach-thread:supabase-tailor")
THREAD_ID_GENERAL = _mock_uuid("coach-thread:general")


def _seed_coach_threads() -> dict[UUID, CoachThread]:
    return {
        THREAD_ID_STRIPE: CoachThread(
            id=THREAD_ID_STRIPE,
            title="Stripe follow-up",
            scope=CoachThreadScope.application,
            when=iso_ago(),
            active=True,
        ),
        THREAD_ID_LINEAR: CoachThread(
            id=THREAD_ID_LINEAR,
            title="Prep for Linear screen",
            scope=CoachThreadScope.application,
            when=iso_ago(hours=1),
        ),
        THREAD_ID_VERCEL: CoachThread(
            id=THREAD_ID_VERCEL,
            title="Vercel counter-offer",
            scope=CoachThreadScope.application,
            when=iso_ago(hours=3),
        ),
        THREAD_ID_SUPABASE: CoachThread(
            id=THREAD_ID_SUPABASE,
            title="Tailor resume - Supabase",
            scope=CoachThreadScope.résumé,
            when=iso_ago(days=1),
        ),
        THREAD_ID_GENERAL: CoachThread(
            id=THREAD_ID_GENERAL,
            title="General strategy",
            scope=CoachThreadScope.general,
            when=iso_ago(days=7),
        ),
    }


coach_threads: dict[UUID, CoachThread] = _seed_coach_threads()


def _seed_coach_messages() -> list[CoachMessage]:
    """Ported from fixtures.ts COACH_MESSAGES. Per api.ts ``getCoachThread``,
    ONLY the "stripe-followup" thread realizes messages in the source design
    -- every other thread correctly returns an empty list (CUR-024 empty
    state). ``CoachMessage.id`` stays the fixture's own string id (contract
    types it ``string``, not uuid).
    """
    return [
        CoachMessage(
            id="m1",
            author=Author.bot,
            text=(
                "9 days is past Stripe's usual response window (median 6d for "
                "this team). Want me to draft a short, non-needy follow-up?"
            ),
        ),
        CoachMessage(
            id="m2",
            author=Author.user,
            text="yes please. keep it under 4 sentences.",
        ),
        CoachMessage(
            id="m3",
            author=Author.bot,
            text="Here's a draft - aimed at Maya:",
            draft=(
                "Hi Maya - circling back on the Staff Engineer, Payments core "
                "role. Happy to walk through the 2M-events/sec ingest pipeline "
                "I built if useful. No rush - just staying on your radar. - Wes"
            ),
            draftAttachments=[
                DraftAttachment(name="Distributed-systems v4", kind=Kind4.resume),
                DraftAttachment(name="Stripe cover letter", kind=Kind4.cover_letter),
            ],
        ),
        CoachMessage(
            id="m4",
            author=Author.user,
            text=(
                "actually can you make it more specific? I want to mention the "
                "multi-region migration"
            ),
        ),
        CoachMessage(
            id="m5",
            author=Author.bot,
            text=(
                "One sec - pulling the multi-region migration numbers from your "
                "Distributed-systems resume."
            ),
            typing=True,
        ),
    ]


coach_messages: list[CoachMessage] = _seed_coach_messages()


# Canonical fallback context cards (fixtures.ts COACH_CONTEXT_CARDS), used by
# getCoachThread when a thread id has no entry in ``coach_context_by_thread``.
COACH_CONTEXT_CARDS: list[ContextCard] = [
    ContextCard(
        label="Application",
        body="Stripe - Staff Engineer, Payments core - applied 9d ago - stale",
    ),
    ContextCard(label="Résumé attached", body="Distributed-systems v4"),
    ContextCard(
        label="JD excerpt",
        body=(
            "Build and own payment-path services at scale. Idempotency, "
            "ledgering, multi-region. 8+ years backend, distributed systems "
            "required..."
        ),
    ),
    ContextCard(label="Prior threads", body='"Tailor for Stripe" - Feb 28'),
]


def _seed_coach_context_by_thread() -> dict[UUID, list[ContextCard]]:
    """Ported from fixtures.ts COACH_CONTEXT_BY_THREAD (COA-021)."""
    return {
        THREAD_ID_STRIPE: [
            ContextCard(
                label="Application",
                body="Stripe - Staff Engineer, Payments core - applied 9d ago - stale",
            ),
            ContextCard(label="Resume attached", body="Distributed-systems v4"),
            ContextCard(
                label="JD excerpt",
                body=(
                    "Build and own payment-path services at scale. Idempotency, "
                    "ledgering, multi-region. 8+ years backend, distributed "
                    "systems required..."
                ),
            ),
            ContextCard(label="Prior threads", body='"Tailor for Stripe" - Feb 28'),
        ],
        THREAD_ID_LINEAR: [
            ContextCard(
                label="Application",
                body="Linear - Senior Staff Engineer, Platform - recruiter screen Thu 11:00",
            ),
            ContextCard(label="Resume attached", body="Distributed-systems v4"),
            ContextCard(
                label="Interview type",
                body="Recruiter screen - 30 min - with Sara Lim, recruiting",
            ),
        ],
        THREAD_ID_VERCEL: [
            ContextCard(
                label="Application",
                body="Vercel - Staff Engineer, Edge runtime - offer received",
            ),
            ContextCard(
                label="Offer details",
                body="$265k base + 0.4% equity - decide by Friday",
            ),
            ContextCard(
                label="Counter target",
                body="$285k base + larger equity grant - coach drafted",
            ),
        ],
        THREAD_ID_SUPABASE: [
            ContextCard(
                label="Application",
                body="Supabase - Principal Engineer, Realtime - applied 3d ago",
            ),
            ContextCard(label="Resume basis", body="Platform / infra v2"),
            ContextCard(
                label="Tailoring goal",
                body="Surface realtime / streaming systems work, downplay product-side scope",
            ),
        ],
        THREAD_ID_GENERAL: [
            ContextCard(
                label="Context",
                body="General strategy session - no specific application",
            ),
            ContextCard(
                label="Active searches",
                body="Staff / Principal - Platform - remote (62 days running)",
            ),
        ],
    }


coach_context_by_thread: dict[UUID, list[ContextCard]] = _seed_coach_context_by_thread()


def _seed_coach_proposal_fixtures() -> dict[CoachThreadScope, CoachProposal]:
    """Ported from fixtures.ts COACH_PROPOSAL_FIXTURES -- canned proposals so
    the DEFERRED ``proposeCoachEdit`` stub returns a believable diff per scope.
    Falls back to the 'résumé' fixture for any other scope (mirrors mock).
    """
    return {
        CoachThreadScope.résumé: CoachProposal(
            id="prop-resume-1",
            subject=CoachSubject(scope=CoachThreadScope.résumé, label="this resume"),
            summary="Tightened the ingest-pipeline bullet to lead with the quantified result.",
            diff=[
                CoachDiff(
                    field="Experience bullet",
                    before=(
                        "Worked on the events ingest pipeline and improved its "
                        "performance significantly."
                    ),
                    after="Cut ingest pipeline p99 from 340ms to 45ms at 2M events/sec.",
                )
            ],
            status="pending",
        ),
        CoachThreadScope.answer: CoachProposal(
            id="prop-answer-1",
            subject=CoachSubject(scope=CoachThreadScope.answer, label="this answer"),
            summary='Made the "why us" answer more specific and shorter.',
            diff=[
                CoachDiff(
                    field="Answer body",
                    before=(
                        "I am interested in this company because it seems like a "
                        "great place to work with good people."
                    ),
                    after=(
                        "I gravitate toward teams shipping developer-facing "
                        "infrastructure where reliability is a feature."
                    ),
                )
            ],
            status="pending",
        ),
    }


COACH_PROPOSAL_FIXTURES: dict[CoachThreadScope, CoachProposal] = (
    _seed_coach_proposal_fixtures()
)


# ---------------------------------------------------------------------------
# reset -- restore every store to pristine fixture state. Called by the
# scaffold test conftest between tests; phase-2 agents extend this.
# ---------------------------------------------------------------------------


def reset() -> None:
    """Restore all in-memory stores to their pristine seeded state."""
    searches.clear()
    searches.update(_seed_searches())
    agents.clear()
    agents.update(_seed_agents())
    agent_permissions.clear()
    agent_permissions.update(_seed_agent_permissions())
    agent_log.clear()
    agent_log.extend(_seed_agent_log())
    coach_threads.clear()
    coach_threads.update(_seed_coach_threads())
    coach_messages.clear()
    coach_messages.extend(_seed_coach_messages())
    coach_context_by_thread.clear()
    coach_context_by_thread.update(_seed_coach_context_by_thread())
    # Phase-2 agents: add ``<res>.clear(); <res>.update(_seed_<res>())`` here.
