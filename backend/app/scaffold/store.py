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

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import NAMESPACE_URL, UUID, uuid5

from pydantic import AnyUrl

from app.scaffold.models import (
    Accomplishment,
    Actor,
    Agent,
    AgentLogEntry,
    AgentLogKind,
    AgentPermission,
    AgentState,
    AgentTrustTier,
    Answer,
    Application,
    ApplicationFlag,
    ApplicationView,
    Author,
    Cadence,
    CareerHistoryItem,
    Category,
    Classification,
    CoachDiff,
    CoachMessage,
    CoachProposal,
    CoachSubject,
    CoachThread,
    CoachThreadScope,
    Commitment,
    Contact,
    ContextCard,
    Credential,
    DraftAttachment,
    EmailParserFallback,
    Employment,
    ExtensionToken,
    IntegrationRow,
    InterviewFormat,
    InterviewRound,
    InterviewStatus,
    InterviewType,
    InvoiceRow,
    Job,
    JobCaptureMethod,
    JobInboxItem,
    JobLocation,
    JobMatch,
    JobSource,
    JobWorkMode,
    Kind3,
    Kind4,
    Kind5,
    Link,
    MatchGap,
    MatchRubricRow,
    Mode,
    Notification,
    NotifPref,
    Outcome,
    Plan,
    PreviewKind,
    PrivacyToggle,
    Profile,
    Project,
    ProviderRow,
    RemotePolicy,
    Resume,
    ResumeExport,
    ResumeSnapshot,
    ResumeTag,
    ResumeTemplate,
    ResumeUpload,
    ReviewQueueItem,
    RoutingRow,
    SalaryPoint,
    SalaryRange,
    Search,
    SearchCriteria,
    Settings,
    Severity,
    ShortlistEntry,
    Source,
    Source1,
    Stage,
    StageTransition,
    State,
    State1,
    State2,
    TimelineEvent,
    TrustTierRung,
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
    global month_spend_usd

    searches.clear()
    searches.update(_seed_searches())

    jobs.clear()
    jobs.update(_seed_jobs())

    jobs_inbox.clear()
    jobs_inbox.extend(_seed_jobs_inbox())

    JOBS_INBOX_BY_SEARCH.clear()
    JOBS_INBOX_BY_SEARCH.update(
        {
            SEARCH_ID_PLATFORM: jobs_inbox,
            SEARCH_ID_BACKEND: _seed_jobs_inbox_backend(),
            SEARCH_ID_AI_INFRA: _seed_jobs_inbox_ai_infra(),
        }
    )

    shortlist.clear()
    shortlist.update(_seed_shortlist())

    SHORTLIST_BY_SEARCH.clear()
    SHORTLIST_BY_SEARCH.update(
        {
            SEARCH_ID_PLATFORM: _seed_shortlist_platform_entries(),
            SEARCH_ID_BACKEND: _seed_shortlist_backend_entries(),
            SEARCH_ID_AI_INFRA: _seed_shortlist_ai_infra_entries(),
        }
    )

    month_spend_usd = _INITIAL_MONTH_SPEND_USD

    _active, _arch, _derived_jobs = _seed_application_state()
    applications.clear()
    applications.update(_active)
    archive.clear()
    archive.update(_arch)
    application_jobs.clear()
    application_jobs.update(_derived_jobs)
    transition_logs.clear()
    timelines.clear()
    timelines.update(_seed_timelines())
    interview_rounds.clear()
    interview_rounds.extend(_seed_interview_rounds())
    undo_grants.clear()
    resume_snapshots.clear()


# ---------------------------------------------------------------------------
# jobs (ADR-006 canonical posting resource)
# ---------------------------------------------------------------------------
#
# Ported verbatim from fixtures.ts JOBS. Full captures (Stripe/Linear/Sentry)
# carry summary/tags/requirements/description/match; the remaining four are
# "partial captures" per the mock's own comment (still enriching -- no
# summary/description/match), which the frozen Job schema models as all-
# optional fields left unset.

JOB_ID_STRIPE = UUID("b7e9c4a1-0d2f-4c83-9a16-1e5f7c3b8d40")
JOB_ID_LINEAR = UUID("c8f0d5b2-1e3a-4d94-8b27-2f6a8d4c9e51")
JOB_ID_SENTRY = UUID("d9a1e6c3-2f4b-4ea5-9c38-3a7b9e5daf62")
JOB_ID_FLYIO = UUID("e0b2f7d4-3a5c-4fb6-ad49-4b8caf6eb073")
JOB_ID_TEMPORAL = UUID("f1c3a8e5-4b6d-40c7-be5a-5c9dba7fc184")
JOB_ID_NEON = UUID("a2d4b9f6-5c7e-41d8-cf6b-6daecb80d295")
JOB_ID_HONEYCOMB = UUID("b3e5caf7-6d8f-42e9-da7c-7ebfdc91e3a6")


# All seven postings are remote-US W2 salaried full-time roles in the fixture.
# Factories (not shared constants) so every Job gets its own instance -- no
# aliased sub-model shared across live records.
def _w2_salary_ft() -> Employment:
    return Employment(
        classification=Classification.w2,
        cadence=Cadence.salary,
        commitment=Commitment.full_time,
    )


def _remote_us() -> JobLocation:
    return JobLocation(raw="Remote - US", country="US")


def _seed_jobs() -> dict[UUID, Job]:
    return {
        JOB_ID_STRIPE: Job(
            id=JOB_ID_STRIPE,
            company="Stripe",
            title="Staff Engineer - Payments core",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=255000, max=305000, extra=[]),
            seniority="Staff",
            source=JobSource(
                board="greenhouse",
                channel=JobCaptureMethod.url,
                url="https://boards.greenhouse.io/stripe/jobs/staff-payments-core",  # type: ignore[arg-type]
                capturedAt=iso_ago(days=2),
            ),
            isNew=True,
            posted=iso_ago(days=2),
            summary=(
                "Own payment-path services handling millions of transactions/min. "
                "Idempotency, ledgering, multi-region failover. Reports to the "
                "Payments Platform lead."
            ),
            tags=[
                "Go",
                "Rust",
                "Postgres",
                "Distributed systems",
                "Kafka",
                "gRPC",
                "Multi-region",
            ],
            requirements=[
                "8+ years backend / distributed systems",
                "Production ownership of high-throughput services",
                "Strong Go or Rust",
                "Experience with idempotency + exactly-once semantics",
            ],
            description=(
                "Stripe is hiring a Staff Engineer on Payments core (remote, US). "
                "You will own services on the synchronous payment path...\n\n"
                "Responsibilities:\n"
                "- Design and operate high-throughput, low-latency payment services\n"
                "- Drive multi-region resilience and failover\n"
                "- Mentor senior engineers\n\n"
                "Qualifications:\n"
                "- 8+ years backend, distributed systems\n"
                "- Go or Rust in production at scale\n\n"
                "Comp: $255,000-$305,000 + equity."
            ),
            match=JobMatch(
                score=92,
                strengths=[
                    "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - direct match",
                    "Multi-region Postgres migration maps to their failover work",
                    "Comp band ($255-305k) clears your $210k floor",
                ],
                gaps=[
                    "No explicit idempotency / exactly-once work surfaced on the resume",
                    "Rust listed but Go is the primary stack on file",
                ],
            ),
        ),
        JOB_ID_LINEAR: Job(
            id=JOB_ID_LINEAR,
            company="Linear",
            title="Senior Staff Engineer - Platform",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=245000, max=285000, extra=[]),
            seniority="Senior Staff",
            source=JobSource(
                board="ashby",
                channel=JobCaptureMethod.extension,
                url="https://linear.app/jobs/senior-staff-engineer-platform",  # type: ignore[arg-type]
                capturedAt=iso_ago(days=1),
            ),
            isNew=True,
            posted=iso_ago(days=1),
            summary=(
                "Own the build/CI platform and the sync engine that powers "
                "real-time collaboration across all Linear clients. You will work "
                "closely with product and design to keep the platform fast and "
                "reliable."
            ),
            tags=[
                "TypeScript",
                "React",
                "Postgres",
                "Distributed systems",
                "GraphQL",
                "CI/CD",
                "Platform",
            ],
            requirements=[
                "10+ years software engineering, including Staff+ IC experience",
                "Deep TypeScript / Node.js expertise",
                "Experience building and operating developer platforms (CI/CD, tooling, infra)",
                "Strong distributed-systems fundamentals",
            ],
            description=(
                "Linear is looking for a Senior Staff Engineer to own our Platform "
                "team (remote, US). The platform team is responsible for the sync "
                "engine, build infrastructure, and the internal tooling that lets "
                "the rest of Linear move fast.\n\n"
                "Responsibilities:\n"
                "- Own the real-time sync engine used by all Linear clients\n"
                "- Drive build-system and CI/CD reliability (build times, flake rate, reproducibility)\n"
                "- Partner with infra on the Postgres-backed architecture\n"
                "- Mentor engineers across the org on platform patterns\n\n"
                "Qualifications:\n"
                "- 10+ years engineering, Staff+ IC track record\n"
                "- Deep TypeScript expertise\n"
                "- CI/CD and build-system ownership at scale\n\n"
                "Comp: $245,000-$285,000 + meaningful equity."
            ),
            match=JobMatch(
                score=88,
                strengths=[
                    "Platform / infra v2 resume leads with CI/CD overhaul (build times halved, flake 80% down) - direct match",
                    "TypeScript listed across multiple roles; sync-engine patterns appear in distributed-systems work",
                    "Comp band ($245-285k) clears your $210k floor",
                ],
                gaps=[
                    "No explicit real-time sync or CRDT/OT work surfaced on the resume",
                    "React listed but frontend depth not prominent in the IC story",
                ],
            ),
        ),
        JOB_ID_SENTRY: Job(
            id=JOB_ID_SENTRY,
            company="Sentry",
            title="Staff Engineer - Ingest",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=220000, max=260000, extra=[]),
            seniority="Staff",
            source=JobSource(
                board="lever",
                channel=JobCaptureMethod.email_forward,
                url="https://sentry.io/careers/staff-engineer-ingest",  # type: ignore[arg-type]
                capturedAt=iso_ago(days=3),
            ),
            posted=iso_ago(days=3),
            summary=(
                "Own the high-throughput event ingest pipeline that ingests "
                "billions of error events per day. Rust + Kafka + ClickHouse "
                "stack. You will drive reliability, cost, and latency "
                "improvements at massive scale."
            ),
            tags=[
                "Rust",
                "Kafka",
                "ClickHouse",
                "Python",
                "Distributed systems",
                "High-throughput",
                "Observability",
            ],
            requirements=[
                "8+ years backend engineering",
                "Production experience with high-throughput event streaming (Kafka or equivalent)",
                "Strong Rust or C++",
                "Experience with columnar stores (ClickHouse, BigQuery, Redshift)",
            ],
            description=(
                "Sentry is hiring a Staff Engineer for the Ingest team (remote, "
                "US). The Ingest team owns the pipeline that processes billions "
                "of events per day -- from SDK to storage.\n\n"
                "Responsibilities:\n"
                "- Own end-to-end reliability and latency of the ingest pipeline\n"
                "- Drive cost reduction on ClickHouse and Kafka infrastructure\n"
                "- Collaborate with the SDK team on the ingestion contract\n"
                "- Mentor and grow engineers on the team\n\n"
                "Qualifications:\n"
                "- 8+ years backend, with production high-throughput systems\n"
                "- Rust or C++ at scale\n"
                "- Kafka and ClickHouse (or equivalent columnar store)\n\n"
                "Comp: $220,000-$260,000 + equity."
            ),
            match=JobMatch(
                score=84,
                strengths=[
                    "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - strong signal for this team",
                    "Kafka and ClickHouse experience listed in the Observability section of the resume",
                    "Comp band ($220-260k) clears your $210k floor",
                ],
                gaps=[
                    "Rust is listed but limited production depth shown on resume vs their strong preference",
                    "No explicit columnar-store ownership or query-optimization work called out",
                ],
            ),
        ),
        # --- partial captures: no summary/description/match (still enriching) ---
        JOB_ID_FLYIO: Job(
            id=JOB_ID_FLYIO,
            company="Fly.io",
            title="Principal Engineer",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=225000, max=275000, extra=[]),
            seniority="Principal",
            source=JobSource(
                board="lever", channel=JobCaptureMethod.url, capturedAt=iso_ago(days=4)
            ),
            posted=iso_ago(days=4),
        ),
        JOB_ID_TEMPORAL: Job(
            id=JOB_ID_TEMPORAL,
            company="Temporal",
            title="Staff Engineer",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=230000, max=280000, extra=[]),
            seniority="Staff",
            source=JobSource(
                board="greenhouse",
                channel=JobCaptureMethod.extension,
                capturedAt=iso_ago(days=5),
            ),
            posted=iso_ago(days=5),
        ),
        JOB_ID_NEON: Job(
            id=JOB_ID_NEON,
            company="Neon",
            title="Staff Engineer - Postgres",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=215000, max=260000, extra=[]),
            seniority="Staff",
            source=JobSource(
                board="ashby", channel=JobCaptureMethod.url, capturedAt=iso_ago(days=6)
            ),
            posted=iso_ago(days=6),
        ),
        JOB_ID_HONEYCOMB: Job(
            id=JOB_ID_HONEYCOMB,
            company="Honeycomb",
            title="Staff Engineer - Observability",
            location=_remote_us(),
            workMode=JobWorkMode.remote,
            employment=_w2_salary_ft(),
            compensation=SalaryRange(min=220000, max=265000, extra=[]),
            seniority="Staff",
            source=JobSource(
                board="greenhouse",
                channel=JobCaptureMethod.email_forward,
                capturedAt=iso_ago(days=2),
            ),
            isNew=True,
            posted=iso_ago(days=2),
        ),
    }


# Live store. Never reassigned -- mutated in place. Routes read/write ``store.jobs``.
jobs: dict[UUID, Job] = _seed_jobs()


def _parse_comp(comp: str) -> SalaryPoint | SalaryRange | None:
    """Parse the mock's display string ("$255-305k", "-", "$320-400k + equity")
    into the frozen structured ``Salary`` shape.

    Judgment call (no named contract model covers this conversion): the mock's
    UI compensation strings are always either a bare dash (undisclosed -> None),
    a single "$NNNk" figure (-> SalaryPoint), or a "$NNN-MMMk" band, optionally
    suffixed " + equity" (-> SalaryRange with extra=["equity"]).
    """
    comp = comp.strip()
    if comp in ("", "-"):
        return None
    extra: list[str] = []
    if comp.endswith(" + equity"):
        extra = ["equity"]
        comp = comp[: -len(" + equity")]
    comp = comp.lstrip("$")
    if "-" in comp:
        lo, hi = comp.split("-", 1)
        return SalaryRange(
            min=int(lo.rstrip("k")) * 1000, max=int(hi.rstrip("k")) * 1000, extra=extra
        )
    return SalaryPoint(value=int(comp.rstrip("k")) * 1000, extra=extra)


# ---------------------------------------------------------------------------
# jobs inbox (per-search views; read-only -- no create/update op in this slice)
# ---------------------------------------------------------------------------


def _seed_jobs_inbox() -> list[JobInboxItem]:
    """Canonical (platform-search) inbox. Ported verbatim from fixtures.ts
    JOBS_INBOX -- same seven postings as :func:`_seed_jobs`, full captures for
    Stripe/Linear/Sentry, minimal fields for the four partial captures."""
    return [
        JobInboxItem(
            jobId=JOB_ID_STRIPE,
            company="Stripe",
            role="Staff Engineer - Payments core",
            location="Remote - US",
            salary=_parse_comp("$255-305k"),
            match=92,
            source="greenhouse",
            isNew=True,
            posted=iso_ago(days=2),
            capturedVia=JobCaptureMethod.url,
            capturedAt=iso_ago(days=2),
            sourceUrl="https://boards.greenhouse.io/stripe/jobs/staff-payments-core",  # type: ignore[arg-type]
            workMode=JobWorkMode.remote,
            employmentType="Full-time",
            seniority="Staff",
            summary=(
                "Own payment-path services handling millions of transactions/min. "
                "Idempotency, ledgering, multi-region failover. Reports to the "
                "Payments Platform lead."
            ),
            tags=[
                "Go",
                "Rust",
                "Postgres",
                "Distributed systems",
                "Kafka",
                "gRPC",
                "Multi-region",
            ],
            requirements=[
                "8+ years backend / distributed systems",
                "Production ownership of high-throughput services",
                "Strong Go or Rust",
                "Experience with idempotency + exactly-once semantics",
            ],
            strengths=[
                "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - direct match",
                "Multi-region Postgres migration maps to their failover work",
                "Comp band ($255-305k) clears your $210k floor",
            ],
            gaps=[
                "No explicit idempotency / exactly-once work surfaced on the resume",
                "Rust listed but Go is the primary stack on file",
            ],
            jd=(
                "Stripe is hiring a Staff Engineer on Payments core (remote, US). "
                "You will own services on the synchronous payment path...\n\n"
                "Responsibilities:\n"
                "- Design and operate high-throughput, low-latency payment services\n"
                "- Drive multi-region resilience and failover\n"
                "- Mentor senior engineers\n\n"
                "Qualifications:\n"
                "- 8+ years backend, distributed systems\n"
                "- Go or Rust in production at scale\n\n"
                "Comp: $255,000-$305,000 + equity."
            ),
        ),
        JobInboxItem(
            jobId=JOB_ID_LINEAR,
            company="Linear",
            role="Senior Staff Engineer - Platform",
            location="Remote - US",
            salary=_parse_comp("$245-285k"),
            match=88,
            source="ashby",
            isNew=True,
            posted=iso_ago(days=1),
            capturedVia=JobCaptureMethod.extension,
            capturedAt=iso_ago(days=1),
            sourceUrl="https://linear.app/jobs/senior-staff-engineer-platform",  # type: ignore[arg-type]
            workMode=JobWorkMode.remote,
            employmentType="Full-time",
            seniority="Senior Staff",
            summary=(
                "Own the build/CI platform and the sync engine that powers "
                "real-time collaboration across all Linear clients. You will work "
                "closely with product and design to keep the platform fast and "
                "reliable."
            ),
            tags=[
                "TypeScript",
                "React",
                "Postgres",
                "Distributed systems",
                "GraphQL",
                "CI/CD",
                "Platform",
            ],
            requirements=[
                "10+ years software engineering, including Staff+ IC experience",
                "Deep TypeScript / Node.js expertise",
                "Experience building and operating developer platforms (CI/CD, tooling, infra)",
                "Strong distributed-systems fundamentals",
            ],
            strengths=[
                "Platform / infra v2 resume leads with CI/CD overhaul (build times halved, flake 80% down) - direct match",
                "TypeScript listed across multiple roles; sync-engine patterns appear in distributed-systems work",
                "Comp band ($245-285k) clears your $210k floor",
            ],
            gaps=[
                "No explicit real-time sync or CRDT/OT work surfaced on the resume",
                "React listed but frontend depth not prominent in the IC story",
            ],
            jd=(
                "Linear is looking for a Senior Staff Engineer to own our "
                "Platform team (remote, US). The platform team is responsible "
                "for the sync engine, build infrastructure, and the internal "
                "tooling that lets the rest of Linear move fast.\n\n"
                "Responsibilities:\n"
                "- Own the real-time sync engine used by all Linear clients\n"
                "- Drive build-system and CI/CD reliability (build times, flake rate, reproducibility)\n"
                "- Partner with infra on the Postgres-backed architecture\n"
                "- Mentor engineers across the org on platform patterns\n\n"
                "Qualifications:\n"
                "- 10+ years engineering, Staff+ IC track record\n"
                "- Deep TypeScript expertise\n"
                "- CI/CD and build-system ownership at scale\n\n"
                "Comp: $245,000-$285,000 + meaningful equity."
            ),
        ),
        JobInboxItem(
            jobId=JOB_ID_SENTRY,
            company="Sentry",
            role="Staff Engineer - Ingest",
            location="Remote - US",
            salary=_parse_comp("$220-260k"),
            match=84,
            source="lever",
            posted=iso_ago(days=3),
            capturedVia=JobCaptureMethod.email_forward,
            capturedAt=iso_ago(days=3),
            sourceUrl="https://sentry.io/careers/staff-engineer-ingest",  # type: ignore[arg-type]
            workMode=JobWorkMode.remote,
            employmentType="Full-time",
            seniority="Staff",
            summary=(
                "Own the high-throughput event ingest pipeline that ingests "
                "billions of error events per day. Rust + Kafka + ClickHouse "
                "stack. You will drive reliability, cost, and latency "
                "improvements at massive scale."
            ),
            tags=[
                "Rust",
                "Kafka",
                "ClickHouse",
                "Python",
                "Distributed systems",
                "High-throughput",
                "Observability",
            ],
            requirements=[
                "8+ years backend engineering",
                "Production experience with high-throughput event streaming (Kafka or equivalent)",
                "Strong Rust or C++",
                "Experience with columnar stores (ClickHouse, BigQuery, Redshift)",
            ],
            strengths=[
                "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - strong signal for this team",
                "Kafka and ClickHouse experience listed in the Observability section of the resume",
                "Comp band ($220-260k) clears your $210k floor",
            ],
            gaps=[
                "Rust is listed but limited production depth shown on resume vs their strong preference",
                "No explicit columnar-store ownership or query-optimization work called out",
            ],
            jd=(
                "Sentry is hiring a Staff Engineer for the Ingest team (remote, "
                "US). The Ingest team owns the pipeline that processes billions "
                "of events per day -- from SDK to storage.\n\n"
                "Responsibilities:\n"
                "- Own end-to-end reliability and latency of the ingest pipeline\n"
                "- Drive cost reduction on ClickHouse and Kafka infrastructure\n"
                "- Collaborate with the SDK team on the ingestion contract\n"
                "- Mentor and grow engineers on the team\n\n"
                "Qualifications:\n"
                "- 8+ years backend, with production high-throughput systems\n"
                "- Rust or C++ at scale\n"
                "- Kafka and ClickHouse (or equivalent columnar store)\n\n"
                "Comp: $220,000-$260,000 + equity."
            ),
        ),
        JobInboxItem(
            jobId=JOB_ID_FLYIO,
            company="Fly.io",
            role="Principal Engineer",
            location="Remote - US",
            salary=_parse_comp("$225-275k"),
            match=79,
            source="lever",
            posted=iso_ago(days=4),
        ),
        JobInboxItem(
            jobId=JOB_ID_TEMPORAL,
            company="Temporal",
            role="Staff Engineer",
            location="Remote - US",
            salary=_parse_comp("$230-280k"),
            match=72,
            source="greenhouse",
            posted=iso_ago(days=5),
        ),
        JobInboxItem(
            jobId=JOB_ID_NEON,
            company="Neon",
            role="Staff Engineer - Postgres",
            location="Remote - US",
            salary=_parse_comp("$215-260k"),
            match=77,
            source="ashby",
            posted=iso_ago(days=6),
        ),
        JobInboxItem(
            jobId=JOB_ID_HONEYCOMB,
            company="Honeycomb",
            role="Staff Engineer - Observability",
            location="Remote - US",
            salary=_parse_comp("$220-265k"),
            match=81,
            source="greenhouse",
            isNew=True,
            posted=iso_ago(days=2),
        ),
    ]


def _seed_jobs_inbox_backend() -> list[JobInboxItem]:
    """Backend (fintech) search inbox. Ported from fixtures.ts INBOX_BACKEND."""
    return [
        JobInboxItem(
            company="Wise",
            role="Staff Engineer - Money movement",
            location="Remote - US",
            salary=_parse_comp("$240-300k"),
            match=90,
            source="greenhouse",
            isNew=True,
            posted=iso_ago(days=1),
        ),
        JobInboxItem(
            company="Adyen",
            role="Senior Staff Engineer - Ledger",
            location="Remote - US/EU",
            salary=_parse_comp("$250-320k"),
            match=87,
            source="ashby",
            isNew=True,
            posted=iso_ago(days=2),
        ),
        JobInboxItem(
            company="Column",
            role="Staff Engineer - Core banking API",
            location="Remote - US",
            salary=_parse_comp("$245-310k"),
            match=89,
            source="lever",
            isNew=True,
            posted=iso_ago(days=2),
        ),
        JobInboxItem(
            company="Increase",
            role="Staff Engineer - Payments",
            location="Remote - US",
            salary=_parse_comp("$235-295k"),
            match=82,
            source="greenhouse",
            posted=iso_ago(days=4),
        ),
        JobInboxItem(
            company="Unit",
            role="Senior Staff - Banking platform",
            location="Remote - US",
            salary=_parse_comp("$230-285k"),
            match=78,
            source="lever",
            posted=iso_ago(days=5),
        ),
        JobInboxItem(
            company="Marqeta",
            role="Principal Engineer - Issuing",
            location="Remote - US",
            salary=_parse_comp("$255-315k"),
            match=75,
            source="workable",
            posted=iso_ago(days=7),
        ),
    ]


def _seed_jobs_inbox_ai_infra() -> list[JobInboxItem]:
    """AI-infra search inbox (paused, thin). Ported from INBOX_AI_INFRA."""
    return [
        JobInboxItem(
            company="Together AI",
            role="Staff Engineer - Inference platform",
            location="Remote - US",
            salary=_parse_comp("$250-320k"),
            match=84,
            source="ashby",
            isNew=True,
            posted=iso_ago(days=3),
        ),
        JobInboxItem(
            company="Fireworks AI",
            role="Staff Engineer - Serving",
            location="Remote - global",
            salary=_parse_comp("$240-300k"),
            match=79,
            source="greenhouse",
            posted=iso_ago(days=6),
        ),
    ]


# Live "no searchId" default view -- a plain list (no create/update op targets
# jobs_inbox directly in this slice, unlike shortlist below).
jobs_inbox: list[JobInboxItem] = _seed_jobs_inbox()

# Per-search views. The platform entry ALIASES ``jobs_inbox`` (same object,
# mirrors fixtures.ts ``INBOX_PLATFORM = JOBS_INBOX``) -- there is no separate
# mutable copy because no op in this slice mutates the inbox.
JOBS_INBOX_BY_SEARCH: dict[UUID, list[JobInboxItem]] = {
    SEARCH_ID_PLATFORM: jobs_inbox,
    SEARCH_ID_BACKEND: _seed_jobs_inbox_backend(),
    SEARCH_ID_AI_INFRA: _seed_jobs_inbox_ai_infra(),
}


# ---------------------------------------------------------------------------
# shortlist
# ---------------------------------------------------------------------------
#
# Judgment call: the frozen ``ShortlistEntry.id`` (UUID, required -- contract
# ADD-014 "UUID-ified: keyed by the shortlist entry id") has no equivalent in
# the mock, which keys shortlist entries by their (unique in practice) ``role``
# string. Entry ids here are deterministic ``uuid5(namespace, "company|role")``
# so the same fixture always yields the same id across resets/processes.
_SHORTLIST_UUID_NAMESPACE = UUID("f47b3c9e-8d2a-4e91-b6f0-1a2c3d4e5f60")


def _shortlist_id(company: str, role: str) -> UUID:
    return uuid5(_SHORTLIST_UUID_NAMESPACE, f"{company}|{role}")


def _seed_shortlist_platform_entries() -> list[ShortlistEntry]:
    """Canonical (platform-search) shortlist. Ported from SHORTLIST_DATA."""
    return [
        ShortlistEntry(
            id=_shortlist_id("Stripe", "Staff Engineer - Payments core"),
            jobId=JOB_ID_STRIPE,
            company="Stripe",
            role="Staff Engineer - Payments core",
            location="Remote - US",
            salary=_parse_comp("$255-305k"),
            match=92,
            saved=iso_ago(hours=2),
            source=Source.you,
            why=(
                "Payment-path services at scale - lines up with your "
                "ingest-pipeline and multi-region work."
            ),
        ),
        ShortlistEntry(
            id=_shortlist_id("Linear", "Senior Staff Engineer - Platform"),
            jobId=JOB_ID_LINEAR,
            company="Linear",
            role="Senior Staff Engineer - Platform",
            location="Remote - US",
            salary=_parse_comp("$280-340k"),
            match=88,
            saved=iso_ago(hours=2),
            source=Source.you,
            why=(
                "You saved this after Maya at Linear reached out on LinkedIn. "
                "Rust + Postgres platform team."
            ),
        ),
        ShortlistEntry(
            id=_shortlist_id("Sentry", "Staff Engineer - Ingest"),
            jobId=JOB_ID_SENTRY,
            company="Sentry",
            role="Staff Engineer - Ingest",
            location="Remote - US",
            salary=_parse_comp("$260-315k"),
            match=84,
            saved=iso_ago(days=2),
            source=Source.you,
            why=(
                "High-throughput ingest pipelines - they mention 2M events/sec, "
                "which is your scale."
            ),
        ),
        ShortlistEntry(
            id=_shortlist_id("Render", "Senior Staff - Platform"),
            company="Render",
            role="Senior Staff - Platform",
            location="Remote - US",
            salary=_parse_comp("$235-280k"),
            match=79,
            saved=iso_ago(days=4),
            source=Source.you,
        ),
        ShortlistEntry(
            id=_shortlist_id("Temporal", "Principal Engineer - Workflow"),
            company="Temporal",
            role="Principal Engineer - Workflow",
            location="Remote - US",
            salary=_parse_comp("-"),
            match=72,
            saved=iso_ago(days=7),
            source=Source.you,
            stale=True,
        ),
        ShortlistEntry(
            id=_shortlist_id("Neon", "Staff Engineer - Storage"),
            company="Neon",
            role="Staff Engineer - Storage",
            location="Remote - global",
            salary=_parse_comp("$240-290k"),
            match=77,
            saved=iso_ago(days=7),
            source=Source.you,
            stale=True,
        ),
    ]


def _seed_shortlist_backend_entries() -> list[ShortlistEntry]:
    """Backend (fintech) search shortlist. Ported from SHORTLIST_BACKEND."""
    return [
        ShortlistEntry(
            id=_shortlist_id("Wise", "Staff Engineer - Money movement"),
            company="Wise",
            role="Staff Engineer - Money movement",
            location="Remote - US",
            salary=_parse_comp("$240-300k"),
            match=90,
            saved=iso_ago(hours=2),
            source=Source.you,
            why=(
                "Cross-border payment rails at scale - matches your "
                "multi-region ledger work."
            ),
        ),
        ShortlistEntry(
            id=_shortlist_id("Adyen", "Senior Staff Engineer - Ledger"),
            company="Adyen",
            role="Senior Staff Engineer - Ledger",
            location="Remote - US/EU",
            salary=_parse_comp("$250-320k"),
            match=87,
            saved=iso_ago(days=1),
            source=Source.you,
            why=(
                "Double-entry ledger at high throughput - your exactly-once "
                "semantics work lines up."
            ),
        ),
        ShortlistEntry(
            id=_shortlist_id("Marqeta", "Principal Engineer - Issuing"),
            company="Marqeta",
            role="Principal Engineer - Issuing",
            location="Remote - US",
            salary=_parse_comp("$255-315k"),
            match=84,
            saved=iso_ago(days=2),
            source=Source.you,
            why="You flagged this after a card-issuing architecture thread on HN.",
        ),
        ShortlistEntry(
            id=_shortlist_id("Modern Treasury", "Staff Engineer - Payments API"),
            company="Modern Treasury",
            role="Staff Engineer - Payments API",
            location="Remote - US",
            salary=_parse_comp("$230-290k"),
            match=80,
            saved=iso_ago(days=4),
            source=Source.you,
        ),
    ]


def _seed_shortlist_ai_infra_entries() -> list[ShortlistEntry]:
    """AI-infra search shortlist (paused, thin). Ported from SHORTLIST_AI_INFRA."""
    return [
        ShortlistEntry(
            id=_shortlist_id("Anthropic", "Senior Staff - Inference"),
            company="Anthropic",
            role="Senior Staff - Inference",
            location="Remote - US",
            salary=_parse_comp("$320-400k + equity"),
            match=88,
            saved=iso_ago(days=7),
            source=Source.you,
            why=(
                "Inference-serving at scale - matches your latency-critical "
                "pipeline work."
            ),
        ),
        ShortlistEntry(
            id=_shortlist_id("Replicate", "Staff Engineer - API"),
            company="Replicate",
            role="Staff Engineer - API",
            location="Remote - global",
            salary=_parse_comp("$230-285k"),
            match=81,
            saved=iso_ago(days=7),
            source=Source.you,
        ),
    ]


def _seed_shortlist() -> dict[UUID, ShortlistEntry]:
    """The mutable "no searchId" default view (mock's ``_shortlist`` array).

    Judgment call, ported faithfully from api.ts: this starts as a COPY of the
    platform-search entries but is a separate mutable object from
    ``SHORTLIST_BY_SEARCH[SEARCH_ID_PLATFORM]`` -- add/dismiss only ever
    mutate this default view, never the per-search index (mirrors the mock,
    where ``_shortlist = [...SHORTLIST_DATA]`` is a distinct array from
    ``SHORTLIST_BY_SEARCH[SEARCH_ID_PLATFORM] = SHORTLIST_DATA``).
    """
    return {entry.id: entry for entry in _seed_shortlist_platform_entries()}


# Live store. Never reassigned -- mutated in place. Routes read/write via
# ``store.shortlist`` (add/dismiss) or ``store.SHORTLIST_BY_SEARCH`` (read-only
# per-search views, including the platform one -- see docstring above).
shortlist: dict[UUID, ShortlistEntry] = _seed_shortlist()

SHORTLIST_BY_SEARCH: dict[UUID, list[ShortlistEntry]] = {
    SEARCH_ID_PLATFORM: _seed_shortlist_platform_entries(),
    SEARCH_ID_BACKEND: _seed_shortlist_backend_entries(),
    SEARCH_ID_AI_INFRA: _seed_shortlist_ai_infra_entries(),
}


# ---------------------------------------------------------------------------
# match report (single canonical fixture -- mock ignores resumeId/jobId args)
# ---------------------------------------------------------------------------

MATCH_REPORT_SCORE = 92

MATCH_REPORT_RUBRIC: list[MatchRubricRow] = [
    MatchRubricRow(
        label="Skills fit",
        score=90,
        note=(
            "8 of 9 required skills present - Go, Rust, Postgres, Kafka, gRPC, "
            "multi-region, distributed systems, on-call"
        ),
    ),
    MatchRubricRow(
        label="Seniority",
        score=78,
        note=(
            "12 years, Staff/Principal scope vs Staff asked. Principal to "
            "Staff is a lateral."
        ),
    ),
    MatchRubricRow(
        label="Comp",
        score=82,
        note="Posted band ($255-305k) clears your floor ($210k) comfortably.",
    ),
    MatchRubricRow(
        label="Location",
        score=95,
        note="Fully remote - US. No relocation.",
    ),
]

MATCH_REPORT_GAPS: list[MatchGap] = [
    MatchGap(
        severity=Severity.high,
        text=(
            "Weak on idempotency / exactly-once - JD asks for it, you have "
            "the multi-region work but it is buried"
        ),
    ),
    MatchGap(
        severity=Severity.medium,
        text="No mention of Kafka - they require it, you used it daily",
    ),
    MatchGap(
        severity=Severity.low,
        text="p99 latency win not surfaced explicitly (340ms to 45ms - surface it)",
    ),
]

MATCH_REPORT_STRENGTHS: list[str] = [
    "2M-events/sec ingest pipeline - explicit in JD",
    "8+ years distributed systems - meets requirement",
    "Strong reliability metrics - 38% compute-cost reduction",
    "Multi-region migration experience - bonus given their scale",
]


# ---------------------------------------------------------------------------
# deep match score budget (D8b / D9a -- monthly LLM cap)
# ---------------------------------------------------------------------------
#
# Ported from fixtures.ts LLM_TASK_COST_USD['deep-match-score'] and
# SETTINGS_USAGE_TOTALS. The routing model ('gemini-1.5-pro') is fixtures.ts
# SETTINGS_ROUTING's 'Match scoring' row -- used as the CostPreviewItem/
# AiRunEnvelope model label even though execution is the synthetic FakeProvider.

DEEP_MATCH_SCORE_COST_USD = 0.14
DEEP_MATCH_SCORE_MODEL = "gemini-1.5-pro"
MONTHLY_CAP_USD = 20.00
_INITIAL_MONTH_SPEND_USD = 3.42

# Mutable running monthly spend. Bumped by each successful runDeepMatchScore.
month_spend_usd: float = _INITIAL_MONTH_SPEND_USD


def cap_remaining_usd() -> float:
    """Remaining monthly-cap headroom in USD (D8b), floored at 0."""
    return round(max(0.0, MONTHLY_CAP_USD - month_spend_usd), 2)


# ---------------------------------------------------------------------------
# applications / archive / transitions / timelines / interviews / snapshots
# (D6/D7 posting-vs-application split, D10 snapshot, D12 dismiss, D18 undo,
#  D19 reactivate). Ported from fixtures.ts APPS/APPS_BACKEND/APPS_AI_INFRA/
#  ARCHIVE_APPS + api.ts application lifecycle. The frozen transition matrix
#  itself lives in routes/applications.py (transcribed from
#  state-machines.md#application-stages -- the settled law).
#
# Application/job ids are the VERBATIM deterministic uuids the mock's
# slugToUuid(slug, 'app'|'job') produces (dumped from the mock and pasted here)
# so the frontend's hard-coded deep-links resolve. Each seeded application owns
# a derived Job posting (mock jobFromSeed) kept in ``application_jobs`` -- a
# side store the ApplicationView join consults IN ADDITION to ``jobs`` (getJobs
# stays the 7 canonical postings; the derived postings never leak into it,
# matching the mock's JOBS-vs-_applicationJobs split).
#
# Relative fixture ages (mock ``days``) become iso_ago(days=...) instants;
# archive ``outcomeAt`` calendar dates become UTC midnights. Application.version
# seeds at 1 for every row (bumped by transitionApplication).


def _srange(lo: int, hi: int) -> SalaryRange:
    return SalaryRange(min=lo, max=hi, extra=[])


def _spoint(value: int, *extra: str) -> SalaryPoint:
    return SalaryPoint(value=value, extra=list(extra))


def _utc_date(iso: str) -> datetime:
    """Parse a ``YYYY-MM-DD`` fixture date into a UTC-midnight instant."""
    year, month, day = (int(part) for part in iso.split("-"))
    return datetime(year, month, day, tzinfo=UTC)


# Resume label -> well-known Resume id, by name-prefix (mock resumeIdForLabel).
_RESUME_ID_BY_LABEL_PREFIX: list[tuple[str, UUID]] = [
    ("Distributed-systems", RESUME_ID_DISTRIBUTED),
    ("Platform / infra", RESUME_ID_PLATFORM),
    ("For Vercel - edge", RESUME_ID_VERCEL),
    ("Master", RESUME_ID_MASTER),
]


def _resume_id_for_label(label: str) -> UUID | None:
    for prefix, rid in _RESUME_ID_BY_LABEL_PREFIX:
        if label.startswith(prefix):
            return rid
    return None


@dataclass(frozen=True)
class _AppSeed:
    """One ported application-pool fixture row (active or archive)."""

    app: str
    job: str
    company: str
    role: str
    stage: Stage
    location: str
    salary: SalaryPoint | SalaryRange | None
    resume: str
    match: int
    days: int
    source: str
    searchId: UUID
    flag: ApplicationFlag | None = None
    contact: str | None = None
    coachNudge: bool | None = None
    resurrected: bool | None = None
    outcome: Outcome | None = None
    outcomeAt: datetime | None = None
    outcomeReason: str | None = None


@dataclass
class UndoGrant:
    """A live mark-won undo grant (D18). Not on the wire -- keyed by token in
    ``undo_grants``. ``expires_at`` is mutable so tests can force expiry."""

    application: Application
    expires_at: datetime


def _mk_app_and_job(seed: _AppSeed) -> tuple[Application, Job]:
    created = iso_ago(days=seed.days)
    app = Application(
        id=UUID(seed.app),
        jobId=UUID(seed.job),
        resumeId=_resume_id_for_label(seed.resume),
        stage=seed.stage,
        version=1,
        createdAt=created,
        flag=seed.flag,
        contact=seed.contact,
        coachNudge=seed.coachNudge,
        resurrected=seed.resurrected,
        outcome=seed.outcome,
        outcomeAt=seed.outcomeAt,
        outcomeReason=seed.outcomeReason,
        outcomeReasons=None,
        searchId=seed.searchId,
    )
    job = Job(
        id=UUID(seed.job),
        company=seed.company,
        title=seed.role,
        location=JobLocation(raw=seed.location),
        workMode=JobWorkMode.onsite,
        employment=_w2_salary_ft(),
        compensation=seed.salary,
        source=JobSource(
            board=seed.source,
            channel=JobCaptureMethod.url,
            capturedAt=created,
        ),
        posted=created,
        match=JobMatch(score=seed.match, strengths=[], gaps=[]),
    )
    return app, job


# --- active pools (searchId-scoped, mock APPS / APPS_BACKEND / APPS_AI_INFRA) --
_ACTIVE_SEEDS: list[_AppSeed] = [
    # platform search (SEARCH_ID_PLATFORM)
    _AppSeed(
        app="6df605b9-9094-4344-8113-ac8b3248f03e",
        job="6df605bb-29fb-4329-8565-f422f3d9dca9",
        company="Stripe",
        role="Staff Engineer, Payments core",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(255000, 305000),
        resume="Distributed-systems v4",
        match=92,
        days=9,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
        flag=ApplicationFlag.stale,
        contact="Maya Kapoor",
        coachNudge=True,
        resurrected=True,
    ),
    _AppSeed(
        app="df79d7bf-8cd5-440b-8861-c958311e8734",
        job="df79d7b1-bda1-4a77-8227-cb65b5056ff4",
        company="Linear",
        role="Senior Staff Engineer, Platform",
        stage=Stage.screening,
        location="Remote - US",
        salary=_srange(280000, 340000),
        resume="Distributed-systems v4",
        match=88,
        days=6,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="6a6918ec-3133-4cb3-8e36-d670323bfc73",
        job="6a6918e0-3406-406b-8a01-fabc7ebd6b92",
        company="Vercel",
        role="Staff Engineer, Edge runtime",
        stage=Stage.offer,
        location="Remote - US/EU",
        salary=_spoint(265000, "+ 0.4% equity"),
        resume="For Vercel - edge v1",
        match=91,
        days=21,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
        flag=ApplicationFlag.offer,
        coachNudge=True,
    ),
    _AppSeed(
        app="59a0c6b1-ff2b-4091-8f6a-54f2d85f100d",
        job="59a0c6b3-fc7f-4bf9-8d9c-3f25eae80d1a",
        company="Render",
        role="Senior Staff, Platform",
        stage=Stage.rejected,
        location="Remote - US",
        salary=None,
        resume="Distributed-systems v4",
        match=68,
        days=30,
        source="lever",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="63086faa-0b03-4a6e-8b52-ce64ed6adc4e",
        job="63086faa-023b-4249-8e1a-da2e8532e303",
        company="Supabase",
        role="Principal Engineer, Realtime",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(290000, 350000),
        resume="Platform / infra v2",
        match=79,
        days=3,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="364caaeb-4908-416b-8677-e843fa87be34",
        job="364caaeb-4908-4bda-8860-8eaced47ee26",
        company="PlanetScale",
        role="Principal Engineer, Storage",
        stage=Stage.interview,
        location="Remote - US",
        salary=_srange(295000, 360000),
        resume="Distributed-systems v4",
        match=84,
        days=14,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
        resurrected=True,
    ),
    _AppSeed(
        app="24328093-6bbf-4801-8ff7-90337a46a7fa",
        job="243280e2-34a9-4dc3-819c-62d3b369dbf2",
        company="Modal",
        role="Staff Engineer, Compute",
        stage=Stage.drafting,
        location="Remote - US",
        salary=None,
        resume="-",
        match=81,
        days=0,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="ff2b3959-65a6-429f-8a77-bf8f15ea77f0",
        job="ff2b3959-65a9-4be7-825e-803fede965a7",
        company="Cloudflare",
        role="Senior Staff, Workers",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(270000, 330000),
        resume="Platform / infra v2",
        match=91,
        days=1,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="6aeb106c-d04d-4bde-8720-62637449921d",
        job="6aeb1067-ca3a-4d4b-8501-0c5c410b09f3",
        company="Sentry",
        role="Staff Engineer, Ingest",
        stage=Stage.interview,
        location="Remote - US",
        salary=_srange(260000, 315000),
        resume="Distributed-systems v4",
        match=89,
        days=11,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="1fad38c6-8dd4-4487-8887-a7f91f563f35",
        job="1fad3810-10aa-44ae-8e48-43967660a0cf",
        company="Fly.io",
        role="Principal Engineer",
        stage=Stage.screening,
        location="Remote - US",
        salary=_srange(285000, 345000),
        resume="Distributed-systems v4",
        match=79,
        days=7,
        source="lever",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="96ce626f-0bd6-4ea2-846d-22a1c145e9ac",
        job="96ce626f-013a-490c-86de-f8f3e90bea12",
        company="Temporal",
        role="Staff Engineer",
        stage=Stage.screening,
        location="Remote - US",
        salary=_srange(250000, 310000),
        resume="Distributed-systems v4",
        match=72,
        days=4,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="a822d3fe-0cda-4434-8464-9774e3fc8684",
        job="a822d161-2e8d-46cc-8f86-d11ae92ec666",
        company="Neon",
        role="Staff Engineer, Postgres",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(245000, 300000),
        resume="Distributed-systems v4",
        match=77,
        days=5,
        source="workday",
        searchId=SEARCH_ID_PLATFORM,
    ),
    _AppSeed(
        app="f2750d1b-efef-422f-8931-1c953b902ca1",
        job="f2750d1b-ef57-4690-820e-b38b643b5d17",
        company="Honeycomb",
        role="Staff Engineer, Observability",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(255000, 310000),
        resume="Distributed-systems v4",
        match=88,
        days=12,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
        flag=ApplicationFlag.stale,
    ),
    _AppSeed(
        app="f1d0fa20-f831-4091-8948-7f02e1a3f785",
        job="f1d0fa24-92e0-4532-845b-d3757e812756",
        company="Convex",
        role="Senior Staff, DB",
        stage=Stage.rejected,
        location="Remote - US",
        salary=None,
        resume="Distributed-systems v4",
        match=64,
        days=18,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
    ),
    # backend search (SEARCH_ID_BACKEND)
    _AppSeed(
        app="f19e75b9-f0ed-4dd4-8013-a78453ed1156",
        job="f19e75b9-f327-48dd-8004-745d87cbb1cb",
        company="Wise",
        role="Staff Engineer, Money movement",
        stage=Stage.screening,
        location="Remote - US",
        salary=_srange(240000, 300000),
        resume="Distributed-systems v4",
        match=90,
        days=5,
        source="greenhouse",
        searchId=SEARCH_ID_BACKEND,
        contact="Dev Anand",
    ),
    _AppSeed(
        app="f193b78f-daf6-4322-88bc-c4e3f1d29168",
        job="f193b78f-d88a-43e7-80f0-2bf64f2b625f",
        company="Adyen",
        role="Senior Staff Engineer, Ledger",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(250000, 320000),
        resume="Distributed-systems v4",
        match=87,
        days=2,
        source="ashby",
        searchId=SEARCH_ID_BACKEND,
    ),
    _AppSeed(
        app="f19cde93-416f-44e6-8e84-1a453e354a63",
        job="f19cde93-412a-460b-8c28-22bc57ea47a7",
        company="Column",
        role="Staff Engineer, Core banking API",
        stage=Stage.interview,
        location="Remote - US",
        salary=_srange(245000, 310000),
        resume="Distributed-systems v4",
        match=89,
        days=11,
        source="lever",
        searchId=SEARCH_ID_BACKEND,
        coachNudge=True,
    ),
    # ai-infra search (SEARCH_ID_AI_INFRA)
    _AppSeed(
        app="85e29a5d-03fe-4301-80a9-961bcd5ea2ae",
        job="85e29a5d-03f1-4783-8f53-9bc75abf835f",
        company="Baseten",
        role="Staff Engineer, Model serving",
        stage=Stage.applied,
        location="Remote - US",
        salary=_srange(230000, 290000),
        resume="Distributed-systems v4",
        match=83,
        days=4,
        source="ashby",
        searchId=SEARCH_ID_AI_INFRA,
    ),
]


# --- archive pool (ORI-009; terminal stage derived from outcome) ---
_ARCHIVE_SEEDS: list[_AppSeed] = [
    _AppSeed(
        app="8568e175-05d4-443b-8b0c-2e7a9bec6c16",
        job="8568e175-05d0-4243-857a-69445600c97f",
        company="Datadog",
        role="Staff Engineer, Platform",
        stage=Stage.won,
        location="Remote - US",
        salary=_spoint(258000, "+ equity"),
        resume="Distributed-systems v4",
        match=93,
        days=34,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
        contact="Priya Nair",
        outcome=Outcome.won,
        outcomeAt=_utc_date("2024-11-15"),
    ),
    _AppSeed(
        app="85681ed3-7ad9-4514-8ae6-7f4b8e524091",
        job="85681ed3-7ad2-49fe-8326-aca7f3d2ab0b",
        company="Airbnb",
        role="Staff Engineer, Payments",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(245000, 295000),
        resume="Distributed-systems v4",
        match=81,
        days=22,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-10-02"),
        outcomeReason="Position filled",
    ),
    _AppSeed(
        app="85681ed3-7a75-4852-83f3-fd540da847fb",
        job="85681ed3-7a7e-44e6-8e55-5b24f4f9b487",
        company="Notion",
        role="Senior Staff Engineer, Platform",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(230000, 280000),
        resume="Master v4",
        match=74,
        days=18,
        source="lever",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-09-14"),
        outcomeReason="Comp below range",
    ),
    _AppSeed(
        app="85681ed3-77a5-4491-8b49-8b4d1c3f2b8b",
        job="85681ed3-77ae-4b6b-8a76-4ecb16798277",
        company="Figma",
        role="Principal Engineer, Realtime",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(260000, 310000),
        resume="Platform / infra v2",
        match=88,
        days=28,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-08-30"),
        outcomeReason="Selected internal candidate",
    ),
    _AppSeed(
        app="8568e458-df6a-49bd-8305-c3f1accaf04b",
        job="8568e458-df6d-4c9b-85a4-768dbc011af3",
        company="Retool",
        role="Staff Engineer, Growth",
        stage=Stage.withdrew,
        location="Remote - US",
        salary=_srange(210000, 255000),
        resume="Master v4",
        match=69,
        days=10,
        source="workday",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.withdrawn,
        outcomeAt=_utc_date("2024-08-12"),
        outcomeReason="Withdrew - accepted other offer",
    ),
    _AppSeed(
        app="85681ed3-7571-4338-86c9-17f6963b65e5",
        job="85681ed3-7573-4fbc-8e6b-9c2a249e369a",
        company="Ramp",
        role="Staff Engineer, Infra",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(240000, 290000),
        resume="Distributed-systems v4",
        match=76,
        days=31,
        source="recruiter",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-07-22"),
        outcomeReason="Position filled",
    ),
    _AppSeed(
        app="85681ed3-7cd2-4f73-8823-ffb9e3c63565",
        job="85681ed3-7cde-4e63-8dc1-3be926bfeeea",
        company="Brex",
        role="Principal Engineer, API",
        stage=Stage.rejected,
        location="Remote - US/EU",
        salary=_srange(255000, 305000),
        resume="Master v4",
        match=83,
        days=15,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-07-08"),
    ),
    _AppSeed(
        app="8568e458-d8b5-4fda-86a5-af8609f4c12a",
        job="8568e458-d8b7-4378-8aad-bd78905a372c",
        company="Mercury",
        role="Senior Staff Engineer, Platform",
        stage=Stage.withdrew,
        location="Remote - global",
        salary=_srange(220000, 265000),
        resume="Platform / infra v2",
        match=65,
        days=8,
        source="lever",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.withdrawn,
        outcomeAt=_utc_date("2024-06-25"),
        outcomeReason="Title was a step back",
    ),
    _AppSeed(
        app="85681ed3-7fc9-4e02-8b0d-f7256afbaa26",
        job="85681ed3-7fc2-444b-81ad-e31d521f4442",
        company="Plaid",
        role="Staff Engineer, Data",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(245000, 295000),
        resume="Distributed-systems v4",
        match=79,
        days=19,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-06-10"),
        outcomeReason="Comp below range",
    ),
    _AppSeed(
        app="85681ed3-7dcc-4c2f-8b31-8cb9e461e712",
        job="85681ed3-7dc8-4ea0-8327-b1ccab4f9240",
        company="Databricks",
        role="Principal Engineer, Storage",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(270000, 320000),
        resume="Master v4",
        match=71,
        days=12,
        source="workday",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-05-29"),
    ),
    _AppSeed(
        app="8568e458-d80b-4270-8c2e-6f9eed207473",
        job="8568e458-d805-4e1d-8ee5-2a83b251d8fd",
        company="Snowflake",
        role="Staff Engineer, Data",
        stage=Stage.withdrew,
        location="Remote - US",
        salary=_spoint(268000, "+ equity"),
        resume="Platform / infra v2",
        match=61,
        days=5,
        source="recruiter",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.withdrawn,
        outcomeAt=_utc_date("2024-05-14"),
        outcomeReason="Role not fully remote",
    ),
    _AppSeed(
        app="85681ed3-72d5-46b2-80f9-ffea5073477c",
        job="85681ed3-72de-4253-8f56-66faad1de6cd",
        company="Confluent",
        role="Senior Staff Engineer, Infra",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(255000, 305000),
        resume="Distributed-systems v4",
        match=87,
        days=24,
        source="greenhouse",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-04-30"),
        outcomeReason="Failed system-design round",
    ),
    _AppSeed(
        app="85681ed3-76c8-47d9-844b-eed63c9a3299",
        job="85681ed3-76c4-4b9d-82bc-148bd03d2ade",
        company="Elastic",
        role="Principal Engineer, Search",
        stage=Stage.rejected,
        location="Remote - US/EU",
        salary=_srange(240000, 290000),
        resume="Platform / infra v2",
        match=80,
        days=17,
        source="lever",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-04-11"),
    ),
    _AppSeed(
        app="85681ed3-8021-41bc-849f-a52b60306fec",
        job="85681ed3-8023-4d12-80cb-0f6bcd39ea10",
        company="GitLab",
        role="Staff Engineer, Platform",
        stage=Stage.rejected,
        location="Remote - global",
        salary=_srange(215000, 265000),
        resume="Master v4",
        match=73,
        days=20,
        source="indeed",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-03-28"),
        outcomeReason="Role re-scoped to EM",
    ),
    _AppSeed(
        app="85681ed3-8c06-40b5-8070-584f9cf16ef8",
        job="85681ed3-8c09-4775-8f00-2ff17891c64d",
        company="HashiCorp",
        role="Senior Staff Engineer, Platform",
        stage=Stage.rejected,
        location="Remote - US",
        salary=_srange(230000, 280000),
        resume="Distributed-systems v4",
        match=68,
        days=26,
        source="ashby",
        searchId=SEARCH_ID_PLATFORM,
        outcome=Outcome.rejected,
        outcomeAt=_utc_date("2024-03-05"),
        outcomeReason="Selected internal candidate",
    ),
]


def _seed_application_state() -> tuple[
    dict[UUID, Application], dict[UUID, Application], dict[UUID, Job]
]:
    """Build (active applications, archive, derived-jobs) from the ported pools."""
    active: dict[UUID, Application] = {}
    arch: dict[UUID, Application] = {}
    derived_jobs: dict[UUID, Job] = {}
    for seed in _ACTIVE_SEEDS:
        app, job = _mk_app_and_job(seed)
        active[app.id] = app
        derived_jobs[job.id] = job
    for seed in _ARCHIVE_SEEDS:
        app, job = _mk_app_and_job(seed)
        arch[app.id] = app
        derived_jobs[job.id] = job
    return active, arch, derived_jobs


# slug -> application uuid, for porting the slug-keyed cross-ref fixtures
# (timelines, interview rounds) onto the verbatim application ids.
APP_UUID_BY_SLUG: dict[str, UUID] = {
    "stripe": UUID("6df605b9-9094-4344-8113-ac8b3248f03e"),
    "linear": UUID("df79d7bf-8cd5-440b-8861-c958311e8734"),
    "vercel": UUID("6a6918ec-3133-4cb3-8e36-d670323bfc73"),
    "supabase": UUID("63086faa-0b03-4a6e-8b52-ce64ed6adc4e"),
    "planetscale": UUID("364caaeb-4908-416b-8677-e843fa87be34"),
    "sentry": UUID("6aeb106c-d04d-4bde-8720-62637449921d"),
    "be-column": UUID("f19cde93-416f-44e6-8e84-1a453e354a63"),
}


def _tl_id(fixture_id: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"mock:timeline:{fixture_id}")


def _timeline_actor(who: str) -> Actor | None:
    if who == "You":
        return Actor.you
    if who == "Coach":
        return Actor.coach_on_behalf
    if "detector" in who.lower():
        return Actor.agent
    return None


# Ported from fixtures.ts TIMELINE_BY_APP (TRK-118). The fixture's calendar-ish
# ``time`` strings ("Jan 22", "Mar 14") carry no fixed anchor, so timestamps are
# a JUDGMENT CALL: monotonically increasing iso_ago offsets that preserve the
# fixture's oldest-first ordering. The mock's ``badge`` field is dropped (the
# frozen TimelineEvent carries structured ``actor`` instead).
_TIMELINE_FIXTURES: dict[str, list[tuple[str, str, str]]] = {
    "stripe": [
        ("tl-stripe-1", "You", "Applied via Greenhouse"),
        ("tl-stripe-2", "Stale-detector", "Flagged as stale (9d, median 6d)"),
        ("tl-stripe-3", "Coach", "Drafted follow-up email"),
        ("tl-stripe-4", "You", "Sent follow-up to Maya Kapoor"),
    ],
    "linear": [
        ("tl-linear-1", "You", "Applied via Ashby"),
        (
            "tl-linear-2",
            "Linear recruiting",
            "Recruiter screen scheduled - Thu 11:00 AM",
        ),
    ],
    "supabase": [
        ("tl-supabase-1", "You", "Applied via Greenhouse"),
    ],
    "planetscale": [
        ("tl-planetscale-1", "You", "Applied via Ashby"),
        ("tl-planetscale-2", "PlanetScale recruiting", "Phone screen scheduled"),
        ("tl-planetscale-3", "You", "Completed phone screen"),
    ],
    "sentry": [
        ("tl-sentry-1", "You", "Applied via Greenhouse"),
        ("tl-sentry-2", "You", "Tailored Distributed-systems v4 as the basis resume"),
        ("tl-sentry-3", "Dana Okafor", "Hiring manager scheduled technical round"),
    ],
    "be-column": [
        ("tl-be-column-1", "You", "Applied via Ashby"),
        ("tl-be-column-2", "Column recruiting", "Recruiter screen scheduled"),
        ("tl-be-column-3", "You", "Completed recruiter screen"),
        ("tl-be-column-4", "Column", "Onsite interview scheduled - Thu"),
    ],
}


def _seed_timelines() -> dict[UUID, list[TimelineEvent]]:
    out: dict[UUID, list[TimelineEvent]] = {}
    for slug, events in _TIMELINE_FIXTURES.items():
        app_id = APP_UUID_BY_SLUG[slug]
        count = len(events)
        out[app_id] = [
            TimelineEvent(
                id=_tl_id(fixture_id),
                time=iso_ago(days=count - index),
                who=who,
                message=message,
                actor=_timeline_actor(who),
            )
            for index, (fixture_id, who, message) in enumerate(events)
        ]
    return out


def _ir_id(fixture_id: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"mock:interview-round:{fixture_id}")


# Ported from fixtures.ts INTERVIEW_ROUNDS (TRK-117). ``date`` fixture strings
# ("Mar 14, 2026", "Thu, Mar 20") are not cleanly parseable and carry no anchor,
# so dates are a JUDGMENT CALL: monotonic iso_ago offsets preserving order.
# (slug, fixture_id, type, format, status)
_INTERVIEW_FIXTURES: list[
    tuple[str, str, InterviewType, InterviewFormat, InterviewStatus]
] = [
    (
        "stripe",
        "ir-stripe-1",
        InterviewType.recruiter_screen,
        InterviewFormat.phone,
        InterviewStatus.completed,
    ),
    (
        "stripe",
        "ir-stripe-2",
        InterviewType.technical,
        InterviewFormat.video,
        InterviewStatus.scheduled,
    ),
    (
        "planetscale",
        "ir-planetscale-1",
        InterviewType.recruiter_screen,
        InterviewFormat.phone,
        InterviewStatus.completed,
    ),
    (
        "planetscale",
        "ir-planetscale-2",
        InterviewType.onsite,
        InterviewFormat.onsite,
        InterviewStatus.scheduled,
    ),
    (
        "sentry",
        "ir-sentry-1",
        InterviewType.recruiter_screen,
        InterviewFormat.phone,
        InterviewStatus.completed,
    ),
    (
        "sentry",
        "ir-sentry-2",
        InterviewType.technical,
        InterviewFormat.video,
        InterviewStatus.scheduled,
    ),
    (
        "linear",
        "ir-linear-1",
        InterviewType.recruiter_screen,
        InterviewFormat.phone,
        InterviewStatus.scheduled,
    ),
    (
        "be-column",
        "ir-be-column-1",
        InterviewType.recruiter_screen,
        InterviewFormat.video,
        InterviewStatus.completed,
    ),
    (
        "be-column",
        "ir-be-column-2",
        InterviewType.onsite,
        InterviewFormat.onsite,
        InterviewStatus.scheduled,
    ),
]


def _seed_interview_rounds() -> list[InterviewRound]:
    rounds: list[InterviewRound] = []
    for index, (slug, fixture_id, itype, iformat, istatus) in enumerate(
        _INTERVIEW_FIXTURES
    ):
        rounds.append(
            InterviewRound(
                id=_ir_id(fixture_id),
                appId=APP_UUID_BY_SLUG[slug],
                date=iso_ago(days=len(_INTERVIEW_FIXTURES) - index),
                type=itype,
                format=iformat,
                status=istatus,
            )
        )
    return rounds


# Live stores. Never reassigned -- mutated in place so imported references stay
# valid. Routes read/write ``store.applications`` etc.
applications, archive, application_jobs = _seed_application_state()
transition_logs: dict[UUID, list[StageTransition]] = {}
timelines: dict[UUID, list[TimelineEvent]] = _seed_timelines()
interview_rounds: list[InterviewRound] = _seed_interview_rounds()
undo_grants: dict[UUID, UndoGrant] = {}
resume_snapshots: dict[UUID, ResumeSnapshot] = {}


def application_view(app: Application) -> ApplicationView:
    """Join an Application to its Job + Resume, flattening the display fields
    onto the read model (mock ``applicationView`` / the ``?expand=job,resume``
    view). Consults ``jobs`` first, then the derived ``application_jobs``."""
    job = jobs.get(app.jobId) or application_jobs.get(app.jobId)
    if job is None:  # pragma: no cover -- every application owns a resolvable job
        raise KeyError(f"no job for application {app.id}")
    resume = resumes.get(app.resumeId) if app.resumeId else None
    return ApplicationView(
        **app.model_dump(),
        job=job,
        resume=resume,
        company=job.company,
        role=job.title,
        location=job.location.raw,
        salary=job.compensation,
        match=job.match.score if job.match else 0,
        source=job.source.board,
        resumeName=resume.name if resume else "No resume selected",
    )
