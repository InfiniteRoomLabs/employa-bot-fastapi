/**
 * Raw fixtures derived verbatim from the hi-fi design archive
 * (`/tmp/employa-design/src/data.jsx` + `src/screens/*.jsx` inline data).
 * Consumed only via `src/data/api.ts`. Do not import directly from components.
 *
 * Values are kept verbatim from the source zip — field names are not renamed,
 * shapes are not invented. Where a screen's inline data is sparse / loosely
 * typed in the source, the corresponding fixture is also typed loosely with a
 * comment naming the screen file the row came from.
 */

import type {
  Accomplishment,
  Agent,
  AgentConfigRow,
  AgentLogEntry,
  AgentPermission,
  AgentRecentAction,
  AgentTrustTier,
  Answer,
  Application,
  ApplicationFilter,
  ApplicationFlag,
  ApplicationSource,
  ApplicationView,
  CareerHistoryItem,
  CoachGreeting,
  CoachMessage,
  CoachProposal,
  CoachThread,
  CoachThreadScope,
  Contact,
  ContextCard,
  Credential,
  DangerAction,
  DashboardNudge,
  EmailParserFallback,
  Employment,
  ExtensionRecentCapture,
  ExtensionState,
  ExtensionToken,
  IntegrationRow,
  InterviewRound,
  InvoiceRow,
  Job,
  JobInboxItem,
  KanbanColumn,
  MatchGap,
  MatchRubricRow,
  Notification,
  NotifPref,
  OnboardingAgent,
  OnboardingIntegration,
  OnboardingStance,
  PrivacyToggle,
  Project,
  ProviderRow,
  Resume,
  ResumeExport,
  ResumeSuggestion,
  ResumeTemplate,
  ResumeUpload,
  RoutingRow,
  Salary,
  Search,
  SearchCriteria,
  ShortlistEntry,
  Stage,
  TimelineEvent,
  Toast,
  TrustTierRung,
  UsageRow,
  User,
  UserMenuRow,
} from "./types"

// ---------------------------------------------------------------------------
// Shared fixtures from `data.jsx`
// ---------------------------------------------------------------------------

/** From `data.jsx :: REMY`. */
export const REMY: User = {
  name: "Wes Gilleland",
  email: "wes.gilleland@gmail.com",
  initials: "WG",
  city: "Lexington, KY",
  current: "Founder & Principal Engineer - Infinite Room Labs",
  years: 12,
  comp_floor: 210000,
  target_titles: [
    "Staff Engineer",
    "Senior Staff Engineer",
    "Principal Engineer",
    "Platform Lead",
  ],
}

/**
 * Seed shape for an application before normalization (ADR-006 stage 3). Carries
 * the posting display fields inline; the normalizer below derives a Job from
 * each seed and produces an ids-only `Application` + the joined view.
 */
interface ApplicationSeed {
  id: string
  company: string
  role: string
  stage: Stage
  stageLabel: string
  location: string
  salary: Salary | null
  resume: string
  match: number
  days: number
  flag?: ApplicationFlag
  source: ApplicationSource
  contact?: string
  coachNudge?: boolean
  resurrected?: boolean
  outcome?: "won" | "rejected" | "withdrawn"
  outcomeAt?: string
  outcomeReason?: string
}

/** From `data.jsx :: APPS`. All 14 active applications + history (seed form). */
const APPS_SEED: readonly ApplicationSeed[] = [
  {
    id: "stripe",
    company: "Stripe",
    role: "Staff Engineer, Payments core",
    stage: "applied",
    stageLabel: "applied - 9d",
    location: "Remote - US",
    salary: { min: 255000, max: 305000, extra: [] },
    resume: "Distributed-systems v4",
    match: 92,
    days: 9,
    flag: "stale",
    source: "greenhouse",
    contact: "Maya Kapoor",
    coachNudge: true,
    resurrected: true,
  },
  {
    id: "linear",
    company: "Linear",
    role: "Senior Staff Engineer, Platform",
    stage: "screen",
    stageLabel: "recruiter screen - Thu 11:00",
    location: "Remote - US",
    salary: { min: 280000, max: 340000, extra: [] },
    resume: "Distributed-systems v4",
    match: 88,
    days: 6,
    source: "ashby",
  },
  {
    id: "vercel",
    company: "Vercel",
    role: "Staff Engineer, Edge runtime",
    stage: "offer",
    stageLabel: "offer - decide Fri",
    location: "Remote - US/EU",
    salary: { value: 265000, extra: ["+ 0.4% equity"] },
    resume: "For Vercel - edge v1",
    match: 91,
    days: 21,
    flag: "offer",
    source: "ashby",
    coachNudge: true,
  },
  {
    id: "render",
    company: "Render",
    role: "Senior Staff, Platform",
    stage: "rejected",
    stageLabel: "rejected - Mar 10",
    location: "Remote - US",
    salary: null,
    resume: "Distributed-systems v4",
    match: 68,
    days: 30,
    source: "lever",
  },
  {
    id: "supabase",
    company: "Supabase",
    role: "Principal Engineer, Realtime",
    stage: "applied",
    stageLabel: "applied - 3d",
    location: "Remote - US",
    salary: { min: 290000, max: 350000, extra: [] },
    resume: "Platform / infra v2",
    match: 79,
    days: 3,
    source: "greenhouse",
  },
  {
    id: "planetscale",
    company: "PlanetScale",
    role: "Principal Engineer, Storage",
    stage: "interview",
    stageLabel: "onsite - Thu",
    location: "Remote - US",
    salary: { min: 295000, max: 360000, extra: [] },
    resume: "Distributed-systems v4",
    match: 84,
    days: 14,
    source: "ashby",
    resurrected: true,
  },
  {
    id: "modal",
    company: "Modal",
    role: "Staff Engineer, Compute",
    stage: "draft",
    stageLabel: "drafting",
    location: "Remote - US",
    salary: null,
    resume: "-",
    match: 81,
    days: 0,
    source: "greenhouse",
  },
  {
    id: "cloudflare",
    company: "Cloudflare",
    role: "Senior Staff, Workers",
    stage: "applied",
    stageLabel: "applied - 1d",
    location: "Remote - US",
    salary: { min: 270000, max: 330000, extra: [] },
    resume: "Platform / infra v2",
    match: 91,
    days: 1,
    source: "greenhouse",
  },
  {
    id: "sentry",
    company: "Sentry",
    role: "Staff Engineer, Ingest",
    stage: "interview",
    stageLabel: "interview - Mon",
    location: "Remote - US",
    salary: { min: 260000, max: 315000, extra: [] },
    resume: "Distributed-systems v4",
    match: 89,
    days: 11,
    source: "greenhouse",
  },
  {
    id: "flyio",
    company: "Fly.io",
    role: "Principal Engineer",
    stage: "screen",
    stageLabel: "phone screen - Fri",
    location: "Remote - US",
    salary: { min: 285000, max: 345000, extra: [] },
    resume: "Distributed-systems v4",
    match: 79,
    days: 7,
    source: "lever",
  },
  {
    id: "temporal",
    company: "Temporal",
    role: "Staff Engineer",
    stage: "screen",
    stageLabel: "system design - next wk",
    location: "Remote - US",
    salary: { min: 250000, max: 310000, extra: [] },
    resume: "Distributed-systems v4",
    match: 72,
    days: 4,
    source: "ashby",
  },
  {
    id: "neon",
    company: "Neon",
    role: "Staff Engineer, Postgres",
    stage: "applied",
    stageLabel: "applied - 5d",
    location: "Remote - US",
    salary: { min: 245000, max: 300000, extra: [] },
    resume: "Distributed-systems v4",
    match: 77,
    days: 5,
    source: "workday",
  },
  {
    id: "honeycomb",
    company: "Honeycomb",
    role: "Staff Engineer, Observability",
    stage: "applied",
    stageLabel: "applied - 12d",
    location: "Remote - US",
    salary: { min: 255000, max: 310000, extra: [] },
    resume: "Distributed-systems v4",
    match: 88,
    days: 12,
    flag: "stale",
    source: "greenhouse",
  },
  {
    id: "convex",
    company: "Convex",
    role: "Senior Staff, DB",
    stage: "rejected",
    stageLabel: "rejected - Feb 28",
    location: "Remote - US",
    salary: null,
    resume: "Distributed-systems v4",
    match: 64,
    days: 18,
    source: "greenhouse",
  },
]

/** From `data.jsx :: SHORTLIST_DATA`. */
// Job UUIDs (ADR-006). Declared here -- above SHORTLIST_DATA / JOBS -- so every
// resource that references a posting by id can do so without a TDZ hazard.
export const JOB_ID_STRIPE = "b7e9c4a1-0d2f-4c83-9a16-1e5f7c3b8d40"
export const JOB_ID_LINEAR = "c8f0d5b2-1e3a-4d94-8b27-2f6a8d4c9e51"
export const JOB_ID_SENTRY = "d9a1e6c3-2f4b-4ea5-9c38-3a7b9e5daf62"
export const JOB_ID_FLYIO = "e0b2f7d4-3a5c-4fb6-ad49-4b8caf6eb073"
export const JOB_ID_TEMPORAL = "f1c3a8e5-4b6d-40c7-be5a-5c9dba7fc184"
export const JOB_ID_NEON = "a2d4b9f6-5c7e-41d8-cf6b-6daecb80d295"
export const JOB_ID_HONEYCOMB = "b3e5caf7-6d8f-42e9-da7c-7ebfdc91e3a6"

export const SHORTLIST_DATA: readonly ShortlistEntry[] = [
  {
    jobId: JOB_ID_STRIPE,
    company: "Stripe",
    role: "Staff Engineer - Payments core",
    location: "Remote - US",
    compensation: "$255-305k",
    match: 92,
    saved: "today",
    source: "you",
    why: "Payment-path services at scale - lines up with your ingest-pipeline and multi-region work.",
  },
  {
    jobId: JOB_ID_LINEAR,
    company: "Linear",
    role: "Senior Staff Engineer - Platform",
    location: "Remote - US",
    compensation: "$280-340k",
    match: 88,
    saved: "today",
    source: "you",
    why: "You saved this after Maya at Linear reached out on LinkedIn. Rust + Postgres platform team.",
  },
  {
    jobId: JOB_ID_SENTRY,
    company: "Sentry",
    role: "Staff Engineer - Ingest",
    location: "Remote - US",
    compensation: "$260-315k",
    match: 84,
    saved: "2d ago",
    source: "you",
    why: "High-throughput ingest pipelines - they mention 2M events/sec, which is your scale.",
  },
  {
    company: "Render",
    role: "Senior Staff - Platform",
    location: "Remote - US",
    compensation: "$235-280k",
    match: 79,
    saved: "4d ago",
    source: "you",
  },
  {
    company: "Temporal",
    role: "Principal Engineer - Workflow",
    location: "Remote - US",
    compensation: "-",
    match: 72,
    saved: "1w ago",
    source: "you",
    stale: true,
  },
  {
    company: "Neon",
    role: "Staff Engineer - Storage",
    location: "Remote - global",
    compensation: "$240-290k",
    match: 77,
    saved: "1w ago",
    source: "you",
    stale: true,
  },
]

/** From `data.jsx :: JOBS_INBOX`. */
export const JOBS_INBOX: readonly JobInboxItem[] = [
  {
    jobId: JOB_ID_STRIPE,
    company: "Stripe",
    role: "Staff Engineer - Payments core",
    location: "Remote - US",
    compensation: "$255-305k",
    match: 92,
    source: "greenhouse",
    isNew: true,
    posted: "2d ago",
    // DEC-057: full captured payload.
    capturedVia: "url",
    capturedAt: "2d ago, pasted from hiring.cafe",
    sourceUrl: "https://boards.greenhouse.io/stripe/jobs/staff-payments-core",
    workMode: "remote",
    employmentType: "Full-time",
    seniority: "Staff",
    summary:
      "Own payment-path services handling millions of transactions/min. Idempotency, ledgering, multi-region failover. Reports to the Payments Platform lead.",
    tags: [
      "Go",
      "Rust",
      "Postgres",
      "Distributed systems",
      "Kafka",
      "gRPC",
      "Multi-region",
    ],
    requirements: [
      "8+ years backend / distributed systems",
      "Production ownership of high-throughput services",
      "Strong Go or Rust",
      "Experience with idempotency + exactly-once semantics",
    ],
    strengths: [
      "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - direct match",
      "Multi-region Postgres migration maps to their failover work",
      "Comp band ($255-305k) clears your $210k floor",
    ],
    gaps: [
      "No explicit idempotency / exactly-once work surfaced on the resume",
      "Rust listed but Go is the primary stack on file",
    ],
    jd: "Stripe is hiring a Staff Engineer on Payments core (remote, US). You will own services on the synchronous payment path...\n\nResponsibilities:\n- Design and operate high-throughput, low-latency payment services\n- Drive multi-region resilience and failover\n- Mentor senior engineers\n\nQualifications:\n- 8+ years backend, distributed systems\n- Go or Rust in production at scale\n\nComp: $255,000-$305,000 + equity.",
  },
  {
    jobId: JOB_ID_LINEAR,
    company: "Linear",
    role: "Senior Staff Engineer - Platform",
    location: "Remote - US",
    compensation: "$245-285k",
    match: 88,
    source: "ashby",
    isNew: true,
    posted: "1d ago",
    // DEC-057: full captured payload.
    capturedVia: "extension",
    capturedAt: "1d ago, browser extension",
    sourceUrl: "https://linear.app/jobs/senior-staff-engineer-platform",
    workMode: "remote",
    employmentType: "Full-time",
    seniority: "Senior Staff",
    summary:
      "Own the build/CI platform and the sync engine that powers real-time collaboration across all Linear clients. You will work closely with product and design to keep the platform fast and reliable.",
    tags: [
      "TypeScript",
      "React",
      "Postgres",
      "Distributed systems",
      "GraphQL",
      "CI/CD",
      "Platform",
    ],
    requirements: [
      "10+ years software engineering, including Staff+ IC experience",
      "Deep TypeScript / Node.js expertise",
      "Experience building and operating developer platforms (CI/CD, tooling, infra)",
      "Strong distributed-systems fundamentals",
    ],
    strengths: [
      "Platform / infra v2 resume leads with CI/CD overhaul (build times halved, flake 80% down) - direct match",
      "TypeScript listed across multiple roles; sync-engine patterns appear in distributed-systems work",
      "Comp band ($245-285k) clears your $210k floor",
    ],
    gaps: [
      "No explicit real-time sync or CRDT/OT work surfaced on the resume",
      "React listed but frontend depth not prominent in the IC story",
    ],
    jd: "Linear is looking for a Senior Staff Engineer to own our Platform team (remote, US). The platform team is responsible for the sync engine, build infrastructure, and the internal tooling that lets the rest of Linear move fast.\n\nResponsibilities:\n- Own the real-time sync engine used by all Linear clients\n- Drive build-system and CI/CD reliability (build times, flake rate, reproducibility)\n- Partner with infra on the Postgres-backed architecture\n- Mentor engineers across the org on platform patterns\n\nQualifications:\n- 10+ years engineering, Staff+ IC track record\n- Deep TypeScript expertise\n- CI/CD and build-system ownership at scale\n\nComp: $245,000-$285,000 + meaningful equity.",
  },
  {
    jobId: JOB_ID_SENTRY,
    company: "Sentry",
    role: "Staff Engineer - Ingest",
    location: "Remote - US",
    compensation: "$220-260k",
    match: 84,
    source: "lever",
    posted: "3d ago",
    // DEC-057: full captured payload.
    capturedVia: "email-forward",
    capturedAt: "3d ago, forwarded email",
    sourceUrl: "https://sentry.io/careers/staff-engineer-ingest",
    workMode: "remote",
    employmentType: "Full-time",
    seniority: "Staff",
    summary:
      "Own the high-throughput event ingest pipeline that ingests billions of error events per day. Rust + Kafka + ClickHouse stack. You will drive reliability, cost, and latency improvements at massive scale.",
    tags: [
      "Rust",
      "Kafka",
      "ClickHouse",
      "Python",
      "Distributed systems",
      "High-throughput",
      "Observability",
    ],
    requirements: [
      "8+ years backend engineering",
      "Production experience with high-throughput event streaming (Kafka or equivalent)",
      "Strong Rust or C++",
      "Experience with columnar stores (ClickHouse, BigQuery, Redshift)",
    ],
    strengths: [
      "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - strong signal for this team",
      "Kafka and ClickHouse experience listed in the Observability section of the resume",
      "Comp band ($220-260k) clears your $210k floor",
    ],
    gaps: [
      "Rust is listed but limited production depth shown on resume vs their strong preference",
      "No explicit columnar-store ownership or query-optimization work called out",
    ],
    jd: "Sentry is hiring a Staff Engineer for the Ingest team (remote, US). The Ingest team owns the pipeline that processes billions of events per day -- from SDK to storage.\n\nResponsibilities:\n- Own end-to-end reliability and latency of the ingest pipeline\n- Drive cost reduction on ClickHouse and Kafka infrastructure\n- Collaborate with the SDK team on the ingestion contract\n- Mentor and grow engineers on the team\n\nQualifications:\n- 8+ years backend, with production high-throughput systems\n- Rust or C++ at scale\n- Kafka and ClickHouse (or equivalent columnar store)\n\nComp: $220,000-$260,000 + equity.",
  },
  {
    jobId: JOB_ID_FLYIO,
    company: "Fly.io",
    role: "Principal Engineer",
    location: "Remote - US",
    compensation: "$225-275k",
    match: 79,
    source: "lever",
    posted: "4d ago",
  },
  {
    jobId: JOB_ID_TEMPORAL,
    company: "Temporal",
    role: "Staff Engineer",
    location: "Remote - US",
    compensation: "$230-280k",
    match: 72,
    source: "greenhouse",
    posted: "5d ago",
  },
  {
    jobId: JOB_ID_NEON,
    company: "Neon",
    role: "Staff Engineer - Postgres",
    location: "Remote - US",
    compensation: "$215-260k",
    match: 77,
    source: "ashby",
    posted: "6d ago",
  },
  {
    jobId: JOB_ID_HONEYCOMB,
    company: "Honeycomb",
    role: "Staff Engineer - Observability",
    location: "Remote - US",
    compensation: "$220-265k",
    match: 81,
    source: "greenhouse",
    isNew: true,
    posted: "2d ago",
  },
]

// ---------------------------------------------------------------------------
// Jobs (ADR-006: first-class posting resource, UUID-keyed)
//
// The canonical Job table the inbox / shortlist / applications all reference by
// id. Seeded from the platform-search inbox. The first three carry the full
// captured payload + match (DEC-057); the rest are partial captures (still
// enriching) to exercise graceful degradation on the detail surface.
// ---------------------------------------------------------------------------

/** Standard full-time W2 salaried role -- the common case for these postings. */
const W2_SALARY_FT: Employment = {
  classification: "w2",
  cadence: "salary",
  commitment: "full-time",
}

export const JOBS: readonly Job[] = [
  {
    id: JOB_ID_STRIPE,
    company: "Stripe",
    title: "Staff Engineer - Payments core",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 255000, max: 305000, extra: [] },
    seniority: "Staff",
    source: {
      board: "greenhouse",
      channel: "url",
      url: "https://boards.greenhouse.io/stripe/jobs/staff-payments-core",
      capturedAt: "2d ago, pasted from hiring.cafe",
    },
    isNew: true,
    posted: "2d ago",
    summary:
      "Own payment-path services handling millions of transactions/min. Idempotency, ledgering, multi-region failover. Reports to the Payments Platform lead.",
    tags: [
      "Go",
      "Rust",
      "Postgres",
      "Distributed systems",
      "Kafka",
      "gRPC",
      "Multi-region",
    ],
    requirements: [
      "8+ years backend / distributed systems",
      "Production ownership of high-throughput services",
      "Strong Go or Rust",
      "Experience with idempotency + exactly-once semantics",
    ],
    description:
      "Stripe is hiring a Staff Engineer on Payments core (remote, US). You will own services on the synchronous payment path...\n\nResponsibilities:\n- Design and operate high-throughput, low-latency payment services\n- Drive multi-region resilience and failover\n- Mentor senior engineers\n\nQualifications:\n- 8+ years backend, distributed systems\n- Go or Rust in production at scale\n\nComp: $255,000-$305,000 + equity.",
    match: {
      score: 92,
      strengths: [
        "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - direct match",
        "Multi-region Postgres migration maps to their failover work",
        "Comp band ($255-305k) clears your $210k floor",
      ],
      gaps: [
        "No explicit idempotency / exactly-once work surfaced on the resume",
        "Rust listed but Go is the primary stack on file",
      ],
    },
  },
  {
    id: JOB_ID_LINEAR,
    company: "Linear",
    title: "Senior Staff Engineer - Platform",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 245000, max: 285000, extra: [] },
    seniority: "Senior Staff",
    source: {
      board: "ashby",
      channel: "extension",
      url: "https://linear.app/jobs/senior-staff-engineer-platform",
      capturedAt: "1d ago, browser extension",
    },
    isNew: true,
    posted: "1d ago",
    summary:
      "Own the build/CI platform and the sync engine that powers real-time collaboration across all Linear clients. You will work closely with product and design to keep the platform fast and reliable.",
    tags: [
      "TypeScript",
      "React",
      "Postgres",
      "Distributed systems",
      "GraphQL",
      "CI/CD",
      "Platform",
    ],
    requirements: [
      "10+ years software engineering, including Staff+ IC experience",
      "Deep TypeScript / Node.js expertise",
      "Experience building and operating developer platforms (CI/CD, tooling, infra)",
      "Strong distributed-systems fundamentals",
    ],
    description:
      "Linear is looking for a Senior Staff Engineer to own our Platform team (remote, US). The platform team is responsible for the sync engine, build infrastructure, and the internal tooling that lets the rest of Linear move fast.\n\nResponsibilities:\n- Own the real-time sync engine used by all Linear clients\n- Drive build-system and CI/CD reliability (build times, flake rate, reproducibility)\n- Partner with infra on the Postgres-backed architecture\n- Mentor engineers across the org on platform patterns\n\nQualifications:\n- 10+ years engineering, Staff+ IC track record\n- Deep TypeScript expertise\n- CI/CD and build-system ownership at scale\n\nComp: $245,000-$285,000 + meaningful equity.",
    match: {
      score: 88,
      strengths: [
        "Platform / infra v2 resume leads with CI/CD overhaul (build times halved, flake 80% down) - direct match",
        "TypeScript listed across multiple roles; sync-engine patterns appear in distributed-systems work",
        "Comp band ($245-285k) clears your $210k floor",
      ],
      gaps: [
        "No explicit real-time sync or CRDT/OT work surfaced on the resume",
        "React listed but frontend depth not prominent in the IC story",
      ],
    },
  },
  {
    id: JOB_ID_SENTRY,
    company: "Sentry",
    title: "Staff Engineer - Ingest",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 220000, max: 260000, extra: [] },
    seniority: "Staff",
    source: {
      board: "lever",
      channel: "email-forward",
      url: "https://sentry.io/careers/staff-engineer-ingest",
      capturedAt: "3d ago, forwarded email",
    },
    posted: "3d ago",
    summary:
      "Own the high-throughput event ingest pipeline that ingests billions of error events per day. Rust + Kafka + ClickHouse stack. You will drive reliability, cost, and latency improvements at massive scale.",
    tags: [
      "Rust",
      "Kafka",
      "ClickHouse",
      "Python",
      "Distributed systems",
      "High-throughput",
      "Observability",
    ],
    requirements: [
      "8+ years backend engineering",
      "Production experience with high-throughput event streaming (Kafka or equivalent)",
      "Strong Rust or C++",
      "Experience with columnar stores (ClickHouse, BigQuery, Redshift)",
    ],
    description:
      "Sentry is hiring a Staff Engineer for the Ingest team (remote, US). The Ingest team owns the pipeline that processes billions of events per day -- from SDK to storage.\n\nResponsibilities:\n- Own end-to-end reliability and latency of the ingest pipeline\n- Drive cost reduction on ClickHouse and Kafka infrastructure\n- Collaborate with the SDK team on the ingestion contract\n- Mentor and grow engineers on the team\n\nQualifications:\n- 8+ years backend, with production high-throughput systems\n- Rust or C++ at scale\n- Kafka and ClickHouse (or equivalent columnar store)\n\nComp: $220,000-$260,000 + equity.",
    match: {
      score: 84,
      strengths: [
        "Distributed-systems v4 leads with a 2M-events/sec ingest pipeline - strong signal for this team",
        "Kafka and ClickHouse experience listed in the Observability section of the resume",
        "Comp band ($220-260k) clears your $210k floor",
      ],
      gaps: [
        "Rust is listed but limited production depth shown on resume vs their strong preference",
        "No explicit columnar-store ownership or query-optimization work called out",
      ],
    },
  },
  // --- partial captures (still enriching: no summary / description / match) ---
  {
    id: JOB_ID_FLYIO,
    company: "Fly.io",
    title: "Principal Engineer",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 225000, max: 275000, extra: [] },
    seniority: "Principal",
    source: {
      board: "lever",
      channel: "url",
      capturedAt: "4d ago, pasted from hiring.cafe",
    },
    posted: "4d ago",
  },
  {
    id: JOB_ID_TEMPORAL,
    company: "Temporal",
    title: "Staff Engineer",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 230000, max: 280000, extra: [] },
    seniority: "Staff",
    source: {
      board: "greenhouse",
      channel: "extension",
      capturedAt: "5d ago, browser extension",
    },
    posted: "5d ago",
  },
  {
    id: JOB_ID_NEON,
    company: "Neon",
    title: "Staff Engineer - Postgres",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 215000, max: 260000, extra: [] },
    seniority: "Staff",
    source: {
      board: "ashby",
      channel: "url",
      capturedAt: "6d ago, pasted from hiring.cafe",
    },
    posted: "6d ago",
  },
  {
    id: JOB_ID_HONEYCOMB,
    company: "Honeycomb",
    title: "Staff Engineer - Observability",
    location: { raw: "Remote - US", country: "US" },
    workMode: "remote",
    employment: W2_SALARY_FT,
    compensation: { min: 220000, max: 265000, extra: [] },
    seniority: "Staff",
    source: {
      board: "greenhouse",
      channel: "email-forward",
      capturedAt: "2d ago, forwarded email",
    },
    isNew: true,
    posted: "2d ago",
  },
]

/** Inbox/search posting lookup by id. Merged with application-jobs into the
 *  exported `JOBS_BY_ID` at the bottom of this file (ADR-006 stage 3). */
const INBOX_JOBS_BY_ID: Readonly<Record<string, Job>> = Object.fromEntries(
  JOBS.map((job) => [job.id, job]),
)

/** From `data.jsx :: AGENTS_DATA`. */
export const AGENTS_DATA: readonly Agent[] = [
  {
    id: "stale",
    name: "Stale-detector",
    icon: "clock-alert",
    state: "running",
    stateLabel: "Running",
    lastActivity: "1h ago",
    actions: 88,
    cost: "$0.08",
    description:
      "Flags applications past usual response time for that company / role.",
    live: true,
    trustTier: "suggest",
  },
  {
    id: "ghost",
    name: "Ghost-detector",
    icon: "ghost",
    state: "running",
    stateLabel: "Running",
    lastActivity: "4h ago",
    actions: 64,
    cost: "$0.06",
    description:
      "Auto-marks REJECTED after 21 days of silence. Configurable threshold.",
    live: true,
    trustTier: "act-with-approval",
  },
  {
    id: "coach",
    name: "Coach",
    icon: "message-square-heart",
    state: "demand",
    stateLabel: "On-demand",
    lastActivity: "just now",
    actions: 23,
    cost: "$0.92",
    description:
      'Reactive — runs when you open chat or click "draft follow-up".',
    trustTier: "observe",
  },
]

/**
 * Trust-tier ladder (D25 / AGT-031) -- shared across all agents. Monotonic:
 * each rung adds autonomy. The mockup soft-gates above-tier grants.
 */
export const TRUST_TIER_LADDER: readonly TrustTierRung[] = [
  {
    tier: "observe",
    label: "Observe",
    blurb: "Reads your pipeline. Never writes or acts.",
  },
  {
    tier: "suggest",
    label: "Suggest",
    blurb:
      "Drafts follow-ups and suggestions for you to review. Sends nothing.",
  },
  {
    tier: "act-with-approval",
    label: "Act with approval",
    blurb:
      "Can take actions, but each one waits in your review queue for a yes.",
  },
  {
    tier: "autonomous",
    label: "Autonomous",
    blurb:
      "Acts on its own without per-item review. Grant only for low-stakes tasks.",
  },
]

/**
 * Maps each permission label to the trust tier at which it becomes in-tier
 * (D25 / AGT-031). `getAgentPermissions` attaches this to each grant so the UI
 * can soft-gate above-tier permissions. Unknown permissions default to
 * 'observe' (ungated).
 */
export const PERMISSION_REQUIRED_TIER: Readonly<
  Record<string, AgentTrustTier>
> = {
  "Read application stage": "observe",
  "Write follow-up draft": "suggest",
  "Auto-send follow-ups": "autonomous",
  "Mark applications rejected": "autonomous",
}

/** From `data.jsx :: AGENT_LOG`. */
export const AGENT_LOG: readonly AgentLogEntry[] = [
  {
    time: "12:51",
    agentId: "stale",
    kind: "auto",
    message: "Flagged Stripe as stale (9d, median 6d)",
    ref: "Stripe · Staff Engineer",
  },
  {
    time: "12:50",
    agentId: "coach",
    kind: "await",
    message: "Drafted follow-up for Stripe — awaiting your send",
    ref: "Stripe · Staff Engineer",
  },
  {
    time: "11:14",
    agentId: "ghost",
    kind: "auto",
    message: "Auto-marked Convex REJECTED — no response 28d",
    ref: "Convex · Staff Engineer",
  },
  {
    time: "08:14",
    agentId: "stale",
    kind: "auto",
    message: "Checked 14 applications · 1 newly stale",
    ref: "Tracked applications",
  },
  {
    time: "Yesterday 18:43",
    agentId: "coach",
    kind: "success",
    message: "Sent follow-up to Linear (your click)",
    ref: "Linear · Staff Engineer",
  },
  {
    time: "Yesterday 09:30",
    agentId: "ghost",
    kind: "skipped",
    message: "Held off on Sentry — recruiter replied within window",
    ref: "Sentry · Staff Engineer",
  },
]

/**
 * Resume UUIDs. Resumes are UUID-keyed like every other resource (ADR-006);
 * routes carry the UUID (`/resume/<uuid>`), never a human-readable slug.
 */
export const RESUME_ID_MASTER = "c1a7e2b0-4d31-4f86-9a52-0b6d3e7f1c84"
export const RESUME_ID_DISTRIBUTED = "d2b8f3c1-5e42-4097-8b63-1c7e4f802d95"
export const RESUME_ID_PLATFORM = "e3c904d2-6f53-41a8-9c74-2d8f50913ea6"
export const RESUME_ID_VERCEL = "f4da15e3-7064-42b9-8d85-3e906a204fb7"
export const RESUME_ID_FOUNDER = "a5eb26f4-8175-43ca-9e96-4fa17b315ac8"
export const RESUME_ID_SHORT = "b6fc3705-9286-44db-8fa7-50b28c426bd9"

/** From `data.jsx :: RESUMES`. */
export const RESUMES: readonly Resume[] = [
  {
    id: RESUME_ID_MASTER,
    name: "Master",
    subtitle: "All experience - no targeting",
    version: "v4",
    usedIn: 0,
    updated: "2 weeks ago",
    tag: "MASTER",
    body: "Comprehensive resume covering 12 years across distributed systems, platform engineering, and founding-stage product work. Full open-source contribution history, on-call war stories, architecture decision records, and complete conference/publication list. Not submitted anywhere - serves as the canonical source for all variants.",
  },
  {
    id: RESUME_ID_DISTRIBUTED,
    name: "Distributed-systems",
    subtitle: "For Staff / Principal IC roles",
    version: "v4",
    usedIn: 5,
    updated: "1 day ago",
    tag: "DEFAULT",
    match: 92,
    body: "Optimized for Staff/Principal platform roles. Leads with a 2M-events/sec ingest pipeline (p99 cut 340ms to 45ms), a multi-region Postgres migration with zero downtime, and a 38% compute-cost reduction. Submitted to Stripe, Linear, Cloudflare, Honeycomb.",
  },
  {
    id: RESUME_ID_PLATFORM,
    name: "Platform / infra",
    subtitle: "Developer-platform emphasis",
    version: "v2",
    usedIn: 3,
    updated: "4 days ago",
    tag: "VARIANT",
    match: 84,
    body: "Reordered for dev-platform and build-infrastructure roles. Leads with internal CI/CD overhaul (build times halved, flake rate cut 80%), Kubernetes operator work, and the internal tooling platform used by 120+ engineers. Applied to Vercel, Render, and Depot.",
  },
  {
    id: RESUME_ID_VERCEL,
    name: "For Vercel - edge",
    subtitle: "Targeted - one-off",
    version: "v1",
    usedIn: 1,
    updated: "1 week ago",
    tag: "TAILORED",
    match: 91,
    body: "Tailored specifically for the Vercel Edge Runtime Staff Engineer posting. Locked after submission. Surfaces V8 isolate work, cold-start optimization research, and prior contributions to the edge-config SDK. Contact at Vercel: Sarah Chen (sourced via LinkedIn).",
  },
  {
    id: RESUME_ID_FOUNDER,
    name: "Founder to IC narrative",
    subtitle: "Different framing - exploring",
    version: "v1",
    usedIn: 0,
    updated: "3 weeks ago",
    tag: "DRAFT",
    body: 'Exploratory draft reframing founder and early-stage principal work as senior IC contributions. Translates "built and shipped the product" into systems-design wins and ownership scope a Staff IC hiring bar can evaluate. Not submitted anywhere - still rough.',
  },
  {
    id: RESUME_ID_SHORT,
    name: "Short - 1-pager",
    subtitle: "Tight one-page format",
    version: "v1",
    usedIn: 0,
    updated: "1 month ago",
    tag: "FORMAT",
    body: "Compressed single-page version of the Master resume. Used for referrals and warm intros where a recruiter or hiring manager asks for a quick read before a call.",
  },
]

// ---------------------------------------------------------------------------
// Resume lifecycle fixtures (2026-06-02 round): uploads -> career history ->
// projections (RESUMES above) -> exports + templates. See 10-library.md.
// ---------------------------------------------------------------------------

export const UPLOAD_ID_SWE_2023 = "a1c2e3f4-0506-4708-89a0-b1c2d3e4f506"
export const UPLOAD_ID_DEVOPS_2022 = "b2d3f4a5-1607-4819-9ab1-c2d3e4f50617"

/** RES-030: immutable uploaded originals, preserved after parsing. */
export const RESUME_UPLOADS: readonly ResumeUpload[] = [
  {
    id: UPLOAD_ID_SWE_2023,
    filename: "Remy_SWE_2023.pdf",
    uploadedAt: "2 weeks ago",
    parsed: true,
    sizeBytes: 184_320,
  },
  {
    id: UPLOAD_ID_DEVOPS_2022,
    filename: "Remy_DevOps_2022.docx",
    uploadedAt: "2 weeks ago",
    parsed: true,
    sizeBytes: 96_780,
  },
]

/** RES-031: the single parsed career history (UI label: "career history", never "corpus"). */
export const CAREER_HISTORY: readonly CareerHistoryItem[] = [
  {
    id: "ch-summary",
    kind: "summary",
    title: "Staff engineer - distributed systems + developer platforms",
    bullets: [
      "12 years across distributed systems, platform engineering, and founding-stage product.",
    ],
    ordinal: 0,
    sourceUploadIds: [UPLOAD_ID_SWE_2023],
  },
  {
    id: "ch-exp-payments",
    kind: "experience",
    title: "Staff Engineer, Payments Core",
    org: "Northwind",
    bullets: [
      "Cut ingest pipeline p99 from 340ms to 45ms (2M events/sec).",
      "Led zero-downtime multi-region Postgres migration.",
      "Reduced compute cost 38% via workload-aware autoscaling.",
    ],
    ordinal: 1,
    sourceUploadIds: [UPLOAD_ID_SWE_2023, UPLOAD_ID_DEVOPS_2022],
  },
  {
    id: "ch-exp-platform",
    kind: "experience",
    title: "Senior Platform Engineer",
    org: "Lumen Labs",
    bullets: [
      "Halved CI build times; cut flake rate 80%.",
      "Built internal tooling platform used by 120+ engineers.",
    ],
    ordinal: 2,
    sourceUploadIds: [UPLOAD_ID_DEVOPS_2022],
  },
  {
    id: "ch-edu",
    kind: "education",
    title: "B.S. Computer Science",
    org: "State University",
    bullets: [],
    ordinal: 3,
    sourceUploadIds: [UPLOAD_ID_SWE_2023],
  },
  {
    id: "ch-skills",
    kind: "skill",
    title: "Skills",
    bullets: [
      "Go, Rust, TypeScript",
      "Kubernetes, Postgres, Kafka",
      "Distributed systems, observability",
    ],
    ordinal: 4,
    sourceUploadIds: [UPLOAD_ID_SWE_2023, UPLOAD_ID_DEVOPS_2022],
  },
]

export const TEMPLATE_ID_CLASSIC = "c0a1b2c3-d4e5-4f60-8172-839a4b5c6d7e"
export const TEMPLATE_ID_TWO_COL = "d1b2c3d4-e5f6-4071-9283-a4b5c6d7e8f9"
export const TEMPLATE_ID_COMPACT = "e2c3d4e5-f607-4182-a394-b5c6d7e8f90a"

/** TPL-001: layout templates a projection renders through. */
export const RESUME_TEMPLATES: readonly ResumeTemplate[] = [
  {
    id: TEMPLATE_ID_CLASSIC,
    name: "Classic",
    previewKind: "single-column",
    description: "Clean single-column default. Used for the starter master.",
  },
  {
    id: TEMPLATE_ID_TWO_COL,
    name: "Two-Column Modern",
    previewKind: "two-column",
    description: "Sidebar for skills/contact, main column for experience.",
  },
  {
    id: TEMPLATE_ID_COMPACT,
    name: "Compact One-Page",
    previewKind: "compact",
    description: "Tight single page for referrals and warm intros.",
  },
]

export const EXPORT_ID_BACKEND = "f3d4e5f6-0718-4293-b4a5-c6d7e8f90a1b"

/** RES-037: rendered, regenerable outputs (one-way: projection + template -> file). */
export const RESUME_EXPORTS: readonly ResumeExport[] = [
  {
    id: EXPORT_ID_BACKEND,
    projectionId: RESUME_ID_DISTRIBUTED,
    templateId: TEMPLATE_ID_TWO_COL,
    templateVersion: "v1",
    filename: "Remy_Distributed-Systems.pdf",
    generatedAt: "1 day ago",
    regenerable: true,
  },
]

// ---------------------------------------------------------------------------
// Library artifacts (2026-06-02 round). See 10-library.md.
// ---------------------------------------------------------------------------

export const CONTACTS: readonly Contact[] = [
  {
    id: "ct-sarah-chen",
    name: "Sarah Chen",
    role: "Staff Recruiter",
    org: "Vercel",
    email: "sarah.chen@example.com",
    phone: "",
    relationship: "Recruiter (inbound via LinkedIn)",
    isReference: false,
    tags: ["recruiter", "vercel"],
    links: [{ label: "LinkedIn", url: "https://linkedin.com/in/example" }],
    notes: "Sourced the Edge Runtime Staff role. Responsive over email.",
    updated: "3 days ago",
  },
  {
    id: "ct-marcus-lee",
    name: "Marcus Lee",
    role: "Engineering Manager",
    org: "Northwind",
    email: "marcus@example.com",
    phone: "",
    relationship: "Former manager",
    isReference: true,
    tags: ["reference", "former-manager"],
    links: [],
    notes:
      "Will vouch for the payments-core p99 work. Confirmed willing to be a reference.",
    updated: "1 week ago",
  },
  {
    id: "ct-priya-r",
    name: "Priya Raman",
    role: "Principal Engineer",
    org: "Lumen Labs",
    email: "priya@example.com",
    phone: "",
    relationship: "Former peer",
    isReference: true,
    tags: ["reference", "peer"],
    links: [],
    notes:
      "Co-built the internal tooling platform. Strong technical reference.",
    updated: "2 weeks ago",
  },
]

export const PROJECTS: readonly Project[] = [
  {
    id: "pj-ingest",
    title: "Real-time ingest pipeline",
    employer: "Northwind",
    body: "Rebuilt the events ingest path: backpressure, batching, and a workload-aware autoscaler. Cut p99 340ms -> 45ms at 2M events/sec. The migration was the hard part -- dual-writing while draining the old queue.",
    tags: ["distributed-systems", "performance", "kafka"],
    updated: "2 weeks ago",
  },
  {
    id: "pj-tooling",
    title: "Internal developer platform",
    employer: "Lumen Labs",
    body: "Built the paved-road tooling 120+ engineers use daily: project scaffolding, CI templates, and a service catalog. Halved build times and cut the flake rate 80% by quarantining and auto-retrying known-flaky tests.",
    tags: ["platform", "developer-experience", "ci"],
    updated: "3 weeks ago",
  },
]

export const ACCOMPLISHMENTS: readonly Accomplishment[] = [
  {
    id: "ac-p99",
    title: "Cut ingest p99 by 87%",
    summary:
      "Led the redesign of the events ingest pipeline, cutting p99 latency from 340ms to 45ms at 2M events/sec.",
    tags: ["performance", "distributed-systems"],
    source: { projectId: "pj-ingest" },
    usedIn: 3,
    updated: "2 weeks ago",
  },
  {
    id: "ac-platform",
    title: "Platform used by 120+ engineers",
    summary:
      "Built and ran the internal developer platform adopted by every engineering team; halved build times.",
    tags: ["platform", "leadership"],
    source: { projectId: "pj-tooling" },
    usedIn: 2,
    updated: "3 weeks ago",
  },
  {
    id: "ac-cost",
    title: "Reduced compute cost 38%",
    summary:
      "Designed workload-aware autoscaling that cut compute spend 38% with no latency regression.",
    tags: ["cost", "infrastructure"],
    source: null,
    updated: "1 month ago",
    usedIn: 1,
  },
]

export const ANSWERS: readonly Answer[] = [
  {
    id: "an-comp",
    question: "What are your compensation expectations?",
    body: "Targeting total comp in the 280-340k range for a Staff-level role, flexible on the base/equity split. Open to discussing once I understand the full picture.",
    category: "compensation",
    tags: ["salary"],
    updated: "1 week ago",
  },
  {
    id: "an-why",
    question: "Why are you interested in this company?",
    body: "I gravitate toward teams shipping developer-facing infrastructure where reliability is a feature. [Customize per company.]",
    category: "motivation",
    tags: ["why-us"],
    updated: "2 weeks ago",
  },
  {
    id: "an-auth",
    question: "Are you authorized to work in the US?",
    body: "Yes -- US citizen, no sponsorship required.",
    category: "work-authorization",
    tags: ["work-auth"],
    updated: "1 month ago",
  },
  {
    id: "an-notice",
    question: "What is your notice period / availability?",
    body: "Two weeks from signing. Currently between roles, so timing is flexible.",
    category: "logistics",
    tags: ["notice"],
    updated: "1 month ago",
  },
]

export const CREDENTIALS: readonly Credential[] = []

// ---------------------------------------------------------------------------
// Coach omnipresent-panel fixtures (2026-06-02 round, COA-031/032).
// ---------------------------------------------------------------------------

/** COA-031: per-subject opening greeting + suggested-action chips. */
export const COACH_GREETING_BY_SCOPE: Readonly<
  Record<CoachThreadScope, CoachGreeting>
> = {
  application: {
    greeting: "Want help moving this application forward?",
    chips: [
      "Draft a follow-up",
      "Prep for the next round",
      "Summarize where this stands",
    ],
  },
  résumé: {
    greeting: "Want to tailor this resume to a role?",
    chips: [
      "Tighten a bullet",
      "Tailor to a job",
      "Pull from an accomplishment",
    ],
  },
  "career-history": {
    greeting: "Want to flesh out your career history?",
    chips: ["Turn a project into a bullet", "Quantify an impact", "Fill a gap"],
  },
  projection: {
    greeting: "Want help shaping this resume version?",
    chips: ["Reorder for impact", "Trim to one page", "Target a role"],
  },
  contact: {
    greeting: "Want help with this contact?",
    chips: [
      "Draft an intro message",
      "Note a follow-up",
      "Mark as a reference",
    ],
  },
  answer: {
    greeting: "Want to sharpen this answer?",
    chips: ["Make it more specific", "Shorten it", "Match a company"],
  },
  project: {
    greeting: "Want to distill this project?",
    chips: [
      "Pull out an accomplishment",
      "Quantify the impact",
      "Write a STAR story",
    ],
  },
  accomplishment: {
    greeting: "Want to reuse this accomplishment?",
    chips: ["Reword for a role", "Add to a resume", "Turn into an answer"],
  },
  prep: {
    greeting: "Want to practice for an interview?",
    chips: ["Mock a question", "Build a STAR answer", "Review my weak spots"],
  },
  general: {
    greeting: "How can I help with your search today?",
    chips: ["Review my pipeline", "What needs attention?", "Plan this week"],
  },
}

/** COA-032: canned proposals so "propose an edit" returns a believable diff per scope. */
export const COACH_PROPOSAL_FIXTURES: Readonly<Record<string, CoachProposal>> =
  {
    résumé: {
      id: "prop-resume-1",
      subject: { scope: "résumé", label: "this resume" },
      summary:
        "Tightened the ingest-pipeline bullet to lead with the quantified result.",
      diff: [
        {
          field: "Experience bullet",
          before:
            "Worked on the events ingest pipeline and improved its performance significantly.",
          after: "Cut ingest pipeline p99 from 340ms to 45ms at 2M events/sec.",
        },
      ],
      status: "pending",
    },
    answer: {
      id: "prop-answer-1",
      subject: { scope: "answer", label: "this answer" },
      summary: 'Made the "why us" answer more specific and shorter.',
      diff: [
        {
          field: "Answer body",
          before:
            "I am interested in this company because it seems like a great place to work with good people.",
          after:
            "I gravitate toward teams shipping developer-facing infrastructure where reliability is a feature.",
        },
      ],
      status: "pending",
    },
  }

// ---------------------------------------------------------------------------
// `search_criteria.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** Title chips marked active in `search_criteria.jsx :: Titles · Include`. */
export const INCLUDE_TITLES: readonly string[] = [
  "Staff Engineer",
  "Senior Staff Engineer",
  "Principal Engineer",
  "Platform Lead",
]

/** Exclude-title chips from `search_criteria.jsx :: Titles - Exclude`. */
export const EXCLUDE_TITLES: readonly string[] = [
  "Engineering Manager",
  "Director",
  "On-call lead",
]

/** Location chips from `search_criteria.jsx :: Where`. */
export const LOCATIONS: readonly string[] = [
  "Remote - US",
  "Remote - US/EU",
  "Remote - global",
]

/** Remote-policy chip set from `search_criteria.jsx`. */
export const REMOTE_OPTIONS: readonly ("OK" | "Hybrid OK" | "Required")[] = [
  "OK",
  "Hybrid OK",
  "Required",
]

/** Defaults filled into the Comp & Seniority section of `search_criteria.jsx`. */
export const COMP_DEFAULTS = {
  baseFloor: "$210k",
  baseCeiling: "$285k",
  yearsExperience: "8-14 yrs",
  maxCommuteMin: 0,
} as const

// ---------------------------------------------------------------------------
// Saved searches — synthesized from `shell.jsx` sidebar nav. The criteria
// fields mirror the platform-search criteria defined inline in `search_criteria.jsx`
// (the design only renders one search criteria screen in detail).
// ---------------------------------------------------------------------------

/**
 * Saved searches. IDs are UUID-shaped to model what the real backend
 * will issue. Sidebar links + routes carry these IDs verbatim; nothing
 * in the URL or fixture leaks human-readable slugs.
 */
export const SEARCH_ID_PLATFORM = "7c0b1f3a-2d4e-4a8c-9b21-1f8c5e3a0d12"
export const SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"
export const SEARCH_ID_AI_INFRA = "ad9e6c14-5b80-4f17-a3d2-7e6f9c1b0a55"

export const SEARCHES: readonly Search[] = [
  {
    id: SEARCH_ID_PLATFORM,
    name: "Staff / Principal - Platform - remote",
    state: "active",
    eyebrow: "Saved search - started Jan 12 - 62 days running",
    criteria: {
      titlesInclude: [...INCLUDE_TITLES],
      titlesExclude: [...EXCLUDE_TITLES],
      locations: [...LOCATIONS],
      remotePolicy: "Required",
      maxCommuteMin: COMP_DEFAULTS.maxCommuteMin,
      baseFloor: COMP_DEFAULTS.baseFloor,
      baseCeiling: COMP_DEFAULTS.baseCeiling,
      yearsExperience: COMP_DEFAULTS.yearsExperience,
    },
    jobsInInbox: 42,
    activeApplications: 14,
    shortlisted: 22,
    offers: 1,
    spendMo: "$0.56",
  },
  {
    id: SEARCH_ID_BACKEND,
    name: "Senior+ Backend - remote",
    state: "active",
    eyebrow: "Saved search - started Mar 02 - 11 days running",
    criteria: {
      titlesInclude: [
        "Staff Engineer",
        "Senior Staff Engineer",
        "Principal Engineer",
      ],
      titlesExclude: ["Engineering Manager", "Director"],
      locations: ["Remote - US", "Remote - US/EU"],
      remotePolicy: "Required",
      maxCommuteMin: 0,
      baseFloor: "$220k",
      baseCeiling: "$320k",
      yearsExperience: "8-14 yrs",
    },
    jobsInInbox: 9,
    activeApplications: 3,
    shortlisted: 6,
    offers: 0,
    spendMo: "$0.31",
  },
  {
    id: SEARCH_ID_AI_INFRA,
    name: "AI infra / inference - remote",
    state: "paused",
    eyebrow: "Saved search - paused since Feb 18",
    criteria: {
      titlesInclude: [
        "Staff Engineer",
        "Member of Technical Staff",
        "Principal Engineer",
      ],
      titlesExclude: ["Engineering Manager", "Director"],
      locations: ["Remote - US", "Remote - global"],
      remotePolicy: "Required",
      maxCommuteMin: 0,
      baseFloor: "$230k",
      baseCeiling: "$320k",
      yearsExperience: "8-14 yrs",
    },
    jobsInInbox: 2,
    activeApplications: 1,
    shortlisted: 4,
    offers: 0,
    spendMo: "$0.04",
  },
]

// ---------------------------------------------------------------------------
// `match_explorer.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `match_explorer.jsx` rubric block. */
export const MATCH_RUBRIC: readonly MatchRubricRow[] = [
  {
    label: "Skills fit",
    score: 90,
    note: "8 of 9 required skills present - Go, Rust, Postgres, Kafka, gRPC, multi-region, distributed systems, on-call",
  },
  {
    label: "Seniority",
    score: 78,
    note: "12 years, Staff/Principal scope vs Staff asked. Principal to Staff is a lateral.",
  },
  {
    label: "Comp",
    score: 82,
    note: "Posted band ($255-305k) clears your floor ($210k) comfortably.",
  },
  {
    label: "Location",
    score: 95,
    note: "Fully remote - US. No relocation.",
  },
  {
    label: "Culture signal",
    score: 80,
    note: "Infra-heavy, async-first, writes design docs - strong fit history.",
  },
]

/** From `match_explorer.jsx` gaps block. */
export const MATCH_GAPS: readonly MatchGap[] = [
  {
    severity: "high",
    text: "Weak on idempotency / exactly-once - JD asks for it, you have the multi-region work but it is buried",
  },
  {
    severity: "medium",
    text: "No mention of Kafka - they require it, you used it daily",
  },
  {
    severity: "low",
    text: "p99 latency win not surfaced explicitly (340ms to 45ms - surface it)",
  },
]

/** From `match_explorer.jsx` strengths block. */
export const MATCH_STRENGTHS: readonly string[] = [
  "2M-events/sec ingest pipeline - explicit in JD",
  "8+ years distributed systems - meets requirement",
  "Strong reliability metrics - 38% compute-cost reduction",
  "Multi-region migration experience - bonus given their scale",
]

/** Score + target ids the design hard-codes for the canonical match-explorer view. */
export const MATCH_REPORT_META = {
  score: 92,
  resumeId: "Distributed-systems",
  jobId: "stripe",
} as const

// ---------------------------------------------------------------------------
// `resume_editor.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `resume_editor.jsx` suggestion list. */
export const RESUME_SUGGESTIONS: readonly ResumeSuggestion[] = [
  {
    type: "tailored",
    title:
      "Add Kubernetes operator experience - it's in the JD as a hard requirement.",
    question: "Add to Skills row",
    cta: "Apply",
  },
  {
    type: "tailored",
    title: "Surface your p99 latency win - it is buried.",
    question: "Promote bullet 3 above bullet 2",
    cta: "Apply",
  },
  {
    type: "tailored",
    title: "Mention Stripe-specific terms: idempotency, ledgering.",
    question: "Add as Summary closer",
    cta: "Apply",
  },
  {
    type: "tailored",
    title: "Reorder: lead with the multi-region migration.",
    question: "Swap experience bullets 1 and 4",
    cta: "Apply",
  },
  {
    type: "generic",
    title: 'Bullet 3 under Datadog starts with "Owned" - vary.',
    question: "Rewrite for parallelism",
    cta: "Apply",
  },
  {
    type: "generic",
    title: "Tighten summary - 3 sentences max.",
    question: "Compress current 4 to 3",
    cta: "Apply",
  },
]

// ---------------------------------------------------------------------------
// `coach.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `coach.jsx` thread list. Ids are synthesized (not in the source). */
export const COACH_THREADS: readonly CoachThread[] = [
  {
    id: "stripe-followup",
    title: "Stripe follow-up",
    scope: "application",
    when: "now",
    active: true,
  },
  {
    id: "linear-prep",
    title: "Prep for Linear screen",
    scope: "application",
    when: "1h",
  },
  {
    id: "vercel-counter",
    title: "Vercel counter-offer",
    scope: "application",
    when: "3h",
  },
  {
    id: "supabase-tailor",
    title: "Tailor resume - Supabase",
    scope: "résumé",
    when: "Yesterday",
  },
  {
    id: "general",
    title: "General strategy",
    scope: "general",
    when: "1w",
  },
]

/**
 * From `coach.jsx :: Msg` calls in the conversation pane. Ids synthesized.
 * Only the active "stripe-followup" thread's messages are realized in the
 * source — other threads have no rendered conversation.
 */
export const COACH_MESSAGES: readonly CoachMessage[] = [
  {
    id: "m1",
    author: "bot",
    text: "9 days is past Stripe's usual response window (median 6d for this team). Want me to draft a short, non-needy follow-up?",
  },
  {
    id: "m2",
    author: "user",
    text: "yes please. keep it under 4 sentences.",
  },
  {
    id: "m3",
    author: "bot",
    text: "Here's a draft - aimed at Maya:",
    draft:
      "Hi Maya - circling back on the Staff Engineer, Payments core role. Happy to walk through the 2M-events/sec ingest pipeline I built if useful. No rush - just staying on your radar. - Wes",
    draftAttachments: [
      {
        name: "Distributed-systems v4",
        kind: "resume",
      },
      {
        name: "Stripe cover letter",
        kind: "cover-letter",
      },
    ],
  },
  {
    id: "m4",
    author: "user",
    text: "actually can you make it more specific? I want to mention the multi-region migration",
  },
  {
    id: "m5",
    author: "bot",
    text: "One sec - pulling the multi-region migration numbers from your Distributed-systems resume.",
    typing: true,
  },
]

/** From `coach.jsx :: CtxCard` blocks. */
export const COACH_CONTEXT_CARDS: readonly ContextCard[] = [
  {
    label: "Application",
    body: "Stripe - Staff Engineer, Payments core - applied 9d ago - stale",
  },
  {
    label: "Résumé attached",
    body: "Distributed-systems v4",
  },
  {
    label: "JD excerpt",
    body: "Build and own payment-path services at scale. Idempotency, ledgering, multi-region. 8+ years backend, distributed systems required...",
  },
  {
    label: "Prior threads",
    body: '"Tailor for Stripe" - Feb 28',
  },
]

// ---------------------------------------------------------------------------
// `agent_detail.jsx` inline fixtures (Stale-detector is the canonical example)
// ---------------------------------------------------------------------------

/** From `agent_detail.jsx :: CfgRow` blocks. */
export const AGENT_CONFIG_ROWS: readonly AgentConfigRow[] = [
  {
    label: "Threshold multiplier",
    hint: "1.0× aggressive · 2.5× patient",
    kind: "numInput",
    value: "1.5×",
  },
  {
    label: "Min wait before flag",
    hint: "don't even consider stale before this",
    kind: "numInput",
    value: "5 days",
  },
  {
    label: "Run frequency",
    kind: "seg",
    value: "4h",
    options: [
      {
        key: "1h",
        label: "1h",
      },
      {
        key: "4h",
        label: "4h",
      },
      {
        key: "12h",
        label: "12h",
      },
      {
        key: "d",
        label: "Daily",
      },
    ],
  },
  {
    label: "Auto-draft follow-up",
    kind: "switch",
    value: true,
  },
]

/** From `agent_detail.jsx` permissions block. */
export const AGENT_PERMISSIONS: readonly AgentPermission[] = [
  {
    permission: "Read application data",
    granted: true,
  },
  {
    permission: "Write timeline events",
    granted: true,
  },
  {
    permission: "Send notifications",
    granted: true,
  },
  {
    permission: "Send mail on your behalf",
    granted: false,
  },
]

/** From `agent_detail.jsx :: Recent actions`. */
export const AGENT_RECENT_ACTIONS: readonly AgentRecentAction[] = [
  {
    time: "12:51 today",
    message: "Flagged Stripe — 9d (median 6d)",
    reference: "auto · acted",
  },
  {
    time: "08:14 today",
    message: "Checked 14 apps · 1 newly stale",
    reference: "auto · run",
  },
  {
    time: "yesterday",
    message: "Cleared Linear — recruiter replied",
    reference: "auto · cleared",
  },
  {
    time: "2d ago",
    message: "Flagged Honeycomb — 11d (median 7d)",
    reference: "auto · acted",
  },
  {
    time: "4d ago",
    message: "Checked 12 apps · 0 newly stale",
    reference: "auto · run",
  },
]

// ---------------------------------------------------------------------------
// `settings.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `settings.jsx :: SetProfile` form defaults. */
export const SETTINGS_PROFILE = {
  name: "Wes Gilleland",
  email: "wes.gilleland@gmail.com",
  phone: "(859) 555-0142",
  timezone: "America/New_York",
  currentRole: "Founder & Principal Engineer - Infinite Room Labs - 12 years",
  targetTitles: [
    "Staff Engineer",
    "Senior Staff Engineer",
    "Principal Engineer",
    "Platform Lead",
  ],
  compFloor: "$210,000 base",
} as const

/** From `settings.jsx :: SetIntegrations` rows. */
export const SETTINGS_INTEGRATIONS: readonly IntegrationRow[] = [
  {
    name: "Gmail",
    description: "Read confirmations, thread replies, recruiter DMs",
    state: "connected",
    account: "wes.gilleland@gmail.com",
    lastSync: "2m ago",
    icon: "mail",
  },
  {
    name: "Google Calendar",
    description: "Detect interview times, write prep reminders",
    state: "connected",
    lastSync: "14m ago",
    icon: "calendar",
  },
  {
    name: "LinkedIn",
    description: "Import profile, sync saved jobs",
    state: "not-connected",
    icon: "linkedin",
  },
  {
    name: "Greenhouse · Lever · Ashby",
    description: "Auto-detected from URL — no auth needed",
    state: "auto",
    icon: "workflow",
  },
  {
    name: "Calendly",
    description: "Ingest screens auto-booked through your link",
    state: "not-connected",
    icon: "link-2",
  },
  {
    name: "Notion",
    description: "Mirror applications to a database (one-way)",
    state: "not-connected",
    icon: "notebook-text",
  },
]

/** From `settings.jsx :: SetProviders` rows. */
export const SETTINGS_PROVIDERS: readonly ProviderRow[] = [
  {
    provider: "Anthropic",
    model: "claude-sonnet-4, claude-haiku-4-5",
    state: "connected",
    balance: "BYO key · $18.22 since Jan 1",
  },
  {
    provider: "OpenAI",
    model: "gpt-4o, gpt-4o-mini",
    state: "connected",
  },
  {
    provider: "Google",
    model: "gemini-1.5-pro",
    state: "error",
    error: "Last request failed: 401 auth — key may have rotated.",
  },
  {
    provider: "Mistral",
    model: "mistral-large",
    state: "not-connected",
  },
  {
    provider: "Local",
    model: "llama-3-70b via Ollama localhost",
    state: "not-connected",
  },
]

/** From `settings.jsx :: SetProviders :: Routing`. */
export const SETTINGS_ROUTING: readonly RoutingRow[] = [
  {
    label: "Coach chat",
    value: "claude-sonnet-4",
  },
  {
    label: "Résumé tailoring",
    value: "claude-sonnet-4",
  },
  {
    label: "JD parsing",
    value: "gpt-4o-mini",
  },
  {
    label: "Match scoring",
    value: "gemini-1.5-pro",
  },
  {
    label: "Stale / ghost detection",
    value: "claude-haiku-4-5",
  },
]

/** From `settings.jsx :: SetUsage` table. */
export const SETTINGS_USAGE: readonly UsageRow[] = [
  {
    service: "Résumé tailoring",
    model: "anthropic · sonnet-4",
    count: 28,
    tokens: "180k",
    cost: "$1.58",
  },
  {
    service: "Coach chat",
    model: "anthropic · sonnet-4",
    count: 104,
    tokens: "142k",
    cost: "$0.92",
  },
  {
    service: "Match scoring",
    model: "google · gemini-1.5",
    count: 210,
    tokens: "420k",
    cost: "$0.56",
  },
  {
    service: "JD parsing",
    model: "openai · 4o-mini",
    count: 42,
    tokens: "96k",
    cost: "$0.12",
  },
  {
    service: "Stale detector",
    model: "anthropic · haiku-4.5",
    count: 88,
    tokens: "22k",
    cost: "$0.08",
  },
  {
    service: "Ghost detector",
    model: "anthropic · haiku-4.5",
    count: 64,
    tokens: "16k",
    cost: "$0.06",
  },
  {
    service: "Follow-up drafter",
    model: "anthropic · sonnet-4",
    count: 11,
    tokens: "28k",
    cost: "$0.10",
  },
]

/** Monthly spend + cap from `settings.jsx :: SetUsage`. */
export const SETTINGS_USAGE_TOTALS = {
  monthSpend: "$3.42",
  monthlyCap: "$20.00",
} as const

/** D9b: email-parser cap fallback. Default deterministic (no LLM). */
export const SETTINGS_EMAIL_PARSER_FALLBACK: EmailParserFallback = {
  mode: "deterministic",
}

/**
 * D8b: per-task estimated USD cost, used by the cost-preview consent panel.
 * Rough heuristic scores are free and never appear here.
 */
export const LLM_TASK_COST_USD: Readonly<Record<string, number>> = {
  "deep-match-score": 0.14,
  "company-research": 0.62,
  "resume-tailoring": 0.09,
  "coach-chat": 0.05,
}

/** From `settings.jsx :: SetPrivacy`. */
export const SETTINGS_PRIVACY: readonly PrivacyToggle[] = [
  {
    title: "Use coach feedback to improve prompts",
    description: "Anonymized 👍/👎 only — no résumé or email content.",
    on: true,
  },
  {
    title: "Use my résumés to fine-tune models",
    description: "Off by default. Opt-in only.",
    on: false,
  },
  {
    title: "Share anonymous response-rate benchmarks",
    description: 'Helps everyone — "avg reply for role X is Yd".',
    on: true,
  },
  {
    title: "Keep chat logs after 30 days",
    description:
      "We purge threads you delete. This controls passive retention.",
    on: true,
  },
]

/** Plan summary from `settings.jsx :: SetBilling`. */
export const SETTINGS_PLAN = {
  name: "Pro plan",
  price: "$29 / month",
  description: "Unlimited applications · 20 agents · $20 pooled AI credits.",
  nextCharge: "Apr 14 · Visa •• 4242",
} as const

/** From `settings.jsx :: SetBilling` invoice list. */
export const SETTINGS_INVOICES: readonly InvoiceRow[] = [
  {
    date: "Mar 14, 2026",
    description: "Pro subscription",
    amount: "$29.00",
  },
  {
    date: "Feb 14, 2026",
    description: "Pro subscription",
    amount: "$29.00",
  },
  {
    date: "Jan 14, 2026",
    description: "Pro subscription — first month",
    amount: "$29.00",
  },
]

/** From `settings.jsx :: SetDanger`. */
export const SETTINGS_DANGER: readonly DangerAction[] = [
  {
    title: "Archive all applications",
    description: "Hides them from the main view. Recoverable.",
    cta: "Archive",
    danger: false,
  },
  {
    title: "Reset résumé library",
    description:
      "Delete all revisions. Past applications keep their locked copies.",
    cta: "Reset",
    danger: true,
  },
  {
    title: "Delete account",
    description: "Permanent. 30-day grace period before purge.",
    cta: "Delete account",
    danger: true,
  },
]

// ---------------------------------------------------------------------------
// `popovers.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `popovers.jsx :: NotificationsPopover`. Ids synthesized. */
export const NOTIFICATIONS: readonly Notification[] = [
  {
    id: "n1",
    kind: "reply",
    icon: "mail",
    title: "Recruiter reply · Vercel",
    message: '"Would love to chat about comp and start date."',
    actor: "12m",
    unread: true,
  },
  {
    id: "n2",
    kind: "agent",
    icon: "clock-alert",
    title: "Stale-detector flagged Stripe",
    message: "9 days, no response. Coach drafted a follow-up.",
    actor: "1h",
    unread: true,
  },
  {
    id: "n3",
    kind: "agent",
    icon: "message-square-heart",
    title: "Coach drafted a follow-up for Supabase",
    message: "Awaiting your review before you send it.",
    actor: "3h",
    unread: true,
  },
  {
    id: "n4",
    kind: "match",
    icon: "star",
    title: "Match scored: Stripe - Payments core",
    message: "92% against Distributed-systems v4 - the job you just added.",
    actor: "4h",
  },
  {
    id: "n5",
    kind: "cal",
    icon: "calendar",
    title: "Linear screen · Thursday 11 AM",
    message: "Coach prep card is ready.",
    actor: "Yesterday",
  },
  {
    id: "n6",
    kind: "agent",
    icon: "ghost",
    title: "Ghost-detector auto-marked Convex rejected",
    message: "28 days silence. You can undo.",
    actor: "2d",
  },
]

/** From `popovers.jsx :: UserMenuPopover` list rows. */
export const USER_MENU_ROWS: readonly UserMenuRow[] = [
  {
    icon: "settings-2",
    label: "Settings",
    sublabel: "Profile, integrations, AI providers",
  },
  {
    icon: "keyboard",
    label: "Keyboard shortcuts",
    sublabel: "Press ? anywhere",
    meta: "?",
  },
  {
    icon: "sparkles",
    label: "What's new",
    sublabel: "2 unread updates",
    badge: "2",
  },
  {
    icon: "life-buoy",
    label: "Help & support",
    sublabel: "Docs, contact us",
  },
  {
    icon: "gift",
    label: "Refer a friend",
    sublabel: "Get $20 credit each",
  },
]

// ---------------------------------------------------------------------------
// `extension.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** Extension popup states that the design renders. */
export const EXTENSION_STATES: readonly {
  state: ExtensionState
  label: string
}[] = [
  {
    state: "detected",
    label: "On a recognized job posting",
  },
  {
    state: "empty",
    label: "Page isn't a job posting · fallback",
  },
  {
    state: "signed-out",
    label: "First-run · not signed in",
  },
]

/** From `extension.jsx :: ExtEmpty :: Recently captured`. */
export const EXTENSION_RECENT_CAPTURES: readonly ExtensionRecentCapture[] = [
  {
    title: "Linear — Senior Staff",
    detail: "1d",
  },
  {
    title: "Stripe — Payments core",
    detail: "2d",
  },
  {
    title: "Sentry — Ingest",
    detail: "3d",
  },
]

// ---------------------------------------------------------------------------
// `toasts.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `toasts.jsx :: toasts` list. Ids synthesized. */
export const TOAST_VARIANTS: readonly Toast[] = [
  {
    id: "t1",
    kind: "success",
    icon: "check",
    title: "Marked Stripe as APPLIED.",
    subtitle: 'Tailored "Distributed-systems v4" → locked.',
    undo: true,
    time: "5s",
  },
  {
    id: "t2",
    kind: "agent",
    icon: "bot",
    title: "Coach drafted a follow-up for you.",
    subtitle: "Review and send when ready.",
    cta: "Open draft",
    time: "8s",
  },
  {
    id: "t3",
    kind: "success",
    icon: "check",
    title: "Convex marked REJECTED.",
    subtitle: "Ghost-detector · 28d silence.",
    undo: true,
    time: "10s",
  },
  {
    id: "t4",
    kind: "warn",
    icon: "alert-triangle",
    title: "Couldn't fully parse that posting.",
    subtitle: "Fill 2 missing fields to continue.",
    cta: "Review",
    time: "persists",
  },
  {
    id: "t5",
    kind: "error",
    icon: "x",
    title: "Gemini key failed — match scoring paused.",
    subtitle: "Using Anthropic fallback for now.",
    cta: "Fix key",
    time: "persists",
  },
  {
    id: "t6",
    kind: "celebrate",
    icon: "party-popper",
    title: "Offer received from Vercel!",
    subtitle: "$265k base + equity · respond by Apr 19.",
    cta: "Open",
    time: "persists",
  },
]

// ---------------------------------------------------------------------------
// `dashboard.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `dashboard.jsx :: nudges`. */
export const DASHBOARD_NUDGES: readonly DashboardNudge[] = [
  {
    tag: "reply",
    label: "Reply",
    title: "Vercel sent times for the offer call",
    meta: "3 slots this week · coach drafted a yes-and-counter",
    cta: "Send",
    primary: true,
  },
  {
    tag: "stale",
    label: "Stale",
    title: "Stripe — 9 days, no response",
    meta: "Avg reply for this team is 6d · follow-up drafted",
    cta: "Review",
    primary: false,
  },
  {
    tag: "prep",
    label: "Prep",
    title: "Linear screen · Thursday 11:00 AM",
    meta: "12 likely questions · prep doc ready",
    cta: "Open",
    primary: false,
  },
  {
    tag: "offer",
    label: "Offer",
    title: "Vercel — decide by Friday",
    meta: "Counter drafted: $265k → $280k + sign-on",
    cta: "Review",
    primary: true,
  },
]

// ---------------------------------------------------------------------------
// `applications.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** From `applications.jsx :: filters`. */
export const APPLICATION_FILTERS: readonly ApplicationFilter[] = [
  {
    key: "all",
    label: "All",
    count: 14,
  },
  {
    key: "active",
    label: "Active",
    count: 10,
  },
  {
    key: "interview",
    label: "Interviewing",
    count: 5,
  },
  {
    key: "offer",
    label: "Offers",
    count: 1,
  },
  {
    key: "archived",
    label: "Archived",
    count: 4,
  },
  {
    key: "resurrected",
    label: "Resurrected",
    count: 2,
  },
]

/** From `applications.jsx :: KanbanView :: cols`. */
export const KANBAN_COLUMNS: readonly KanbanColumn[] = [
  {
    id: "draft",
    label: "Drafting",
  },
  {
    id: "applied",
    label: "Applied",
  },
  {
    id: "screen",
    label: "Screen",
  },
  {
    id: "interview",
    label: "Interview",
  },
  {
    id: "offer",
    label: "Offer",
  },
  {
    id: "rejected",
    label: "Rejected",
  },
]

/**
 * D16 (DEC-041): the exactly-8 user-chosen outcome reason chips. Used by the
 * withdraw / reject flows. The count is locked at 8 -- a deliberate constraint.
 */
export const REASON_CHIPS_USER: readonly string[] = [
  "Compensation too low",
  "Role not a fit",
  "Accepted another offer",
  "Location / remote mismatch",
  "Company / culture concerns",
  "Process too slow",
  "Scope / seniority mismatch",
  "Changed my mind",
]

/**
 * D16: system-applied reason chips -- a SEPARATE tier, never counted in the
 * user 8. Surfaced read-only (e.g. auto-excluded by a search rule).
 */
export const REASON_CHIPS_SYSTEM: readonly string[] = [
  "Auto-excluded by search rule",
  "Posting removed by employer",
  "Ghosted (no response)",
]

// ---------------------------------------------------------------------------
// `onboarding.jsx` inline fixtures
// ---------------------------------------------------------------------------

/** Onboarding "what's your situation?" intent options. Feeds coach tone. */
export const ONBOARDING_STANCES: readonly OnboardingStance[] = [
  {
    key: "exploring",
    icon: "eye",
    title: "Employed, exploring",
    description: "Happy where I am, but open to the right move.",
  },
  {
    key: "searching",
    icon: "target",
    title: "Actively searching",
    description: "I know what I want. Help me run it like a project.",
  },
  {
    key: "urgent",
    icon: "siren",
    title: "Need work in under 30 days",
    description: "Short runway. Help me move fast.",
  },
  {
    key: "change",
    icon: "refresh-cw",
    title: "Career change",
    description: "New industry / role. Help me figure out the story.",
  },
]

/** Onboarding power-up cards. All optional, set up now or later in Settings. */
export const ONBOARDING_INTEGRATIONS: readonly OnboardingIntegration[] = [
  {
    icon: "key",
    name: "Bring your own AI key",
    description:
      "Use your own OpenAI / Anthropic / Google key and your AI runs on your account. Otherwise we cover it from your monthly credits.",
  },
  {
    icon: "mail",
    name: "Email forward-to-parse",
    description:
      "Forward any recruiter email or job posting and we parse it. We never read your inbox.",
  },
  {
    icon: "puzzle",
    name: "Browser extension",
    description:
      "One click to capture any job page (including hiring.cafe) straight into Employa-Bot.",
  },
]

/** Onboarding background crew toggles. All on, opt-in and revocable. */
export const ONBOARDING_AGENTS: readonly OnboardingAgent[] = [
  {
    name: "Stale-detector",
    description: "Flags applications past usual response time",
    on: true,
  },
  {
    name: "Ghost-detector",
    description: "Auto-marks rejected after long silence",
    on: true,
  },
  {
    name: "Coach",
    description: "Drafts follow-ups, prepares interview answers",
    on: true,
  },
]

// ===========================================================================
// Per-search shortlist / inbox / applications fixtures
// ---------------------------------------------------------------------------
// The canonical `SHORTLIST_DATA` / `JOBS_INBOX` / `APPS` ship the primary
// platform-search data. The backend (fintech) and AI-infra searches get
// distinct fixtures here so `/searches/<uuid>/{shortlist,inbox,applications}`
// renders unique content per saved search.
// ===========================================================================

/** Primary platform search shortlist - alias of the canonical fixture. */
export const SHORTLIST_PLATFORM = SHORTLIST_DATA

/** Backend (fintech) search shortlist. */
export const SHORTLIST_BACKEND: readonly ShortlistEntry[] = [
  {
    company: "Wise",
    role: "Staff Engineer - Money movement",
    location: "Remote - US",
    compensation: "$240-300k",
    match: 90,
    saved: "today",
    source: "you",
    why: "Cross-border payment rails at scale - matches your multi-region ledger work.",
  },
  {
    company: "Adyen",
    role: "Senior Staff Engineer - Ledger",
    location: "Remote - US/EU",
    compensation: "$250-320k",
    match: 87,
    saved: "Yesterday",
    source: "you",
    why: "Double-entry ledger at high throughput - your exactly-once semantics work lines up.",
  },
  {
    company: "Marqeta",
    role: "Principal Engineer - Issuing",
    location: "Remote - US",
    compensation: "$255-315k",
    match: 84,
    saved: "2d ago",
    source: "you",
    why: "You flagged this after a card-issuing architecture thread on HN.",
  },
  {
    company: "Modern Treasury",
    role: "Staff Engineer - Payments API",
    location: "Remote - US",
    compensation: "$230-290k",
    match: 80,
    saved: "4d ago",
    source: "you",
  },
]

/** AI-infra search shortlist (paused, thin). */
export const SHORTLIST_AI_INFRA: readonly ShortlistEntry[] = [
  {
    company: "Anthropic",
    role: "Senior Staff - Inference",
    location: "Remote - US",
    compensation: "$320-400k + equity",
    match: 88,
    saved: "1w ago",
    source: "you",
    why: "Inference-serving at scale - matches your latency-critical pipeline work.",
  },
  {
    company: "Replicate",
    role: "Staff Engineer - API",
    location: "Remote - global",
    compensation: "$230-285k",
    match: 81,
    saved: "1w ago",
    source: "you",
  },
]

/** Primary platform search jobs inbox - alias of the canonical fixture. */
export const INBOX_PLATFORM = JOBS_INBOX

/** Backend (fintech) search jobs inbox. */
export const INBOX_BACKEND: readonly JobInboxItem[] = [
  {
    company: "Wise",
    role: "Staff Engineer - Money movement",
    location: "Remote - US",
    compensation: "$240-300k",
    match: 90,
    source: "greenhouse",
    isNew: true,
    posted: "1d ago",
  },
  {
    company: "Adyen",
    role: "Senior Staff Engineer - Ledger",
    location: "Remote - US/EU",
    compensation: "$250-320k",
    match: 87,
    source: "ashby",
    isNew: true,
    posted: "2d ago",
  },
  {
    company: "Column",
    role: "Staff Engineer - Core banking API",
    location: "Remote - US",
    compensation: "$245-310k",
    match: 89,
    source: "lever",
    isNew: true,
    posted: "2d ago",
  },
  {
    company: "Increase",
    role: "Staff Engineer - Payments",
    location: "Remote - US",
    compensation: "$235-295k",
    match: 82,
    source: "greenhouse",
    posted: "4d ago",
  },
  {
    company: "Unit",
    role: "Senior Staff - Banking platform",
    location: "Remote - US",
    compensation: "$230-285k",
    match: 78,
    source: "lever",
    posted: "5d ago",
  },
  {
    company: "Marqeta",
    role: "Principal Engineer - Issuing",
    location: "Remote - US",
    compensation: "$255-315k",
    match: 75,
    source: "workable",
    posted: "1w ago",
  },
]

/** AI-infra search jobs inbox (paused, thin). */
export const INBOX_AI_INFRA: readonly JobInboxItem[] = [
  {
    company: "Together AI",
    role: "Staff Engineer - Inference platform",
    location: "Remote - US",
    compensation: "$250-320k",
    match: 84,
    source: "ashby",
    isNew: true,
    posted: "3d ago",
  },
  {
    company: "Fireworks AI",
    role: "Staff Engineer - Serving",
    location: "Remote - global",
    compensation: "$240-300k",
    match: 79,
    source: "greenhouse",
    posted: "6d ago",
  },
]

/** Backend (fintech) search applications. */
const APPS_BACKEND_SEED: readonly ApplicationSeed[] = [
  {
    id: "be-wise",
    company: "Wise",
    role: "Staff Engineer, Money movement",
    stage: "screen",
    stageLabel: "phone screen - Mon 14:00",
    location: "Remote - US",
    salary: { min: 240000, max: 300000, extra: [] },
    resume: "Distributed-systems v4",
    match: 90,
    days: 5,
    source: "greenhouse",
    contact: "Dev Anand",
  },
  {
    id: "be-adyen",
    company: "Adyen",
    role: "Senior Staff Engineer, Ledger",
    stage: "applied",
    stageLabel: "applied - 2d",
    location: "Remote - US",
    salary: { min: 250000, max: 320000, extra: [] },
    resume: "Distributed-systems v4",
    match: 87,
    days: 2,
    source: "ashby",
  },
  {
    id: "be-column",
    company: "Column",
    role: "Staff Engineer, Core banking API",
    stage: "interview",
    stageLabel: "onsite - Thu",
    location: "Remote - US",
    salary: { min: 245000, max: 310000, extra: [] },
    resume: "Distributed-systems v4",
    match: 89,
    days: 11,
    source: "lever",
    coachNudge: true,
  },
]

/** AI-infra search applications (paused, thin). */
const APPS_AI_INFRA_SEED: readonly ApplicationSeed[] = [
  {
    id: "ai-baseten",
    company: "Baseten",
    role: "Staff Engineer, Model serving",
    stage: "applied",
    stageLabel: "applied - 4d",
    location: "Remote - US",
    salary: { min: 230000, max: 290000, extra: [] },
    resume: "Distributed-systems v4",
    match: 83,
    days: 4,
    source: "ashby",
  },
]

/** Index per search UUID for the swap-seam in `data/api.ts`. */
export const SHORTLIST_BY_SEARCH: Readonly<
  Record<string, readonly ShortlistEntry[]>
> = {
  [SEARCH_ID_PLATFORM]: SHORTLIST_PLATFORM,
  [SEARCH_ID_BACKEND]: SHORTLIST_BACKEND,
  [SEARCH_ID_AI_INFRA]: SHORTLIST_AI_INFRA,
}

export const INBOX_BY_SEARCH: Readonly<
  Record<string, readonly JobInboxItem[]>
> = {
  [SEARCH_ID_PLATFORM]: INBOX_PLATFORM,
  [SEARCH_ID_BACKEND]: INBOX_BACKEND,
  [SEARCH_ID_AI_INFRA]: INBOX_AI_INFRA,
}

// ===========================================================================
// Budget helpers (CTX-105)
// ---------------------------------------------------------------------------
// Derived from SETTINGS_USAGE_TOTALS so sidebar and settings share one source.
// ===========================================================================

export const BUDGET_USED = parseFloat(
  SETTINGS_USAGE_TOTALS.monthSpend.replace("$", ""),
)
export const BUDGET_TOTAL = parseFloat(
  SETTINGS_USAGE_TOTALS.monthlyCap.replace("$", ""),
)

// ===========================================================================
// Usage meta (CTX-108)
// ---------------------------------------------------------------------------
// Token counts displayed in the AI usage panel. Kept here rather than
// hard-coded in usage-panel.tsx so derived tiles stay consistent.
// ===========================================================================

export const SETTINGS_USAGE_META = {
  tokensIn: "412k",
  tokensOut: "88k",
  avgPerSession: "2.4k",
} as const

// ===========================================================================
// Settings -- new fields for AUTH-024, AUTH-025, AUTH-031
// ===========================================================================

export const SETTINGS_PRIVACY_LAST_UPDATED = "May 15, 2026"

export const SETTINGS_NOTIFICATION_PREFS: readonly NotifPref[] = [
  {
    id: "transactional-security",
    category: "Transactional / security",
    emailEnabled: true,
    inAppEnabled: true,
    emailLocked: true,
    consequence:
      "Required system emails (password resets, billing receipts) cannot be disabled.",
  },
  {
    id: "agent-approval",
    category: "Agent approval / proposed transitions",
    emailEnabled: true,
    inAppEnabled: true,
    consequence:
      "You will stop receiving alerts when agents queue actions for your review.",
  },
  {
    id: "coach-prompts",
    category: "Coach prompts",
    emailEnabled: false,
    inAppEnabled: true,
  },
  {
    id: "monthly-digest",
    category: "Monthly digest",
    emailEnabled: true,
    inAppEnabled: false,
  },
  {
    id: "dead-month-checkin",
    category: "Dead-month check-in",
    emailEnabled: true,
    inAppEnabled: false,
    consequence:
      "A low-pressure nudge sent only in a month with no activity (never alongside the digest). Surfaces one concrete next step; turn it off anytime. (D5)",
  },
  {
    id: "stale-ghost-nudges",
    category: "Stale / ghost nudges",
    emailEnabled: true,
    inAppEnabled: true,
    consequence:
      "You will no longer be notified when applications go stale or are auto-rejected.",
  },
]

export const SETTINGS_EXTENSION_TOKENS: readonly ExtensionToken[] = [
  {
    id: "tok-001",
    label: "Browser extension",
    createdAt: "May 1, 2026",
  },
]

// ===========================================================================
// Interview rounds (TRK-117)
// ===========================================================================

export const INTERVIEW_ROUNDS: readonly InterviewRound[] = [
  // Stripe (stage=applied, coachNudge=true) -- 2 rounds showing past and upcoming
  {
    id: "ir-stripe-1",
    appId: "stripe",
    date: "Mar 14, 2026",
    type: "recruiter-screen",
    format: "phone",
    status: "completed",
  },
  {
    id: "ir-stripe-2",
    appId: "stripe",
    date: "Mar 21, 2026",
    type: "technical",
    format: "video",
    status: "scheduled",
  },
  // PlanetScale (stage=interview) -- onsite scheduled
  {
    id: "ir-planetscale-1",
    appId: "planetscale",
    date: "Mar 18, 2026",
    type: "recruiter-screen",
    format: "phone",
    status: "completed",
  },
  {
    id: "ir-planetscale-2",
    appId: "planetscale",
    date: "Thu, Mar 20",
    type: "onsite",
    format: "onsite",
    status: "scheduled",
  },
  // Sentry (stage=interview) -- technical scheduled
  {
    id: "ir-sentry-1",
    appId: "sentry",
    date: "Mar 10, 2026",
    type: "recruiter-screen",
    format: "phone",
    status: "completed",
  },
  {
    id: "ir-sentry-2",
    appId: "sentry",
    date: "Mar 17, 2026 - Mon",
    type: "technical",
    format: "video",
    status: "scheduled",
  },
  // Linear (stage=screen) -- recruiter screen scheduled
  {
    id: "ir-linear-1",
    appId: "linear",
    date: "Thu, Mar 20 - 11:00 AM",
    type: "recruiter-screen",
    format: "phone",
    status: "scheduled",
  },
  // Column (be-column, BACKEND search interview) -- onsite scheduled
  {
    id: "ir-be-column-1",
    appId: "be-column",
    date: "Mar 12, 2026",
    type: "recruiter-screen",
    format: "video",
    status: "completed",
  },
  {
    id: "ir-be-column-2",
    appId: "be-column",
    date: "Thu, Mar 20",
    type: "onsite",
    format: "onsite",
    status: "scheduled",
  },
]

// ===========================================================================
// Timeline events by application (TRK-118)
// ===========================================================================

export const TIMELINE_BY_APP: Readonly<
  Record<string, readonly TimelineEvent[]>
> = {
  stripe: [
    {
      id: "tl-stripe-1",
      time: "Jan 22",
      who: "You",
      message: "Applied via Greenhouse",
    },
    {
      id: "tl-stripe-2",
      time: "Jan 28",
      who: "Stale-detector",
      message: "Flagged as stale (9d, median 6d)",
      badge: "stale",
    },
    {
      id: "tl-stripe-3",
      time: "Jan 29",
      who: "Coach",
      message: "Drafted follow-up email",
    },
    {
      id: "tl-stripe-4",
      time: "Jan 30",
      who: "You",
      message: "Sent follow-up to Maya Kapoor",
    },
  ],
  linear: [
    {
      id: "tl-linear-1",
      time: "Mar 14",
      who: "You",
      message: "Applied via Ashby",
    },
    {
      id: "tl-linear-2",
      time: "Mar 15",
      who: "Linear recruiting",
      message: "Recruiter screen scheduled - Thu 11:00 AM",
    },
  ],
  supabase: [
    {
      id: "tl-supabase-1",
      time: "Mar 19",
      who: "You",
      message: "Applied via Greenhouse",
    },
  ],
  planetscale: [
    {
      id: "tl-planetscale-1",
      time: "Mar 7",
      who: "You",
      message: "Applied via Ashby",
    },
    {
      id: "tl-planetscale-2",
      time: "Mar 12",
      who: "PlanetScale recruiting",
      message: "Phone screen scheduled",
    },
    {
      id: "tl-planetscale-3",
      time: "Mar 18",
      who: "You",
      message: "Completed phone screen",
    },
  ],
  sentry: [
    {
      id: "tl-sentry-1",
      time: "Mar 10",
      who: "You",
      message: "Applied via Greenhouse",
    },
    {
      id: "tl-sentry-2",
      time: "Mar 10",
      who: "You",
      message: "Tailored Distributed-systems v4 as the basis resume",
    },
    {
      id: "tl-sentry-3",
      time: "Mar 12",
      who: "Dana Okafor",
      message: "Hiring manager scheduled technical round",
    },
  ],
  "be-column": [
    {
      id: "tl-be-column-1",
      time: "Mar 1",
      who: "You",
      message: "Applied via Ashby",
    },
    {
      id: "tl-be-column-2",
      time: "Mar 5",
      who: "Column recruiting",
      message: "Recruiter screen scheduled",
    },
    {
      id: "tl-be-column-3",
      time: "Mar 12",
      who: "You",
      message: "Completed recruiter screen",
    },
    {
      id: "tl-be-column-4",
      time: "Mar 14",
      who: "Column",
      message: "Onsite interview scheduled - Thu",
    },
  ],
}

// ===========================================================================
// Per-agent permissions (AGT-023)
// ===========================================================================

export const PER_AGENT_PERMISSIONS: Readonly<
  Record<string, readonly AgentPermission[]>
> = {
  stale: [
    {
      permission: "Read application stage",
      granted: true,
    },
    {
      permission: "Write follow-up draft",
      granted: true,
    },
    {
      permission: "Auto-send follow-ups",
      granted: false,
    },
    {
      permission: "Mark applications rejected",
      granted: false,
    },
  ],
  ghost: [
    {
      permission: "Read application stage",
      granted: true,
    },
    {
      permission: "Write follow-up draft",
      granted: false,
    },
    {
      permission: "Auto-send follow-ups",
      granted: false,
    },
    {
      permission: "Mark applications rejected",
      granted: true,
    },
  ],
  coach: [
    {
      permission: "Read application stage",
      granted: true,
    },
    {
      permission: "Write follow-up draft",
      granted: true,
    },
    {
      permission: "Auto-send follow-ups",
      granted: false,
    },
    {
      permission: "Mark applications rejected",
      granted: false,
    },
  ],
}

// ===========================================================================
// Per-thread coach context cards (COA-021)
// ===========================================================================

export const COACH_CONTEXT_BY_THREAD: Readonly<
  Record<string, readonly ContextCard[]>
> = {
  "stripe-followup": [
    {
      label: "Application",
      body: "Stripe - Staff Engineer, Payments core - applied 9d ago - stale",
    },
    {
      label: "Resume attached",
      body: "Distributed-systems v4",
    },
    {
      label: "JD excerpt",
      body: "Build and own payment-path services at scale. Idempotency, ledgering, multi-region. 8+ years backend, distributed systems required...",
    },
    {
      label: "Prior threads",
      body: '"Tailor for Stripe" - Feb 28',
    },
  ],
  "linear-prep": [
    {
      label: "Application",
      body: "Linear - Senior Staff Engineer, Platform - recruiter screen Thu 11:00",
    },
    {
      label: "Resume attached",
      body: "Distributed-systems v4",
    },
    {
      label: "Interview type",
      body: "Recruiter screen - 30 min - with Sara Lim, recruiting",
    },
  ],
  "vercel-counter": [
    {
      label: "Application",
      body: "Vercel - Staff Engineer, Edge runtime - offer received",
    },
    {
      label: "Offer details",
      body: "$265k base + 0.4% equity - decide by Friday",
    },
    {
      label: "Counter target",
      body: "$285k base + larger equity grant - coach drafted",
    },
  ],
  "supabase-tailor": [
    {
      label: "Application",
      body: "Supabase - Principal Engineer, Realtime - applied 3d ago",
    },
    {
      label: "Resume basis",
      body: "Platform / infra v2",
    },
    {
      label: "Tailoring goal",
      body: "Surface realtime / streaming systems work, downplay product-side scope",
    },
  ],
  general: [
    {
      label: "Context",
      body: "General strategy session - no specific application",
    },
    {
      label: "Active searches",
      body: "Staff / Principal - Platform - remote (62 days running)",
    },
  ],
}

// ===========================================================================
// Archive pool (ORI-009) -- SEPARATE from the active pipeline. These apps
// carry an `outcome` field and are NEVER included in _apps / APPS.
// 1 won + 14 rejected|withdrawn = 15 entries total.
// ===========================================================================

const ARCHIVE_APPS_SEED: readonly ApplicationSeed[] = [
  {
    id: "arc-won-01",
    company: "Datadog",
    role: "Staff Engineer, Platform",
    stage: "offer",
    stageLabel: "offer accepted",
    location: "Remote - US",
    salary: { value: 258000, extra: ["+ equity"] },
    resume: "Distributed-systems v4",
    match: 93,
    days: 34,
    source: "greenhouse",
    contact: "Priya Nair",
    outcome: "won",
    outcomeAt: "2024-11-15",
  },
  {
    id: "arc-rej-01",
    company: "Airbnb",
    role: "Staff Engineer, Payments",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 245000, max: 295000, extra: [] },
    resume: "Distributed-systems v4",
    match: 81,
    days: 22,
    source: "greenhouse",
    outcome: "rejected",
    outcomeAt: "2024-10-02",
    outcomeReason: "Position filled",
  },
  {
    id: "arc-rej-02",
    company: "Notion",
    role: "Senior Staff Engineer, Platform",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 230000, max: 280000, extra: [] },
    resume: "Master v4",
    match: 74,
    days: 18,
    source: "lever",
    outcome: "rejected",
    outcomeAt: "2024-09-14",
    outcomeReason: "Comp below range",
  },
  {
    id: "arc-rej-03",
    company: "Figma",
    role: "Principal Engineer, Realtime",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 260000, max: 310000, extra: [] },
    resume: "Platform / infra v2",
    match: 88,
    days: 28,
    source: "ashby",
    outcome: "rejected",
    outcomeAt: "2024-08-30",
    outcomeReason: "Selected internal candidate",
  },
  {
    id: "arc-wdr-01",
    company: "Retool",
    role: "Staff Engineer, Growth",
    stage: "closed",
    stageLabel: "withdrawn",
    location: "Remote - US",
    salary: { min: 210000, max: 255000, extra: [] },
    resume: "Master v4",
    match: 69,
    days: 10,
    source: "workday",
    outcome: "withdrawn",
    outcomeAt: "2024-08-12",
    outcomeReason: "Withdrew - accepted other offer",
  },
  {
    id: "arc-rej-04",
    company: "Ramp",
    role: "Staff Engineer, Infra",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 240000, max: 290000, extra: [] },
    resume: "Distributed-systems v4",
    match: 76,
    days: 31,
    source: "recruiter",
    outcome: "rejected",
    outcomeAt: "2024-07-22",
    outcomeReason: "Position filled",
  },
  {
    id: "arc-rej-05",
    company: "Brex",
    role: "Principal Engineer, API",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US/EU",
    salary: { min: 255000, max: 305000, extra: [] },
    resume: "Master v4",
    match: 83,
    days: 15,
    source: "ashby",
    outcome: "rejected",
    outcomeAt: "2024-07-08",
  },
  {
    id: "arc-wdr-02",
    company: "Mercury",
    role: "Senior Staff Engineer, Platform",
    stage: "closed",
    stageLabel: "withdrawn",
    location: "Remote - global",
    salary: { min: 220000, max: 265000, extra: [] },
    resume: "Platform / infra v2",
    match: 65,
    days: 8,
    source: "lever",
    outcome: "withdrawn",
    outcomeAt: "2024-06-25",
    outcomeReason: "Title was a step back",
  },
  {
    id: "arc-rej-06",
    company: "Plaid",
    role: "Staff Engineer, Data",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 245000, max: 295000, extra: [] },
    resume: "Distributed-systems v4",
    match: 79,
    days: 19,
    source: "greenhouse",
    outcome: "rejected",
    outcomeAt: "2024-06-10",
    outcomeReason: "Comp below range",
  },
  {
    id: "arc-rej-07",
    company: "Databricks",
    role: "Principal Engineer, Storage",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 270000, max: 320000, extra: [] },
    resume: "Master v4",
    match: 71,
    days: 12,
    source: "workday",
    outcome: "rejected",
    outcomeAt: "2024-05-29",
  },
  {
    id: "arc-wdr-03",
    company: "Snowflake",
    role: "Staff Engineer, Data",
    stage: "closed",
    stageLabel: "withdrawn",
    location: "Remote - US",
    salary: {
      value: 268000,
      extra: ["+ equity"],
    },
    resume: "Platform / infra v2",
    match: 61,
    days: 5,
    source: "recruiter",
    outcome: "withdrawn",
    outcomeAt: "2024-05-14",
    outcomeReason: "Role not fully remote",
  },
  {
    id: "arc-rej-08",
    company: "Confluent",
    role: "Senior Staff Engineer, Infra",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: {
      min: 255000,
      max: 305000,
      extra: [],
    },
    resume: "Distributed-systems v4",
    match: 87,
    days: 24,
    source: "greenhouse",
    outcome: "rejected",
    outcomeAt: "2024-04-30",
    outcomeReason: "Failed system-design round",
  },
  {
    id: "arc-rej-09",
    company: "Elastic",
    role: "Principal Engineer, Search",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US/EU",
    salary: {
      min: 240000,
      max: 290000,
      extra: [],
    },
    resume: "Platform / infra v2",
    match: 80,
    days: 17,
    source: "lever",
    outcome: "rejected",
    outcomeAt: "2024-04-11",
  },
  {
    id: "arc-rej-10",
    company: "GitLab",
    role: "Staff Engineer, Platform",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - global",
    salary: { min: 215000, max: 265000, extra: [] },
    resume: "Master v4",
    match: 73,
    days: 20,
    source: "indeed",
    outcome: "rejected",
    outcomeAt: "2024-03-28",
    outcomeReason: "Role re-scoped to EM",
  },
  {
    id: "arc-rej-11",
    company: "HashiCorp",
    role: "Senior Staff Engineer, Platform",
    stage: "rejected",
    stageLabel: "rejected",
    location: "Remote - US",
    salary: { min: 230000, max: 280000, extra: [] },
    resume: "Distributed-systems v4",
    match: 68,
    days: 26,
    source: "ashby",
    outcome: "rejected",
    outcomeAt: "2024-03-05",
    outcomeReason: "Selected internal candidate",
  },
]

// ===========================================================================
// Blank criteria seed (ADD-010) for new search creation
// ===========================================================================

export const BLANK_CRITERIA: SearchCriteria = {
  titlesInclude: [],
  titlesExclude: [],
  locations: [],
  remotePolicy: "Hybrid OK",
  maxCommuteMin: 45,
  baseFloor: "$0",
  baseCeiling: "$0",
  yearsExperience: "0",
}

// ===========================================================================
// Application normalization (ADR-006 stage 3)
// ---------------------------------------------------------------------------
// Each seed is split into a Job (the posting) + an ids-only Application that
// references it. App + job ids are session-stable UUIDs (regenerated on reload,
// like the other mock state). The api joins them back into an ApplicationView.
// ===========================================================================

/**
 * Deterministic UUID-shaped id from a slug, so application/job ids are stable
 * across reloads (links + deep-links keep resolving) while reading like real
 * UUIDs in the URL. Not cryptographic -- a seeded rolling hash is plenty for a
 * mockup. `salt` distinguishes an application id from its job id.
 */
function slugToUuid(slug: string, salt = ""): string {
  const input = `${slug}:${salt}:employa`
  let hex = ""
  let accumulator = 0x811c9dc5
  for (let position = 0; position < 32; position++) {
    const code = input.charCodeAt(position % input.length) + position * 131
    accumulator = (accumulator ^ code) * 0x01000193
    hex += (((accumulator >>> 8) & 0xf) ^ (code & 0xf)).toString(16)
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-")
}

/** Resolve a seed resume label to a Resume id by name-prefix match. */
function resumeIdForLabel(label: string): string | null {
  const match = RESUMES.find((resume) => label.startsWith(resume.name))
  return match ? match.id : null
}

function jobFromSeed(seed: ApplicationSeed, jobId: string): Job {
  return {
    id: jobId,
    company: seed.company,
    title: seed.role,
    location: {
      raw: seed.location,
    },
    workMode: "onsite",
    employment: W2_SALARY_FT,
    compensation: seed.salary,
    source: {
      board: seed.source,
      channel: "url",
      capturedAt: "captured when you applied",
    },
    posted: `${seed.days}d ago`,
    match: {
      score: seed.match,
      strengths: [],
      gaps: [],
    },
  }
}

const _applicationJobs: Job[] = []
const _applicationSlugByUuid: Record<string, string> = {}

const _applicationUuidBySlug: Record<string, string> = {}

function normalizeApplicationPool(
  seeds: readonly ApplicationSeed[],
): Application[] {
  return seeds.map((seed) => {
    const applicationId = slugToUuid(seed.id, "app")
    const jobId = slugToUuid(seed.id, "job")
    _applicationSlugByUuid[applicationId] = seed.id
    _applicationUuidBySlug[seed.id] = applicationId
    _applicationJobs.push(jobFromSeed(seed, jobId))
    return {
      id: applicationId,
      jobId,
      resumeId: resumeIdForLabel(seed.resume),
      stage: seed.stage,
      stageLabel: seed.stageLabel,
      days: seed.days,
      flag: seed.flag,
      contact: seed.contact,
      coachNudge: seed.coachNudge,
      resurrected: seed.resurrected,
      outcome: seed.outcome,
      outcomeAt: seed.outcomeAt,
      outcomeReason: seed.outcomeReason,
    }
  })
}

export const APPS: readonly Application[] = normalizeApplicationPool(APPS_SEED)
export const APPS_BACKEND: readonly Application[] =
  normalizeApplicationPool(APPS_BACKEND_SEED)
export const APPS_AI_INFRA: readonly Application[] =
  normalizeApplicationPool(APPS_AI_INFRA_SEED)
export const ARCHIVE_APPS: readonly Application[] =
  normalizeApplicationPool(ARCHIVE_APPS_SEED)

/** Platform-search applications -- alias of the canonical fixture. */
export const APPS_PLATFORM = APPS

/** Jobs derived from applications (one per application). */
export const APPLICATION_JOBS: readonly Job[] = _applicationJobs

/** uuid -> original slug, so the api can resolve slug-keyed cross-ref fixtures
 *  (TIMELINE_BY_APP, INTERVIEW_ROUNDS) from a UUID application id. */
export const APP_SLUG_BY_UUID: Readonly<Record<string, string>> =
  _applicationSlugByUuid

/** slug -> uuid, so seed-slug references (tests, hardcoded demo links) resolve. */
export const APP_UUID_BY_SLUG: Readonly<Record<string, string>> =
  _applicationUuidBySlug

/** Merged posting lookup: inbox/search postings + application postings. */
export const JOBS_BY_ID: Readonly<Record<string, Job>> = {
  ...INBOX_JOBS_BY_ID,
  ...Object.fromEntries(_applicationJobs.map((job) => [job.id, job])),
}

export const APPS_BY_SEARCH: Readonly<Record<string, readonly Application[]>> =
  {
    [SEARCH_ID_PLATFORM]: APPS_PLATFORM,
    [SEARCH_ID_BACKEND]: APPS_BACKEND,
    [SEARCH_ID_AI_INFRA]: APPS_AI_INFRA,
  }

/**
 * Join an Application to its Job + Resume, flattening the display fields onto
 * the view (the api `?expand=job,resume` read model). `jobLookup` lets the api
 * include dynamically-created postings (createApplication) in the resolution.
 */
export function applicationView(
  application: Application,
  jobLookup: Readonly<Record<string, Job>> = JOBS_BY_ID,
): ApplicationView {
  const job: Job = jobLookup[application.jobId] ?? JOBS_BY_ID[application.jobId]
  let resume: Resume | null
  if (application.resumeId) {
    resume =
      RESUMES.find((candidate) => candidate.id === application.resumeId) ?? null
  } else {
    resume = null
  }
  return {
    ...application,
    job,
    resume,
    company: job.company,
    role: job.title,
    location: job.location.raw,
    salary: job.compensation,
    match: job.match?.score ?? 0,
    source: job.source.board,
    resumeName: resume ? resume.name : "No resume selected",
  }
}
