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
    Kind3,
    PreviewKind,
    RemotePolicy,
    Resume,
    ResumeExport,
    ResumeTag,
    ResumeTemplate,
    ResumeUpload,
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
# reset -- restore every store to pristine fixture state. Called by the
# scaffold test conftest between tests; phase-2 agents extend this.
# ---------------------------------------------------------------------------


def reset() -> None:
    """Restore all in-memory stores to their pristine seeded state."""
    searches.clear()
    searches.update(_seed_searches())
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
