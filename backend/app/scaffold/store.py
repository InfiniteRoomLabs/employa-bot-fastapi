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
    EmailParserFallback,
    ExtensionToken,
    IntegrationRow,
    InvoiceRow,
    Kind5,
    Mode,
    Notification,
    NotifPref,
    Plan,
    PrivacyToggle,
    Profile,
    ProviderRow,
    RemotePolicy,
    RoutingRow,
    Search,
    SearchCriteria,
    Settings,
    State,
    State1,
    State2,
    UsageAggregate,
    UsageRow,
    User,
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

# Notification/extension-token ids in fixtures.ts are bare strings ("n1",
# "tok-001") -- not UUIDs, since the mock never enforced the contract's
# ``format: uuid``. These are freshly minted (not present anywhere else) so
# they are stable across a reset() but are NOT "verbatim from fixtures" the
# way the search ids are.
NOTIFICATION_ID_REPLY = UUID("2f3044aa-2e5d-42ba-bff0-3f1e1ad36af0")
NOTIFICATION_ID_STALE_STRIPE = UUID("409b12de-4762-4591-b9eb-bec7523577a7")
NOTIFICATION_ID_COACH_DRAFT = UUID("8e43b5e7-f128-4390-b723-794b741b60bf")
NOTIFICATION_ID_MATCH_SCORED = UUID("dacf6597-779a-489b-a4be-66d01da1842b")
NOTIFICATION_ID_CAL_SCREEN = UUID("39d1889d-1fbd-4607-9c2d-7ed3b4fd0c77")
NOTIFICATION_ID_GHOST_STALE = UUID("870b2354-b7ba-4823-aac2-cfd43f4041f0")
EXTENSION_TOKEN_ID_BROWSER = UUID("9c84337a-9650-479e-8936-734da1aafbae")


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
# current user (getCurrentUser)
# ---------------------------------------------------------------------------
#
# Ported verbatim from fixtures.ts REMY -- the contract's User schema keeps
# the mock's snake_case field names as-is (name/email/initials/city/current/
# years/comp_floor/target_titles), so no field renaming is needed here.


def _seed_current_user() -> User:
    return User(
        name="Wes Gilleland",
        email="wes.gilleland@gmail.com",
        initials="WG",
        city="Lexington, KY",
        current="Founder & Principal Engineer - Infinite Room Labs",
        years=12,
        comp_floor=210000,
        target_titles=[
            "Staff Engineer",
            "Senior Staff Engineer",
            "Principal Engineer",
            "Platform Lead",
        ],
    )


# Singleton -- reassigned wholesale by reset() (no id-addressed mutation of
# this resource in the frozen contract, unlike ``searches``/``notifications``).
current_user: User = _seed_current_user()


# ---------------------------------------------------------------------------
# notifications (getNotifications, markNotificationRead,
# markAllNotificationsRead -- ORI-012)
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts NOTIFICATIONS (``popovers.jsx :: NotificationsPopover``).
# The mock's ``icon`` field is dropped (presentation, client-owned, same as
# Search.eyebrow). ``id`` was a bare string ("n1") in the mock; see the
# NOTIFICATION_ID_* comment above for why these are freshly minted UUIDs
# rather than reproduced-verbatim ones.


def _seed_notifications() -> dict[UUID, Notification]:
    return {
        NOTIFICATION_ID_REPLY: Notification(
            id=NOTIFICATION_ID_REPLY,
            kind=Kind5.reply,
            title="Recruiter reply - Vercel",
            message='"Would love to chat about comp and start date."',
            actor="12m",
            unread=True,
        ),
        NOTIFICATION_ID_STALE_STRIPE: Notification(
            id=NOTIFICATION_ID_STALE_STRIPE,
            kind=Kind5.agent,
            title="Stale-detector flagged Stripe",
            message="9 days, no response. Coach drafted a follow-up.",
            actor="1h",
            unread=True,
        ),
        NOTIFICATION_ID_COACH_DRAFT: Notification(
            id=NOTIFICATION_ID_COACH_DRAFT,
            kind=Kind5.agent,
            title="Coach drafted a follow-up for Supabase",
            message="Awaiting your review before you send it.",
            actor="3h",
            unread=True,
        ),
        NOTIFICATION_ID_MATCH_SCORED: Notification(
            id=NOTIFICATION_ID_MATCH_SCORED,
            kind=Kind5.match,
            title="Match scored: Stripe - Payments core",
            message="92% against Distributed-systems v4 - the job you just added.",
            actor="4h",
            unread=False,
        ),
        NOTIFICATION_ID_CAL_SCREEN: Notification(
            id=NOTIFICATION_ID_CAL_SCREEN,
            kind=Kind5.cal,
            title="Linear screen - Thursday 11 AM",
            message="Coach prep card is ready.",
            actor="Yesterday",
            unread=False,
        ),
        NOTIFICATION_ID_GHOST_STALE: Notification(
            id=NOTIFICATION_ID_GHOST_STALE,
            kind=Kind5.agent,
            title="Ghost-detector auto-marked Convex rejected",
            message="28 days silence. You can undo.",
            actor="2d",
            unread=False,
        ),
    }


# Live store. Never reassigned -- mutated in place so imported references stay
# valid. Routes read/write ``store.notifications``.
notifications: dict[UUID, Notification] = _seed_notifications()


# ---------------------------------------------------------------------------
# settings + usage aggregate (getSettings, getUsageAggregate)
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts SETTINGS_* constants to the FROZEN wire shape
# (CONTRACT-NOTES.md): every "$..."/string money or count field becomes a
# bare number with a Usd/count-suffixed name, e.g.:
#   compFloor       '$210,000 base'  -> compFloorUsd     210000
#   monthSpend      '$3.42'          -> monthSpendUsd    3.42
#   monthlyCap      '$20.00'         -> monthlyCapUsd     20.00
#   balance (Anthropic) '$18.22 ...' -> balanceUsd        18.22
#   price           '$29 / month'    -> priceUsd          29
#   amount          '$29.00'         -> amountUsd         29
#   tokensIn/Out    '412k' / '88k'   -> tokensIn/Out       412000 / 88000
# Renamed/re-keyed fields (contract dropped the generic label/value + added a
# stable machine key where the mock only had presentation copy):
#   RoutingRow      label/value      -> task/model
#   PrivacyToggle   title/description-> key (invented below; not in fixtures.ts,
#                                          contract only carries the on/off state)
# Dropped presentation-only fields (client now owns the copy, same pattern as
# Search.eyebrow): IntegrationRow.icon, SETTINGS_DANGER (no DangerAction rows
# in the frozen contract per the founder ruling), NotifPref.consequence,
# Plan's card-on-file suffix in nextCharge.


def _seed_settings() -> Settings:
    return Settings(
        profile=Profile(
            name="Wes Gilleland",
            email="wes.gilleland@gmail.com",
            phone="(859) 555-0142",
            timezone="America/New_York",
            currentRole="Founder & Principal Engineer - Infinite Room Labs - 12 years",
            targetTitles=[
                "Staff Engineer",
                "Senior Staff Engineer",
                "Principal Engineer",
                "Platform Lead",
            ],
            compFloorUsd=210000,
        ),
        integrations=[
            IntegrationRow(
                name="Gmail",
                description="Read confirmations, thread replies, recruiter DMs",
                state=State1.connected,
                account="wes.gilleland@gmail.com",
                lastSync=iso_ago(minutes=2),
            ),
            IntegrationRow(
                name="Google Calendar",
                description="Detect interview times, write prep reminders",
                state=State1.connected,
                lastSync=iso_ago(minutes=14),
            ),
            IntegrationRow(
                name="LinkedIn",
                description="Import profile, sync saved jobs",
                state=State1.not_connected,
            ),
            IntegrationRow(
                name="Greenhouse - Lever - Ashby",
                description="Auto-detected from URL -- no auth needed",
                state=State1.auto,
            ),
            IntegrationRow(
                name="Calendly",
                description="Ingest screens auto-booked through your link",
                state=State1.not_connected,
            ),
            IntegrationRow(
                name="Notion",
                description="Mirror applications to a database (one-way)",
                state=State1.not_connected,
            ),
        ],
        providers=[
            ProviderRow(
                provider="Anthropic",
                model="claude-sonnet-4, claude-haiku-4-5",
                state=State2.connected,
                balanceUsd=18.22,
            ),
            ProviderRow(
                provider="OpenAI",
                model="gpt-4o, gpt-4o-mini",
                state=State2.connected,
            ),
            ProviderRow(
                provider="Google",
                model="gemini-1.5-pro",
                state=State2.error,
                error="Last request failed: 401 auth -- key may have rotated.",
            ),
            ProviderRow(
                provider="Mistral",
                model="mistral-large",
                state=State2.not_connected,
            ),
            ProviderRow(
                provider="Local",
                model="llama-3-70b via Ollama localhost",
                state=State2.not_connected,
            ),
        ],
        routing=[
            RoutingRow(task="Coach chat", model="claude-sonnet-4"),
            RoutingRow(task="Resume tailoring", model="claude-sonnet-4"),
            RoutingRow(task="JD parsing", model="gpt-4o-mini"),
            RoutingRow(task="Match scoring", model="gemini-1.5-pro"),
            RoutingRow(task="Stale / ghost detection", model="claude-haiku-4-5"),
        ],
        usage=[
            UsageRow(
                service="Resume tailoring",
                model="anthropic - sonnet-4",
                count=28,
                tokens=180000,
                costUsd=1.58,
            ),
            UsageRow(
                service="Coach chat",
                model="anthropic - sonnet-4",
                count=104,
                tokens=142000,
                costUsd=0.92,
            ),
            UsageRow(
                service="Match scoring",
                model="google - gemini-1.5",
                count=210,
                tokens=420000,
                costUsd=0.56,
            ),
            UsageRow(
                service="JD parsing",
                model="openai - 4o-mini",
                count=42,
                tokens=96000,
                costUsd=0.12,
            ),
            UsageRow(
                service="Stale detector",
                model="anthropic - haiku-4.5",
                count=88,
                tokens=22000,
                costUsd=0.08,
            ),
            UsageRow(
                service="Ghost detector",
                model="anthropic - haiku-4.5",
                count=64,
                tokens=16000,
                costUsd=0.06,
            ),
            UsageRow(
                service="Follow-up drafter",
                model="anthropic - sonnet-4",
                count=11,
                tokens=28000,
                costUsd=0.10,
            ),
        ],
        monthSpendUsd=3.42,
        monthlyCapUsd=20.00,
        privacy=[
            PrivacyToggle(key="coach-feedback-training", on=True),
            PrivacyToggle(key="resume-finetune-training", on=False),
            PrivacyToggle(key="anonymous-response-benchmarks", on=True),
            PrivacyToggle(key="chat-log-retention-30d", on=True),
        ],
        privacyLastUpdated=datetime(2026, 5, 15, tzinfo=UTC),
        plan=Plan(
            name="Pro plan",
            priceUsd=29,
            description="Unlimited applications - 20 agents - $20 pooled AI credits.",
            nextCharge=datetime(2026, 4, 14, tzinfo=UTC),
        ),
        invoices=[
            InvoiceRow(
                date=datetime(2026, 3, 14, tzinfo=UTC),
                description="Pro subscription",
                amountUsd=29.00,
            ),
            InvoiceRow(
                date=datetime(2026, 2, 14, tzinfo=UTC),
                description="Pro subscription",
                amountUsd=29.00,
            ),
            InvoiceRow(
                date=datetime(2026, 1, 14, tzinfo=UTC),
                description="Pro subscription -- first month",
                amountUsd=29.00,
            ),
        ],
        notifPrefs=[
            NotifPref(
                id="transactional-security",
                category="Transactional / security",
                emailEnabled=True,
                inAppEnabled=True,
                emailLocked=True,
            ),
            NotifPref(
                id="agent-approval",
                category="Agent approval / proposed transitions",
                emailEnabled=True,
                inAppEnabled=True,
            ),
            NotifPref(
                id="coach-prompts",
                category="Coach prompts",
                emailEnabled=False,
                inAppEnabled=True,
            ),
            NotifPref(
                id="monthly-digest",
                category="Monthly digest",
                emailEnabled=True,
                inAppEnabled=False,
            ),
            NotifPref(
                id="dead-month-checkin",
                category="Dead-month check-in",
                emailEnabled=True,
                inAppEnabled=False,
            ),
            NotifPref(
                id="stale-ghost-nudges",
                category="Stale / ghost nudges",
                emailEnabled=True,
                inAppEnabled=True,
            ),
        ],
        extensionTokens=[
            ExtensionToken(
                id=EXTENSION_TOKEN_ID_BROWSER,
                label="Browser extension",
                createdAt=datetime(2026, 5, 1, tzinfo=UTC),
            ),
        ],
        emailParserFallback=EmailParserFallback(mode=Mode.deterministic),
    )


# Singleton -- reassigned wholesale by reset(). No PATCH/PUT op on ``settings``
# is in scope for this resource group (only getSettings), so unlike
# ``searches``/``notifications`` there is no mutate-in-place requirement.
settings: Settings = _seed_settings()


def _seed_usage_aggregate() -> UsageAggregate:
    """Billing-period summary (getUsageAggregate).

    Mirrors the same monthSpend/monthlyCap totals as ``settings`` (ported from
    fixtures.ts SETTINGS_USAGE_TOTALS) plus SETTINGS_USAGE_META's token
    counts. NOTE (judgment call): the mock's ``avgPerSession`` ('2.4k') reads
    like a token count sitting alongside tokensIn/tokensOut, but the frozen
    contract names this field ``avgPerSessionUsd`` (a dollar figure) with no
    replacement dollar value anywhere in the fixtures. Ported the raw fixture
    number (2400) rather than inventing a different one -- flagged here for a
    founder ruling on what this field should actually mean.
    """
    return UsageAggregate(
        monthSpendUsd=3.42,
        monthlyCapUsd=20.00,
        tokensIn=412000,
        tokensOut=88000,
        avgPerSessionUsd=2400,
    )


# Singleton -- reassigned wholesale by reset() (read-only resource in scope).
usage_aggregate: UsageAggregate = _seed_usage_aggregate()


# ---------------------------------------------------------------------------
# reset -- restore every store to pristine fixture state. Called by the
# scaffold test conftest between tests; phase-2 agents extend this.
# ---------------------------------------------------------------------------


def reset() -> None:
    """Restore all in-memory stores to their pristine seeded state."""
    global current_user, settings, usage_aggregate

    searches.clear()
    searches.update(_seed_searches())
    notifications.clear()
    notifications.update(_seed_notifications())
    current_user = _seed_current_user()
    settings = _seed_settings()
    usage_aggregate = _seed_usage_aggregate()
    # Phase-2 agents: add ``<res>.clear(); <res>.update(_seed_<res>())`` here.
