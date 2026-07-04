/**
 * Canonical domain types derived from `/tmp/employa-design/src/data.jsx` and
 * inline screen-local fake data. Field names are VERBATIM from the source zip;
 * do not rename. If a property isn't in the zip, it doesn't exist here.
 *
 * Discriminated unions are derived from the literal values that appear in
 * the source data, including `app_detail.jsx`'s stage tracker which defines
 * stages beyond those represented in APPS.
 */

// ---------------------------------------------------------------------------
// User / persona
// ---------------------------------------------------------------------------

/** From `data.jsx :: REMY`. */
export interface User {
  name: string
  email: string
  initials: string
  city: string
  current: string
  years: number
  comp_floor: number
  target_titles: string[]
}

// ---------------------------------------------------------------------------
// Applications (`APPS`)
// ---------------------------------------------------------------------------

/**
 * Application stage union. Drawn from `APPS` values plus the full tracker in
 * `app_detail.jsx :: StageTrackerInteractive` and `applications.jsx :: KanbanView`.
 */
export type Stage =
  | "saved"
  | "draft"
  | "applied"
  | "screen"
  | "interview"
  | "offer"
  | "rejected"
  | "closed"

/** Application flag (e.g. row badges). From `APPS[].flag`. */
export type ApplicationFlag = "stale" | "offer"

/**
 * Application source — the original ATS / origin board. Historic values
 * come from `APPS[].source`; widened to `string` so per-search fixtures
 * (remote-IC, platform-swe, etc.) can ship vendor-specific origins
 * like `lever`, `linkedin`, `greenhouse-api` without churning the union.
 */
export type ApplicationSource =
  | "greenhouse"
  | "workday"
  | "recruiter"
  | "ashby"
  | "hospital-direct"
  | "usajobs"
  | "indeed"
  | (string & {})

/** A single compensation figure (full dollars), plus non-numeric qualifiers. */
export interface SalaryPoint {
  value: number
  extra: string[]
}

/** A compensation band (full dollars), plus non-numeric qualifiers. */
export interface SalaryRange {
  min: number
  max: number
  extra: string[]
}

/**
 * Structured compensation. Stored as integers and formatted on display via
 * `formatSalary()` (src/lib/salary.ts) -- never pre-formatted in fixtures.
 * `extra` holds qualifiers we never sort on (e.g. "+ 15% bonus", "GS-14", "/hr").
 * `null` means undisclosed.
 */
export type Salary = SalaryPoint | SalaryRange

/**
 * Stored application record (ADR-006 stage 3). Fully normalized: it references
 * the posting (`jobId`) and the submitted resume (`resumeId`) by id and carries
 * only its own lifecycle. Company/role/location/compensation/match all live on
 * the referenced Job and are resolved at the api boundary (see ApplicationView).
 */
export interface Application {
  id: string
  /** The posting this application is for (FK -> Job.id). */
  jobId: string
  /** The resume submitted/selected (FK -> Resume.id); null when none yet. */
  resumeId: string | null
  stage: Stage
  stageLabel: string
  days: number
  flag?: ApplicationFlag
  contact?: string
  coachNudge?: boolean
  resurrected?: boolean
  /** ORI-009: archive outcome. Present only on ARCHIVE_APPS entries. */
  outcome?: "won" | "rejected" | "withdrawn"
  /** ORI-009: ISO-8601 date string when the outcome was recorded. */
  outcomeAt?: string
  /** ORI-009: human-readable reason for a rejected/withdrawn outcome. */
  outcomeReason?: string
  /**
   * D10: FK -> ResumeSnapshot.id. Set when the application reaches APPLIED -- the
   * immutable copy of the resume that was actually submitted. The editable master
   * (resumeId) may drift afterward; this never does.
   */
  submittedSnapshotId?: string
  /** D15: the saved search this application belongs to (FK -> Search.id; non-null in practice). */
  searchId?: string
  /** D16: user-chosen outcome reason chips (drawn from REASON_CHIPS_USER, max 8). */
  outcomeReasons?: readonly string[]
  /** D16: system-applied reason chips -- a separate tier, NOT counted in the user 8. */
  systemReasons?: readonly string[]
}

/**
 * Read model returned by the api -- an Application joined with its Job and
 * Resume (the equivalent of `GET /applications/{id}?expand=job,resume`). The
 * job's display fields are flattened onto the view so screens read them
 * directly (`view.company`) while the stored record holds only ids.
 */
export interface ApplicationView extends Application {
  /** The resolved posting. */
  job: Job
  /** The resolved resume, or null when none is attached. */
  resume: Resume | null
  // Flattened display fields (derived from `job`).
  company: string
  role: string
  location: string
  salary: Salary | null
  match: number
  source: ApplicationSource
  /** Display name of the attached resume (or a placeholder). */
  resumeName: string
}

// ---------------------------------------------------------------------------
// Shortlist (`SHORTLIST_DATA`)
// ---------------------------------------------------------------------------

/** Shortlist source attribution. Every shortlist entry is user-saved. */
export type ShortlistSource = "you"

/** From `data.jsx :: SHORTLIST_DATA`. */
export interface ShortlistEntry {
  /** Reference to the underlying Job posting (ADR-006). Drives row -> /jobs/:id. */
  jobId?: string
  company: string
  role: string
  location: string
  compensation: string
  match: number
  saved: string
  source: ShortlistSource
  why?: string
  stale?: boolean
}

// ---------------------------------------------------------------------------
// Jobs inbox (`JOBS_INBOX`)
// ---------------------------------------------------------------------------

/**
 * Inbox source — distinct from `ApplicationSource`. Uses `hospital` (not
 * `hospital-direct`). Historic values from `JOBS_INBOX[].src`; widened to
 * `string` so per-search fixtures can ship vendor-specific origins.
 */
export type InboxSource =
  | "greenhouse"
  | "workday"
  | "hospital"
  | "indeed"
  | "usajobs"
  | (string & {})

/** How a job entered the system. Mirrors the ADD-001/003/004/005 capture paths. */
export type JobCaptureMethod = "url" | "jd-text" | "extension" | "email-forward"

/** Work arrangement, extracted at capture. */
export type JobWorkMode = "remote" | "hybrid" | "onsite"

/**
 * From `data.jsx :: JOBS_INBOX`.
 *
 * The first six fields are the thin "scored" payload every inbox item has. The
 * optional fields below (DEC-057) are the full captured payload surfaced in the
 * inbox detail pane -- mirroring the ADD-001/003 extraction contract plus the
 * match strengths/gaps. Partial captures simply omit them; the detail pane
 * degrades gracefully rather than rendering empty sections.
 */
export interface JobInboxItem {
  /** Reference to the underlying Job posting (ADR-006). Drives the "open full
   *  job page" link, paralleling ShortlistEntry.jobId. */
  jobId?: string
  company: string
  role: string
  location: string
  compensation: string
  match: number
  source: InboxSource
  isNew?: boolean
  posted: string

  // --- DEC-057: full captured payload (optional; present on enriched items) ---
  /** How this job was captured into the system. */
  capturedVia?: JobCaptureMethod
  /** When it was captured, human-readable (e.g. "2d ago", "May 27, 9:14am"). */
  capturedAt?: string
  /** Original posting URL, when captured from one. Drives "View original posting". */
  sourceUrl?: string
  /** Work arrangement. */
  workMode?: JobWorkMode
  /** Employment type (e.g. "Full-time", "Contract", "Per diem"). */
  employmentType?: string
  /** Seniority guess from extraction (e.g. "Manager", "Senior IC"). */
  seniority?: string
  /** One-paragraph summary of the role. */
  summary?: string
  /** Skill / tech / credential tags extracted at capture. */
  tags?: readonly string[]
  /** Key requirements pulled from the JD. */
  requirements?: readonly string[]
  /** Match strengths -- why this scored well against the resume. */
  strengths?: readonly string[]
  /** Match gaps -- what the resume is missing for this role. */
  gaps?: readonly string[]
  /** Raw job-description text, preserved verbatim at capture. */
  jd?: string
}

// ---------------------------------------------------------------------------
// Job (first-class posting resource) -- ADR-006
// ---------------------------------------------------------------------------

/** Worker classification / employer-of-record. Atomic, filterable axis. */
export type WorkerClassification = "w2" | "contract" | "1099"

/** How compensation is expressed. Atomic, filterable axis. */
export type PayCadence = "hourly" | "salary"

/** Time commitment. Atomic, filterable axis. */
export type TimeCommitment = "full-time" | "part-time"

/**
 * Employment terms as three independent atomic axes (ADR-006). A real posting
 * carries all three orthogonally (e.g. a W2 / salary / full-time role, or a
 * contract / hourly / part-time gig); keeping them separate lets screens filter
 * and sort each without parsing a bundled string.
 */
export interface Employment {
  classification: WorkerClassification
  cadence: PayCadence
  commitment: TimeCommitment
}

/** Structured location. `raw` is always present; the parsed parts are best-effort. */
export interface JobLocation {
  raw: string
  locality?: string
  region?: string
  country?: string
}

/** Capture provenance -- how/when a posting entered the system. */
export interface JobSource {
  /** Origin board / ATS (greenhouse, workday, hospital, usajobs, ...). */
  board: InboxSource
  /** How it was captured into the system. */
  channel: JobCaptureMethod
  /** Original posting URL, when captured from one. */
  url?: string
  /** Human-readable capture time (e.g. "2d ago, pasted from hiring.cafe"). */
  capturedAt: string
}

/** Whether a match score came from the free local heuristic or a paid LLM run (D8). */
export type MatchKind = "rough" | "deep"

/** Resume-relative match summary embedded on a Job read. */
export interface JobMatch {
  score: number
  strengths: readonly string[]
  gaps: readonly string[]
  /**
   * D8: 'rough' = free local heuristic (skill/keyword overlap, no LLM, excluded
   * from cost-cap tracking); 'deep' = paid LLM score. Absent = treat as rough.
   */
  kind?: MatchKind
}

/**
 * A captured job posting -- the canonical resource the inbox, shortlist, and
 * applications all reference by `id` (ADR-006). Display surfaces (the inbox
 * detail pane, the standalone `/jobs/:id` page) render this shape directly.
 */
export interface Job {
  id: string
  company: string
  title: string
  location: JobLocation
  workMode: JobWorkMode
  employment: Employment
  /** Structured compensation; `null` when undisclosed. */
  compensation: Salary | null
  seniority?: string
  source: JobSource
  /** Is this posting newly arrived in the inbox? */
  isNew?: boolean
  /** Human-readable posting age (e.g. "2d ago"). */
  posted: string
  summary?: string
  tags?: readonly string[]
  requirements?: readonly string[]
  /** Verbatim job-description text, preserved at capture. */
  description?: string
  /** Resume-relative match (score + strengths + gaps). */
  match?: JobMatch
}

// ---------------------------------------------------------------------------
// Agents (`AGENTS_DATA` + `AGENT_LOG`)
// ---------------------------------------------------------------------------

/** Agent operational state. From `AGENTS_DATA[].state`. */
export type AgentState = "running" | "demand" | "paused" | "error"

/** From `data.jsx :: AGENTS_DATA`. */
export interface Agent {
  id: string
  name: string
  icon: string
  state: AgentState
  stateLabel: string
  lastActivity: string
  actions: number
  cost: string
  description: string
  live?: boolean
  /**
   * Current trust tier (D25 / AGT-031). Defaults to 'observe' when absent.
   * Soft-gated in the mockup: the UI frames higher tiers with stronger
   * warnings but does not hard-enforce.
   */
  trustTier?: AgentTrustTier
}

/**
 * Agent trust-tier ladder (D25 / AGT-031). A monotonic progression of how much
 * autonomy an agent is trusted with. Soft-gated in the mockup -- granting a
 * permission above the agent's current tier is allowed, but framed with a
 * stronger confirmation rather than blocked. Hard enforcement (tier
 * unlock/demotion state machine) is deferred to the real build.
 */
export type AgentTrustTier =
  | "observe"
  | "suggest"
  | "act-with-approval"
  | "autonomous"

/** One rung of the trust-tier ladder, for display. */
export interface TrustTierRung {
  tier: AgentTrustTier
  label: string
  /** Plain-language description of what this tier lets the agent do. */
  blurb: string
}

/** An agent's current trust standing plus the full ladder. GET /agents/{id}/trust-tier. */
export interface AgentTrustTierView {
  agentId: string
  currentTier: AgentTrustTier
  /** ISO-8601 date the current tier was reached (optional in the mock). */
  unlockedAt?: string
  ladder: readonly TrustTierRung[]
}

/** Result of a tier-change request. PATCH /agents/{id}/trust-tier. */
export interface AgentTrustTierUpdate {
  agentId: string
  currentTier: AgentTrustTier
  /** Mock always grants (soft-gate); a real backend may return 'pending'. */
  status: "granted" | "pending"
  message: string
}

/** Agent log entry kind. From `AGENT_LOG[].kind`. */
export type AgentLogKind = "auto" | "await" | "success" | "skipped"

/** From `data.jsx :: AGENT_LOG`. */
export interface AgentLogEntry {
  time: string
  agentId: string
  kind: AgentLogKind
  message: string
  ref: string
}

/** Optional filter for `getAgentLog`. */
export interface AgentLogFilter {
  agentId?: string
  kind?: AgentLogKind
}

// ---------------------------------------------------------------------------
// Résumés (`RESUMES`)
// ---------------------------------------------------------------------------

/** Résumé library tag. From `RESUMES[].tag`. */
export type ResumeTag =
  | "MASTER"
  | "DEFAULT"
  | "VARIANT"
  | "TAILORED"
  | "DRAFT"
  | "FORMAT"

/**
 * From `data.jsx :: RESUMES`. In the resume-lifecycle model (RES-034, ADR-007/008)
 * a non-FORMAT Resume IS a projection: a curated selection/ordering over career
 * history toward a target role. The lifecycle pieces (uploaded original, career
 * history, rendered export, template) are separate types below.
 */
export interface Resume {
  id: string
  name: string
  subtitle: string
  version: string
  usedIn: number
  updated: string
  tag: ResumeTag
  match?: number
  body?: string
  /** RES-034: the uploaded original this projection was parsed/sourced from. */
  sourceUploadId?: string
  /** TPL-002: the template this projection renders through on export. */
  templateId?: string
  /** RES-034: the target role/track this projection is curated toward. */
  targetRole?: string
  /**
   * D21: whether this resume participates in match scoring. Default ON. Only
   * MASTER resumes are eligible; a per-Search override can replace the set.
   */
  scoringEnabled?: boolean
}

/**
 * D10: the immutable copy of a resume captured when an application reaches
 * APPLIED. Lives in its own table (FK'd from Application.submittedSnapshotId), so
 * the editable master can change freely without altering what was submitted.
 * REST: GET /applications/{id}/snapshot -> ResumeSnapshot (404 before APPLIED).
 */
export interface ResumeSnapshot {
  id: string
  applicationId: string
  /** The master/projection this was rendered from (FK -> Resume.id). */
  resumeId: string
  /** The submitted resume's display name at capture time. */
  name: string
  /** Rendered/submitted content, frozen at APPLIED. */
  body: string
  /** Template version used to render the submitted copy (D17 provenance). */
  templateVersion: string
  /** Human-readable capture time. */
  capturedAt: string
}

// ---------------------------------------------------------------------------
// Resume lifecycle (2026-06-02 round: upload -> career history -> projection -> export)
// See docs/product/story-map/stories/10-library.md (RES-030..038) + ADR-008.
// UI copy NEVER says "corpus" -- always "career history".
// ---------------------------------------------------------------------------

/** RES-030: an uploaded resume file, kept immutable even after parsing. */
export interface ResumeUpload {
  id: string
  filename: string
  uploadedAt: string
  parsed: boolean
  sizeBytes: number
}

/** RES-031: one parsed item of the user's career history (the structured truth). */
export interface CareerHistoryItem {
  id: string
  kind: "experience" | "education" | "skill" | "project" | "summary"
  title: string
  org?: string
  bullets: readonly string[]
  ordinal: number
  /** Which upload(s) contributed this item (RES-038 merge provenance). */
  sourceUploadIds: readonly string[]
}

/** RES-037: a rendered, downloadable output of a projection + template. One-way. */
export interface ResumeExport {
  id: string
  projectionId: string
  templateId: string
  /** D17: template VERSION at render time -- provenance, frozen per export. */
  templateVersion: string
  filename: string
  generatedAt: string
  regenerable: boolean
}

/** TPL-001: a resume layout template (the look, separate from content). */
export interface ResumeTemplate {
  id: string
  name: string
  previewKind: "single-column" | "two-column" | "compact" | "modern"
  description: string
}

// ---------------------------------------------------------------------------
// Match Explorer (`match_explorer.jsx`)
// ---------------------------------------------------------------------------

/** A single rubric row in the match report. */
export interface MatchRubricRow {
  label: string
  score: number
  note: string
}

/** Severity for a match gap. */
export type GapSeverity = "high" | "medium" | "low"

/** From `match_explorer.jsx` gaps array. */
export interface MatchGap {
  severity: GapSeverity
  text: string
}

/** Compose for the match-explorer screen. Strengths are flat strings in the source. */
export interface MatchReport {
  resumeId: string
  jobId: string
  score: number
  rubric: MatchRubricRow[]
  gaps: MatchGap[]
  strengths: string[]
}

// ---------------------------------------------------------------------------
// Coach (`coach.jsx`)
// ---------------------------------------------------------------------------

/**
 * Coach thread scope. From `coach.jsx` thread list `.s` field. Note `résumé` w/ é
 * (verbatim from source; fixtures + tests depend on the spelling).
 * Widened 2026-06-02 (COA-034) so Coach threads can be scoped to every Library
 * subject, not just applications/resumes.
 */
export type CoachThreadScope =
  | "application"
  | "résumé"
  | "career-history"
  | "projection"
  | "contact"
  | "answer"
  | "project"
  | "accomplishment"
  | "prep"
  | "general"

/** From `coach.jsx` thread list. */
export interface CoachThread {
  id: string
  title: string
  scope: CoachThreadScope
  when: string
  active?: boolean
}

/** From `coach.jsx` `Msg` calls. `author` is the only canonical discriminator. */
export type CoachMessageAuthor = "user" | "bot"

/** From `coach.jsx` `Msg` calls. */
export interface CoachMessage {
  id: string
  author: CoachMessageAuthor
  text: string
  draft?: string
  /**
   * COA-024: content-library items the user should attach when they send the
   * draft from their OWN email client (the product never sends mail -- no
   * Gmail integration). Surfaced beside the copyable draft body.
   */
  draftAttachments?: readonly {
    name: string
    kind: "resume" | "cover-letter" | "file"
  }[]
  typing?: boolean
}

/** Right-pane context card. From `coach.jsx :: CtxCard`. */
export interface ContextCard {
  label: string
  body: string
}

// ---------------------------------------------------------------------------
// Coach -- omnipresent assistant additions (2026-06-02 round, COA-030..036)
// See docs/product/story-map/stories/11-coach.md.
// ---------------------------------------------------------------------------

/** COA-031: the live "what am I looking at" descriptor derived from the route. */
export interface CoachSubject {
  scope: CoachThreadScope
  id?: string
  label: string
}

/** COA-036: who performed a change, for audit-trail attribution. */
export type CoachActor = "you" | "coach-on-behalf" | "agent"

/** COA-032: one field-level before/after row of a proposed change. */
export interface CoachDiff {
  field: string
  before: string
  after: string
}

/** COA-032: a Coach-proposed change, reviewed (gate 1) before it is saved (gate 2). */
export interface CoachProposal {
  id: string
  subject: CoachSubject
  summary: string
  diff: readonly CoachDiff[]
  status: "pending" | "accepted" | "rejected"
}

/** COA-031: per-subject opening line + suggested-action chips for the Coach panel. */
export interface CoachGreeting {
  greeting: string
  chips: readonly string[]
}

// ---------------------------------------------------------------------------
// Library artifacts (2026-06-02 round). Bounded entities -- typed per ADR-008.
// See docs/product/story-map/stories/10-library.md.
// ---------------------------------------------------------------------------

/** CON-001/002: a person in the user's search. References are a tagged role. */
export interface Contact {
  id: string
  name: string
  role: string
  org: string
  email: string
  phone: string
  relationship: string
  isReference: boolean
  tags: readonly string[]
  links: readonly { label: string; url: string }[]
  notes: string
  updated: string
  /** D24: soft-delete marker (ISO-8601). When set, the item is in the trash. */
  deletedAt?: string
}

/** ACC-001/002: a reusable accomplishment, authored or derived from a Project. */
export interface Accomplishment {
  id: string
  title: string
  summary: string
  tags: readonly string[]
  /** ACC-002: set when distilled from a Project (snapshot + backlink), else null. */
  source: { projectId: string } | null
  usedIn: number
  updated: string
  /** D24: soft-delete marker (ISO-8601). When set, the item is in the trash. */
  deletedAt?: string
}

/** ANS-001: a saved answer to a recurring application question. */
export interface Answer {
  id: string
  question: string
  body: string
  category: AnswerCategory
  tags: readonly string[]
  updated: string
  /** D24: soft-delete marker (ISO-8601). When set, the item is in the trash. */
  deletedAt?: string
}

export type AnswerCategory =
  | "compensation"
  | "motivation"
  | "work-authorization"
  | "logistics"
  | "eeo"
  | "other"

/** PRJ-001: a per-employer brain-dump / evidence reservoir. */
export interface Project {
  id: string
  title: string
  employer: string
  body: string
  tags: readonly string[]
  updated: string
  /** D24: soft-delete marker (ISO-8601). When set, the item is in the trash. */
  deletedAt?: string
}

/** D24: a kind of bounded Library entity (soft-deletable). */
export type LibraryKind = "contact" | "accomplishment" | "answer" | "project"

/** D24: one row in the Trash view. */
export interface TrashEntry {
  kind: LibraryKind
  id: string
  label: string
  deletedAt: string
}

/** D24: dependent-count report shown before a delete (typed-confirm drill-down). */
export interface DeletionImpact {
  kind: LibraryKind
  id: string
  /** Things that reference this item, grouped by kind. */
  dependents: readonly {
    kind: LibraryKind
    count: number
    items: readonly { id: string; label: string }[]
  }[]
  /** Total dependents across all kinds. */
  total: number
}

/** CRD-001: a stored license/certification/document (persona-expansion, Post-MVP). */
export interface Credential {
  id: string
  name: string
  type: "license" | "certification" | "transcript" | "portfolio" | "other"
  issuer: string
  expiry?: string
  fileRef: string
  updated: string
}

// ---------------------------------------------------------------------------
// Search (organizational scope -- `search_criteria.jsx` + `search_detail.jsx`)
// ---------------------------------------------------------------------------

/** Title list w/ include + exclude. From `search_criteria.jsx`. */
export interface SearchCriteria {
  titlesInclude: string[]
  titlesExclude: string[]
  locations: string[]
  remotePolicy: "OK" | "Hybrid OK" | "Required"
  maxCommuteMin: number
  baseFloor: string
  baseCeiling: string
  yearsExperience: string
  /**
   * D21: per-search scoring override. When set, REPLACES the global eligible
   * master set for this search; absent = inherit the global (scoringEnabled) set.
   */
  scoringResumeIds?: string[]
}

/**
 * Saved-search operational state. A search is an organizational SCOPE the user
 * tracks applications under -- 'active' means actively pursued, 'paused' means
 * parked. Mirrors sidebar search-state badges.
 */
export type SearchState = "active" | "paused"

/** Saved search summary. Composed from `search_detail.jsx` + sidebar references. */
export interface Search {
  id: string
  name: string
  /** Operational state: 'active' (pursued) or 'paused' (parked). Defaults to 'active' when absent. */
  state?: SearchState
  eyebrow: string
  criteria: SearchCriteria
  jobsInInbox: number
  activeApplications: number
  shortlisted: number
  offers: number
  spendMo: string
}

// ---------------------------------------------------------------------------
// Notifications (`popovers.jsx :: NotificationsPopover`)
// ---------------------------------------------------------------------------

/** From `popovers.jsx` notification list `.kind`. */
export type NotificationKind = "reply" | "agent" | "match" | "cal"

/** From `popovers.jsx` notification items. */
export interface Notification {
  id: string
  kind: NotificationKind
  icon: string
  title: string
  message: string
  actor: string
  unread?: boolean
}

// ---------------------------------------------------------------------------
// Toasts (`toasts.jsx`)
// ---------------------------------------------------------------------------

/** From `toasts.jsx` toast list `.kind`. */
export type ToastKind = "success" | "agent" | "warn" | "error" | "celebrate"

/** From `toasts.jsx`. `time` is either seconds-string ("5s") or "persists". */
export interface Toast {
  id: string
  kind: ToastKind
  icon: string
  title: string
  subtitle: string
  undo?: boolean
  cta?: string
  time: string
}

// ---------------------------------------------------------------------------
// LLM cost transparency + consent (D8b / D9a / D9b)
// ---------------------------------------------------------------------------

/** One itemized line in a cost-preview consent panel (D8b). */
export interface CostPreviewItem {
  /** Human label, e.g. "Deep match score -- Distributed-systems master". */
  label: string
  /** Model that will run it, e.g. "claude-sonnet-4". */
  model: string
  /** Estimated cost in USD. Free heuristic items are 0. */
  estCostUsd: number
}

/**
 * Cost preview returned before a paid LLM run (D8b). The consent panel renders
 * one line per task, the running total, and the remaining monthly-cap headroom.
 * REST: POST /llm-tasks/preview  body {tasks} -> CostPreview
 */
export interface CostPreview {
  items: readonly CostPreviewItem[]
  totalUsd: number
  /** Remaining headroom under the monthly cap at preview time, USD. */
  capRemainingUsd: number
  /** True when totalUsd would exceed capRemainingUsd. */
  overCap: boolean
}

/** Result of a deep (paid) match-score run (D8 deep variant). */
export interface DeepMatchResult {
  jobId: string
  resumeId: string
  score: number
  kind: "deep"
  strengths: readonly string[]
  gaps: readonly string[]
  /** Actual cost charged for this run, USD. */
  costUsd: number
}

/**
 * Email-parser behavior when the monthly cap is reached (D9b). Defaults to
 * deterministic chip/keyword parsing (no LLM); the user may opt in to a cheap
 * fallback model -- an explicit choice that keeps the "you pick the provider"
 * promise.
 */
export interface EmailParserFallback {
  mode: "deterministic" | "cheap-model"
  /** Cheap model id, present when mode === 'cheap-model'. */
  model?: string
}

// ---------------------------------------------------------------------------
// Settings (`settings.jsx`)
// ---------------------------------------------------------------------------

/** Integration row state. From `settings.jsx :: SetIntegrations`. */
export type IntegrationState = "connected" | "not-connected" | "auto"

/** From `settings.jsx :: SetIntegrations` rows. */
export interface IntegrationRow {
  name: string
  description: string
  state: IntegrationState
  icon: string
  account?: string
  lastSync?: string
}

/** Provider row state. From `settings.jsx :: SetProviders`. */
export type ProviderState = "connected" | "not-connected" | "error"

/** From `settings.jsx :: SetProviders` rows. */
export interface ProviderRow {
  provider: string
  model: string
  state: ProviderState
  balance?: string
  error?: string
}

/** Per-task routing row. From `settings.jsx :: SetProviders` routing section. */
export interface RoutingRow {
  label: string
  value: string
}

/** Usage / billing row. From `settings.jsx :: SetUsage` table. */
export interface UsageRow {
  service: string
  model: string
  count: number
  tokens: string
  cost: string
}

/** Privacy toggle. From `settings.jsx :: SetPrivacy`. */
export interface PrivacyToggle {
  title: string
  description: string
  on: boolean
}

/** Invoice row. From `settings.jsx :: SetBilling`. */
export interface InvoiceRow {
  date: string
  description: string
  amount: string
}

/** Danger action. From `settings.jsx :: SetDanger`. */
export interface DangerAction {
  title: string
  description: string
  cta: string
  danger: boolean
}

/** Notification preference row. One row per category. */
export interface NotifPref {
  id: string
  category: string
  emailEnabled: boolean
  inAppEnabled: boolean
  emailLocked?: boolean
  consequence?: string
}

/** Personal access token for the browser extension. */
export interface ExtensionToken {
  id: string
  label: string
  createdAt: string
  revokedAt?: string
}

/** Settings bundle returned by `getSettings()`. */
export interface Settings {
  profile: {
    name: string
    email: string
    phone: string
    timezone: string
    currentRole: string
    targetTitles: string[]
    compFloor: string
  }
  integrations: IntegrationRow[]
  providers: ProviderRow[]
  routing: RoutingRow[]
  usage: UsageRow[]
  monthSpend: string
  monthlyCap: string
  privacy: PrivacyToggle[]
  privacyLastUpdated: string
  plan: {
    name: string
    price: string
    description: string
    nextCharge: string
  }
  invoices: InvoiceRow[]
  danger: DangerAction[]
  notifPrefs: NotifPref[]
  extensionTokens: ExtensionToken[]
  /** D9b: how the background email parser behaves once the monthly cap is hit. */
  emailParserFallback: EmailParserFallback
}

// ---------------------------------------------------------------------------
// Agent-detail (`agent_detail.jsx`)
// ---------------------------------------------------------------------------

/** Per-agent configuration row. From `agent_detail.jsx :: CfgRow`. */
export interface AgentConfigRow {
  label: string
  hint?: string
  kind: "numInput" | "switch" | "seg"
  value: string | boolean
  options?: { key: string; label: string }[]
}

/** Per-agent permission grant. From `agent_detail.jsx` permissions block. */
export interface AgentPermission {
  permission: string
  granted: boolean
  /**
   * The trust tier at which this permission is "in-tier" (D25 / AGT-031).
   * A granted permission whose requiredTier is above the agent's current tier
   * is soft-gated: still active, but surfaced with a stronger warning.
   */
  requiredTier?: AgentTrustTier
}

/** Recent-actions row. From `agent_detail.jsx`. */
export interface AgentRecentAction {
  time: string
  message: string
  reference: string
}

// ---------------------------------------------------------------------------
// Dashboard (`dashboard.jsx`)
// ---------------------------------------------------------------------------

/** Tag for a dashboard nudge row. From `dashboard.jsx :: nudges`. */
export type NudgeTag = "reply" | "stale" | "prep" | "offer"

/** From `dashboard.jsx :: nudges`. */
export interface DashboardNudge {
  tag: NudgeTag
  label: string
  title: string
  meta: string
  cta: string
  primary: boolean
}

// ---------------------------------------------------------------------------
// Applications screen (`applications.jsx`)
// ---------------------------------------------------------------------------

/** Filter chip on the applications screen. From `applications.jsx :: filters`. */
export interface ApplicationFilter {
  key: "all" | "active" | "interview" | "offer" | "archived" | "resurrected"
  label: string
  count: number
}

/** Kanban column. From `applications.jsx :: KanbanView`. */
export interface KanbanColumn {
  id: Stage
  label: string
}

// ---------------------------------------------------------------------------
// Résumé editor (`resume_editor.jsx`)
// ---------------------------------------------------------------------------

/** Editor suggestion type. From `resume_editor.jsx`. */
export type ResumeSuggestionType = "tailored" | "generic"

/** From `resume_editor.jsx` suggestion list. */
export interface ResumeSuggestion {
  type: ResumeSuggestionType
  title: string
  question: string
  cta: string
}

// ---------------------------------------------------------------------------
// Onboarding (`onboarding.jsx`)
// ---------------------------------------------------------------------------

/** Onboarding "what's your situation?" intent option. */
export interface OnboardingStance {
  key: "exploring" | "searching" | "urgent" | "change"
  icon: string
  title: string
  description: string
}

/** Onboarding integration card. */
export interface OnboardingIntegration {
  icon: string
  name: string
  description: string
  recommended?: boolean
}

/** Onboarding agent toggle. */
export interface OnboardingAgent {
  name: string
  description: string
  on: boolean
  warn?: boolean
}

// ---------------------------------------------------------------------------
// Extension (`extension.jsx`)
// ---------------------------------------------------------------------------

/** Extension popup state. */
export type ExtensionState = "detected" | "empty" | "signed-out"

/** Extension "recently captured" row. */
export interface ExtensionRecentCapture {
  title: string
  detail: string
}

// ---------------------------------------------------------------------------
// User menu (`popovers.jsx :: UserMenuPopover`)
// ---------------------------------------------------------------------------

/** User-menu list row. From `popovers.jsx :: UserMenuPopover`. */
export interface UserMenuRow {
  icon: string
  label: string
  sublabel: string
  badge?: string
  meta?: string
}

// ---------------------------------------------------------------------------
// Usage aggregate (SET-billing / sidebar BudgetBar)
// ---------------------------------------------------------------------------

/** Aggregate token-usage summary for the current billing period. */
export interface UsageAggregate {
  monthSpend: string
  monthlyCap: string
  tokensIn: string
  tokensOut: string
  avgPerSession: string
}

// ---------------------------------------------------------------------------
// Review queue (AGT-021 approve / reject)
// ---------------------------------------------------------------------------

/** A single agent log entry pending human approval. */
export interface ReviewQueueItem {
  /** Same reference key as AgentLogEntry.ref */
  ref: string
  /** Agent id that queued the action. Same as AgentLogEntry.agentId */
  agentId: string
  /** Human-readable description of the pending action. */
  message: string
  /** Wall-clock time string from the log. */
  time: string
}

// ---------------------------------------------------------------------------
// Data export (ACC-export)
// ---------------------------------------------------------------------------

/** Result of a data-export request. */
export interface DataExportRequest {
  /** Simulated download URL (mock). */
  url: string
  /** ISO-8601 string when the export was created. */
  requestedAt: string
}

// ---------------------------------------------------------------------------
// Interview rounds (TRK-117)
// ---------------------------------------------------------------------------

/** Interview round type. */
export type InterviewType =
  | "recruiter-screen"
  | "technical"
  | "onsite"
  | "final"

/** Interview round format. */
export type InterviewFormat = "video" | "phone" | "onsite"

/** Interview round status. */
export type InterviewStatus = "scheduled" | "completed" | "cancelled"

/** A single interview round for an application. */
export interface InterviewRound {
  id: string
  appId: string
  date: string
  type: InterviewType
  format: InterviewFormat
  status: InterviewStatus
}

// ---------------------------------------------------------------------------
// Timeline events (TRK-118)
// ---------------------------------------------------------------------------

/** A single event in an application's audit timeline. */
export interface TimelineEvent {
  id: string
  time: string
  who: string
  message: string
  badge?: string
  /** COA-036: structured actor for attribution (Coach-on-behalf vs you vs agent). */
  actor?: CoachActor
}

// ---------------------------------------------------------------------------
// Search mutation inputs (ADD-006, ADD-010)
// ---------------------------------------------------------------------------

/** Payload for createSearch(). */
export interface CreateSearchInput {
  name: string
  criteria: Partial<SearchCriteria>
}

/** Payload for updateSearchCriteria(). */
export interface UpdateSearchCriteriaInput {
  id: string
  criteria: SearchCriteria
}
