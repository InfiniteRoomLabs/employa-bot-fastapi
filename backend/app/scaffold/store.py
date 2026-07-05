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
    CareerHistoryItem,
    EmailParserFallback,
    ExtensionToken,
    IntegrationRow,
    InvoiceRow,
    Kind3,
    Kind5,
    Mode,
    Notification,
    NotifPref,
    Plan,
    PreviewKind,
    PrivacyToggle,
    Profile,
    ProviderRow,
    RemotePolicy,
    Resume,
    ResumeExport,
    ResumeTag,
    ResumeTemplate,
    ResumeUpload,
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


def now() -> datetime:
    """Current instant for 'just now' MUTATION timestamps.

    Distinct from :func:`iso_ago`, which anchors relative FIXTURE ages to
    :data:`PROCESS_START` for reproducibility. Actions that create/modify a
    record (createResume, duplicateResume, renderExport, ...) should read as
    happening now, not at process start.
    """
    return datetime.now(UTC)


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
RESUME_ID_MASTER = UUID("c1a7e2b0-4d31-4f86-9a52-0b6d3e7f1c84")
RESUME_ID_DISTRIBUTED = UUID("d2b8f3c1-5e42-4097-8b63-1c7e4f802d95")
RESUME_ID_PLATFORM = UUID("e3c904d2-6f53-41a8-9c74-2d8f50913ea6")
RESUME_ID_VERCEL = UUID("f4da15e3-7064-42b9-8d85-3e906a204fb7")
RESUME_ID_FOUNDER = UUID("a5eb26f4-8175-43ca-9e96-4fa17b315ac8")
RESUME_ID_SHORT = UUID("b6fc3705-9286-44db-8fa7-50b28c426bd9")

UPLOAD_ID_SWE_2023 = UUID("a1c2e3f4-0506-4708-89a0-b1c2d3e4f506")
UPLOAD_ID_DEVOPS_2022 = UUID("b2d3f4a5-1607-4819-9ab1-c2d3e4f50617")

TEMPLATE_ID_CLASSIC = UUID("c0a1b2c3-d4e5-4f60-8172-839a4b5c6d7e")
TEMPLATE_ID_TWO_COL = UUID("d1b2c3d4-e5f6-4071-9283-a4b5c6d7e8f9")
TEMPLATE_ID_COMPACT = UUID("e2c3d4e5-f607-4182-a394-b5c6d7e8f90a")

EXPORT_ID_BACKEND = UUID("f3d4e5f6-0718-4293-b4a5-c6d7e8f90a1b")

# CareerHistoryItem.id is UUID-typed in the frozen contract, but fixtures.ts
# uses human slugs ("ch-summary", ...) -- not in the well-known-UUID list
# (CONTRACT-NOTES has no ruling for this one). JUDGMENT CALL: mint stable
# UUIDs here (uuid5, namespace URL, name "employa-bot:career-history:<slug>")
# so they are deterministic and documented rather than ad hoc uuid4() picks.
CAREER_ITEM_ID_SUMMARY = UUID("61a14bca-f2bb-527c-883a-5840ecc9c58c")
CAREER_ITEM_ID_EXP_PAYMENTS = UUID("1f12a4f7-0b51-59ff-9acb-8f6acdb43953")
CAREER_ITEM_ID_EXP_PLATFORM = UUID("4dc8efe5-7c02-51b3-ad59-86b7f73e31dc")
CAREER_ITEM_ID_EDU = UUID("04f20379-1e4c-580e-b53e-cc3468eea3d0")
CAREER_ITEM_ID_SKILLS = UUID("58ede748-ab84-51f3-accf-251ebd4ac628")


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
# resumes + resume lifecycle (ADR-007/008)
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts RESUMES/RESUME_UPLOADS/CAREER_HISTORY/
# RESUME_TEMPLATES/RESUME_EXPORTS to the frozen wire shape:
#   updated/uploadedAt/generatedAt relative ages -> iso_ago(...) instants
#   scoringEnabled absent in every fixture row -> left unset (None), matching
#     the mock's "absent = enabled" default (D21; see screens/resumes/index.tsx)


def _seed_resumes() -> dict[UUID, Resume]:
    return {
        RESUME_ID_MASTER: Resume(
            id=RESUME_ID_MASTER,
            name="Master",
            subtitle="All experience - no targeting",
            version="v4",
            usedIn=0,
            updated=iso_ago(days=14),
            tag=ResumeTag.MASTER,
            body=(
                "Comprehensive resume covering 12 years across distributed "
                "systems, platform engineering, and founding-stage product "
                "work. Full open-source contribution history, on-call war "
                "stories, architecture decision records, and complete "
                "conference/publication list. Not submitted anywhere - serves "
                "as the canonical source for all variants."
            ),
        ),
        RESUME_ID_DISTRIBUTED: Resume(
            id=RESUME_ID_DISTRIBUTED,
            name="Distributed-systems",
            subtitle="For Staff / Principal IC roles",
            version="v4",
            usedIn=5,
            updated=iso_ago(days=1),
            tag=ResumeTag.DEFAULT,
            match=92,
            body=(
                "Optimized for Staff/Principal platform roles. Leads with a "
                "2M-events/sec ingest pipeline (p99 cut 340ms to 45ms), a "
                "multi-region Postgres migration with zero downtime, and a "
                "38% compute-cost reduction. Submitted to Stripe, Linear, "
                "Cloudflare, Honeycomb."
            ),
        ),
        RESUME_ID_PLATFORM: Resume(
            id=RESUME_ID_PLATFORM,
            name="Platform / infra",
            subtitle="Developer-platform emphasis",
            version="v2",
            usedIn=3,
            updated=iso_ago(days=4),
            tag=ResumeTag.VARIANT,
            match=84,
            body=(
                "Reordered for dev-platform and build-infrastructure roles. "
                "Leads with internal CI/CD overhaul (build times halved, "
                "flake rate cut 80%), Kubernetes operator work, and the "
                "internal tooling platform used by 120+ engineers. Applied "
                "to Vercel, Render, and Depot."
            ),
        ),
        RESUME_ID_VERCEL: Resume(
            id=RESUME_ID_VERCEL,
            name="For Vercel - edge",
            subtitle="Targeted - one-off",
            version="v1",
            usedIn=1,
            updated=iso_ago(days=7),
            tag=ResumeTag.TAILORED,
            match=91,
            body=(
                "Tailored specifically for the Vercel Edge Runtime Staff "
                "Engineer posting. Locked after submission. Surfaces V8 "
                "isolate work, cold-start optimization research, and prior "
                "contributions to the edge-config SDK. Contact at Vercel: "
                "Sarah Chen (sourced via LinkedIn)."
            ),
        ),
        RESUME_ID_FOUNDER: Resume(
            id=RESUME_ID_FOUNDER,
            name="Founder to IC narrative",
            subtitle="Different framing - exploring",
            version="v1",
            usedIn=0,
            updated=iso_ago(days=21),
            tag=ResumeTag.DRAFT,
            body=(
                "Exploratory draft reframing founder and early-stage "
                "principal work as senior IC contributions. Translates "
                '"built and shipped the product" into systems-design wins '
                "and ownership scope a Staff IC hiring bar can evaluate. Not "
                "submitted anywhere - still rough."
            ),
        ),
        RESUME_ID_SHORT: Resume(
            id=RESUME_ID_SHORT,
            name="Short - 1-pager",
            subtitle="Tight one-page format",
            version="v1",
            usedIn=0,
            updated=iso_ago(days=30),
            tag=ResumeTag.FORMAT,
            body=(
                "Compressed single-page version of the Master resume. Used "
                "for referrals and warm intros where a recruiter or hiring "
                "manager asks for a quick read before a call."
            ),
        ),
    }


def _seed_resume_uploads() -> dict[UUID, ResumeUpload]:
    return {
        UPLOAD_ID_SWE_2023: ResumeUpload(
            id=UPLOAD_ID_SWE_2023,
            filename="Remy_SWE_2023.pdf",
            uploadedAt=iso_ago(days=14),
            parsed=True,
            sizeBytes=184_320,
        ),
        UPLOAD_ID_DEVOPS_2022: ResumeUpload(
            id=UPLOAD_ID_DEVOPS_2022,
            filename="Remy_DevOps_2022.docx",
            uploadedAt=iso_ago(days=14),
            parsed=True,
            sizeBytes=96_780,
        ),
    }


def _seed_career_history() -> dict[UUID, CareerHistoryItem]:
    return {
        CAREER_ITEM_ID_SUMMARY: CareerHistoryItem(
            id=CAREER_ITEM_ID_SUMMARY,
            kind=Kind3.summary,
            title="Staff engineer - distributed systems + developer platforms",
            bullets=[
                "12 years across distributed systems, platform engineering, "
                "and founding-stage product."
            ],
            ordinal=0,
            sourceUploadIds=[UPLOAD_ID_SWE_2023],
        ),
        CAREER_ITEM_ID_EXP_PAYMENTS: CareerHistoryItem(
            id=CAREER_ITEM_ID_EXP_PAYMENTS,
            kind=Kind3.experience,
            title="Staff Engineer, Payments Core",
            org="Northwind",
            bullets=[
                "Cut ingest pipeline p99 from 340ms to 45ms (2M events/sec).",
                "Led zero-downtime multi-region Postgres migration.",
                "Reduced compute cost 38% via workload-aware autoscaling.",
            ],
            ordinal=1,
            sourceUploadIds=[UPLOAD_ID_SWE_2023, UPLOAD_ID_DEVOPS_2022],
        ),
        CAREER_ITEM_ID_EXP_PLATFORM: CareerHistoryItem(
            id=CAREER_ITEM_ID_EXP_PLATFORM,
            kind=Kind3.experience,
            title="Senior Platform Engineer",
            org="Lumen Labs",
            bullets=[
                "Halved CI build times; cut flake rate 80%.",
                "Built internal tooling platform used by 120+ engineers.",
            ],
            ordinal=2,
            sourceUploadIds=[UPLOAD_ID_DEVOPS_2022],
        ),
        CAREER_ITEM_ID_EDU: CareerHistoryItem(
            id=CAREER_ITEM_ID_EDU,
            kind=Kind3.education,
            title="B.S. Computer Science",
            org="State University",
            bullets=[],
            ordinal=3,
            sourceUploadIds=[UPLOAD_ID_SWE_2023],
        ),
        CAREER_ITEM_ID_SKILLS: CareerHistoryItem(
            id=CAREER_ITEM_ID_SKILLS,
            kind=Kind3.skill,
            title="Skills",
            bullets=[
                "Go, Rust, TypeScript",
                "Kubernetes, Postgres, Kafka",
                "Distributed systems, observability",
            ],
            ordinal=4,
            sourceUploadIds=[UPLOAD_ID_SWE_2023, UPLOAD_ID_DEVOPS_2022],
        ),
    }


def _seed_resume_templates() -> dict[UUID, ResumeTemplate]:
    return {
        TEMPLATE_ID_CLASSIC: ResumeTemplate(
            id=TEMPLATE_ID_CLASSIC,
            name="Classic",
            previewKind=PreviewKind.single_column,
            description="Clean single-column default. Used for the starter master.",
        ),
        TEMPLATE_ID_TWO_COL: ResumeTemplate(
            id=TEMPLATE_ID_TWO_COL,
            name="Two-Column Modern",
            previewKind=PreviewKind.two_column,
            description="Sidebar for skills/contact, main column for experience.",
        ),
        TEMPLATE_ID_COMPACT: ResumeTemplate(
            id=TEMPLATE_ID_COMPACT,
            name="Compact One-Page",
            previewKind=PreviewKind.compact,
            description="Tight single page for referrals and warm intros.",
        ),
    }


def _seed_resume_exports() -> dict[UUID, ResumeExport]:
    return {
        EXPORT_ID_BACKEND: ResumeExport(
            id=EXPORT_ID_BACKEND,
            projectionId=RESUME_ID_DISTRIBUTED,
            templateId=TEMPLATE_ID_TWO_COL,
            templateVersion="v1",
            filename="Remy_Distributed-Systems.pdf",
            generatedAt=iso_ago(days=1),
            regenerable=True,
        ),
    }


# Live stores. Never reassigned -- mutated in place so imported references
# stay valid. Routes read/write ``store.resumes`` etc.
resumes: dict[UUID, Resume] = _seed_resumes()
resume_uploads: dict[UUID, ResumeUpload] = _seed_resume_uploads()
career_history: dict[UUID, CareerHistoryItem] = _seed_career_history()
resume_templates: dict[UUID, ResumeTemplate] = _seed_resume_templates()
resume_exports: dict[UUID, ResumeExport] = _seed_resume_exports()

# Private (not on the wire) provenance side-stores for resume-lifecycle
# routes. Not part of the frozen contract -- kept for correctness/pinning
# semantics, never serialized directly.
#
# createProjection pins the itemIds it was built from (RES-034/035: "new
# career history never auto-injects into existing projections"). Snapshotted
# once at creation and never recomputed, so later career_history edits cannot
# retroactively change an existing projection.
resume_projection_items: dict[UUID, list[UUID]] = {}
# forkResumeAsDraft's jobId isn't part of the Resume wire shape; kept here for
# future provenance/debugging, mirroring the mock's "seam stays, arg unused
# in-store" comment.
resume_fork_jobs: dict[UUID, UUID] = {}


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
    resumes.clear()
    resumes.update(_seed_resumes())
    resume_uploads.clear()
    resume_uploads.update(_seed_resume_uploads())
    career_history.clear()
    career_history.update(_seed_career_history())
    resume_templates.clear()
    resume_templates.update(_seed_resume_templates())
    resume_exports.clear()
    resume_exports.update(_seed_resume_exports())
    resume_projection_items.clear()
    resume_fork_jobs.clear()
    # Phase-2 agents: add ``<res>.clear(); <res>.update(_seed_<res>())`` here.
