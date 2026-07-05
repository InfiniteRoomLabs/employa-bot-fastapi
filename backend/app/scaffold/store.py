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
from uuid import UUID, uuid5

from app.scaffold.models import (
    Cadence,
    Classification,
    Commitment,
    Employment,
    Job,
    JobCaptureMethod,
    JobInboxItem,
    JobLocation,
    JobMatch,
    JobSource,
    JobWorkMode,
    MatchGap,
    MatchRubricRow,
    RemotePolicy,
    SalaryPoint,
    SalaryRange,
    Search,
    SearchCriteria,
    Severity,
    ShortlistEntry,
    Source,
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
