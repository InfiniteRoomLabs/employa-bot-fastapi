/**
 * Internal -- consumers MUST go through `src/hooks/`. Direct imports from this
 * file outside `src/hooks/` are a layer violation. This is the swap-seam:
 * replacing these functions with a real fetch client (or TanStack Query, SWR,
 * etc.) is the only surface the future Symfony + API Platform consumer needs
 * to touch.
 *
 * Every function is async, awaits `simulateLatency()`, and surfaces failures
 * through `MockApiError`. Failure injection is toggled by the
 * `VITE_MOCK_FAIL` env var (comma-separated `path:kind` pairs, e.g.
 * `applications:rate_limited,coach/threads/:id:network`). Tests use `vi.stubEnv` to
 * exercise error states.
 *
 * MUTABLE STORE DESIGN
 * --------------------
 * Module-level `let` arrays shadow the read-only fixture constants.
 * - They are lazily initialized from the frozen fixture on first use.
 * - Mutations (create/update/delete) write directly to these arrays.
 * - `getXxx()` functions read from the mutable copy, so a `refetch()` call
 *   after a mutation picks up the new state within the same browser session.
 * - `__resetForTests()` reinitializes every mutable array from the frozen
 *   seed, giving Vitest a clean slate between test runs.
 * - State resets on page reload (no localStorage) -- this is explicit and
 *   documented as mockup-correct behavior.
 */

import { simulateLatency } from "../lib/latency"
import { MockApiError, type MockApiErrorKind } from "../lib/mock-api-error"
import {
  ACCOMPLISHMENTS,
  AGENT_LOG,
  AGENTS_DATA,
  ANSWERS,
  APP_SLUG_BY_UUID,
  APP_UUID_BY_SLUG,
  APPS,
  APPS_AI_INFRA,
  APPS_BACKEND,
  ARCHIVE_APPS,
  applicationView,
  BLANK_CRITERIA,
  BUDGET_TOTAL,
  BUDGET_USED,
  CAREER_HISTORY,
  COACH_CONTEXT_BY_THREAD,
  COACH_CONTEXT_CARDS,
  COACH_GREETING_BY_SCOPE,
  COACH_MESSAGES,
  COACH_PROPOSAL_FIXTURES,
  COACH_THREADS,
  CONTACTS,
  CREDENTIALS,
  EXTENSION_RECENT_CAPTURES,
  EXTENSION_STATES,
  INBOX_BY_SEARCH,
  INTERVIEW_ROUNDS,
  JOBS,
  JOBS_BY_ID,
  JOBS_INBOX,
  LLM_TASK_COST_USD,
  MATCH_GAPS,
  MATCH_REPORT_META,
  MATCH_RUBRIC,
  MATCH_STRENGTHS,
  NOTIFICATIONS,
  PER_AGENT_PERMISSIONS,
  PERMISSION_REQUIRED_TIER,
  PROJECTS,
  REMY,
  RESUME_EXPORTS,
  RESUME_TEMPLATES,
  RESUME_UPLOADS,
  RESUMES,
  SEARCH_ID_AI_INFRA,
  SEARCH_ID_BACKEND,
  SEARCHES,
  SETTINGS_DANGER,
  SETTINGS_EMAIL_PARSER_FALLBACK,
  SETTINGS_EXTENSION_TOKENS,
  SETTINGS_INTEGRATIONS,
  SETTINGS_INVOICES,
  SETTINGS_NOTIFICATION_PREFS,
  SETTINGS_PLAN,
  SETTINGS_PRIVACY,
  SETTINGS_PRIVACY_LAST_UPDATED,
  SETTINGS_PROFILE,
  SETTINGS_PROVIDERS,
  SETTINGS_ROUTING,
  SETTINGS_USAGE,
  SETTINGS_USAGE_META,
  SETTINGS_USAGE_TOTALS,
  SHORTLIST_BY_SEARCH,
  SHORTLIST_DATA,
  TEMPLATE_ID_CLASSIC,
  TIMELINE_BY_APP,
  TRUST_TIER_LADDER,
  USER_MENU_ROWS,
} from "./fixtures"
import type {
  Accomplishment,
  Agent,
  AgentLogEntry,
  AgentLogFilter,
  AgentPermission,
  AgentTrustTier,
  AgentTrustTierUpdate,
  AgentTrustTierView,
  Answer,
  Application,
  ApplicationView,
  CareerHistoryItem,
  CoachGreeting,
  CoachMessage,
  CoachProposal,
  CoachSubject,
  CoachThread,
  CoachThreadScope,
  Contact,
  ContextCard,
  CostPreview,
  CreateSearchInput,
  Credential,
  DataExportRequest,
  DeepMatchResult,
  DeletionImpact,
  ExtensionRecentCapture,
  ExtensionState,
  InterviewRound,
  Job,
  JobInboxItem,
  LibraryKind,
  MatchReport,
  Notification,
  Project,
  Resume,
  ResumeExport,
  ResumeSnapshot,
  ResumeTemplate,
  ResumeUpload,
  ReviewQueueItem,
  Salary,
  Search,
  Settings,
  ShortlistEntry,
  TimelineEvent,
  TrashEntry,
  UpdateSearchCriteriaInput,
  UsageAggregate,
  User,
  UserMenuRow,
} from "./types"

// ---------------------------------------------------------------------------
// Failure injection
// ---------------------------------------------------------------------------

const KNOWN_KINDS: readonly MockApiErrorKind[] = [
  "not_found",
  "unauthorized",
  "validation_error",
  "conflict",
  "cap_reached",
  "undo_window_expired",
  "invalid_transition",
  "rate_limited",
  "network",
  "unknown",
]

/**
 * Determines if a specific failure kind should be injected for a given API path based on environment configuration.
 *
 * @param {string} path - The API path to check for an injected failure kind.
 * @return {MockApiErrorKind | null} The matched failure kind to inject if found, or null if no match exists.
 */
function injectedFailureFor(path: string): MockApiErrorKind | null {
  const env = import.meta.env as Record<string, string | undefined>
  const raw = env.VITE_MOCK_FAIL
  if (typeof raw !== "string" || raw.length === 0) {
    return null
  }
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim()
    if (trimmed.length === 0) {
      continue
    }
    const index = trimmed.lastIndexOf(":")
    if (index <= 0) {
      continue
    }
    const target = trimmed.slice(0, index)
    const kind = trimmed.slice(index + 1) as MockApiErrorKind
    if (target === path && (KNOWN_KINDS as readonly string[]).includes(kind)) {
      return kind
    }
  }
  return null
}

/**
 * Triggers an error based on the injected failure type for the given path.
 *
 * @param {string} path - The input path used to determine the type of failure.
 * @return {void} This method does not return a value.
 */
function throwInjected(path: string): void {
  const kind = injectedFailureFor(path)
  if (kind === null) {
    return
  }
  // Every kind shares the same (kind, path) constructor; no per-kind branch needed.
  throw new MockApiError(kind, path)
}

async function begin(path: string): Promise<void> {
  await simulateLatency()
  throwInjected(path)
}

// ---------------------------------------------------------------------------
// MUTABLE STORES
// Each store is initialized as a spread of its seed fixture. __resetForTests
// reinitializes all of them together.
// ---------------------------------------------------------------------------

let _notifications: Notification[] = [...NOTIFICATIONS]
let _resumes: Resume[] = [...RESUMES]
let _agents: Agent[] = [...AGENTS_DATA]
let _shortlist: ShortlistEntry[] = [...SHORTLIST_DATA]
// APPS is spread per-list to allow cross-list mutations
let _apps: Application[] = [...APPS]
let _appsRemote: Application[] = [...APPS_BACKEND]
let _appsAiInfra: Application[] = [...APPS_AI_INFRA]
let _searches: Search[] = [...SEARCHES]
// ORI-009: separate archive pool (never mixed into _apps)
let _archive: Application[] = [...ARCHIVE_APPS]
let _interviewRounds: InterviewRound[] = [...INTERVIEW_ROUNDS]
// ADR-006 stage 3: postings created at runtime (createApplication). getJob and
// the ApplicationView join consult these in addition to the seeded JOBS_BY_ID.
let _dynamicJobs: Record<string, Job> = {}
// 2026-06-02 round: Library artifacts + resume lifecycle stores.
let _contacts: Contact[] = [...CONTACTS]
let _accomplishments: Accomplishment[] = [...ACCOMPLISHMENTS]
let _answers: Answer[] = [...ANSWERS]
let _projects: Project[] = [...PROJECTS]
let _credentials: Credential[] = [...CREDENTIALS]
let _resumeUploads: ResumeUpload[] = [...RESUME_UPLOADS]
let _careerHistory: CareerHistoryItem[] = [...CAREER_HISTORY]
let _resumeExports: ResumeExport[] = [...RESUME_EXPORTS]

/**
 * Retrieves a combined collection of job data, merging predefined job records
 * with dynamically generated job entries.
 *
 * @return {Record<string, Job>} A record where the keys are job identifiers
 * and the values are corresponding job objects.
 */
function jobLookup(): Record<string, Job> {
  return { ...JOBS_BY_ID, ..._dynamicJobs }
}

/**
 * Finds a stored application by its UUID or legacy slug. This method resolves a legacy slug to
 * a UUID and searches across multiple data stores to locate the application, including archived applications.
 *
 * @param {string} idOrSlug - The UUID or legacy slug of the application to be found.
 * @return {Application | undefined} The application object if found, or undefined if no application is found.
 */
function findStoredApplication(idOrSlug: string): Application | undefined {
  // Accept a UUID id or a legacy slug (resolved to the id) so deep-links and
  // hardcoded demo references keep working post-normalization.
  const id = APP_UUID_BY_SLUG[idOrSlug] ?? idOrSlug
  return (
    _apps.find((application) => application.id === id) ??
    _appsRemote.find((application) => application.id === id) ??
    _appsAiInfra.find((application) => application.id === id) ??
    _archive.find((application) => application.id === id)
  )
}

// ---------------------------------------------------------------------------
// User / persona
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<User> {
  await begin("user")
  return REMY
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/**
 * Returns the applications scoped to a saved search. `searchId` is the
 * search UUID (matching the `Search.id` field). When omitted the
 * canonical platform-search list ships -- same legacy behaviour the
 * top-level `/applications` route always rendered.
 */
export async function getApplications(
  searchId?: string,
): Promise<readonly ApplicationView[]> {
  await begin("applications")
  const lookup = jobLookup()
  let pool: Application[]
  if (searchId === SEARCH_ID_BACKEND) {
    pool = _appsRemote
  } else if (searchId === SEARCH_ID_AI_INFRA) {
    pool = _appsAiInfra
  } else {
    pool = _apps
  }
  return pool.map((application) => applicationView(application, lookup))
}

export async function getApplication(id: string): Promise<ApplicationView> {
  const path = "applications/:id"
  await begin(path)
  const hit = findStoredApplication(id)
  if (!hit) {
    throw MockApiError.notFound(`applications/${id}`)
  }
  return applicationView(hit, jobLookup())
}

// ---------------------------------------------------------------------------
// Archive (ORI-009)
// ---------------------------------------------------------------------------

/**
 * Returns the subset of the archive pool matching `kind`.
 * won  -> outcome === 'won'
 * passed -> outcome === 'rejected' || outcome === 'withdrawn'
 */
export async function getArchive(
  kind: "won" | "passed",
): Promise<readonly ApplicationView[]> {
  await begin("archive")
  return _archive
    .filter((application) =>
      kind === "won"
        ? application.outcome === "won"
        : application.outcome === "rejected" ||
          application.outcome === "withdrawn",
    )
    .map((application) => applicationView(application, jobLookup()))
}

/**
 * Returns the live badge counts derived from the archive pool.
 * Sidebar badges consume this so they always match rendered row counts.
 */
export async function getArchiveCounts(): Promise<{
  won: number
  passed: number
}> {
  await begin("archive")
  const won = _archive.filter(
    (application) => application.outcome === "won",
  ).length
  const passed = _archive.filter(
    (application) =>
      application.outcome === "rejected" || application.outcome === "withdrawn",
  ).length
  return { won, passed }
}

/** Input for createApplication -- posting display fields + lifecycle (ADR-006). */
export interface CreateApplicationInput {
  company: string
  role: string
  location: string
  salary: Salary | null
  match: number
  source: string
  /** Resume label; resolved to a resumeId by name-prefix, else null. */
  resume?: string | null
  stageLabel?: string
  days?: number
  /** D15: target saved search. Defaults to last-used / auto-created 'My jobs' when omitted. */
  searchId?: string
}

/**
 * Create a new application (ORI-014). Normalized: this mints a Job for the
 * posting (registered in the dynamic job store) plus an ids-only Application,
 * and returns the joined view.
 */
export async function createApplication(
  draft: CreateApplicationInput,
): Promise<ApplicationView> {
  await begin("applications")
  const jobId = crypto.randomUUID()
  _dynamicJobs[jobId] = {
    id: jobId,
    company: draft.company,
    title: draft.role,
    location: {
      raw: draft.location,
    },
    workMode: "onsite",
    employment: {
      classification: "w2",
      cadence: "salary",
      commitment: "full-time",
    },
    compensation: draft.salary,
    source: {
      board: draft.source,
      channel: "url",
      capturedAt: "just now",
    },
    posted: "just now",
    match: {
      score: draft.match,
      strengths: [],
      gaps: [],
    },
  }
  /**
   * Represents the unique identifier of a resume linked to the draft.
   * The value is determined based on whether a draft's `resume` property is defined.
   * - If `draft.resume` is defined, the `resumeId` is set to the ID of the first matching resume
   *   from the `_resumes` list whose name starts with the `draft.resume` value, or null if no match is found.
   * - If `draft.resume` is not defined, the value of `resumeId` is null.
   */
  let resumeId: null | string = null
  if (draft.resume) {
    resumeId =
      _resumes.find((resume) => draft.resume!.startsWith(resume.name))?.id ??
      null
  }

  const newApp: Application = {
    id: crypto.randomUUID(),
    jobId,
    resumeId,
    stage: "draft",
    stageLabel: draft.stageLabel ?? "drafting",
    days: draft.days ?? 0,
    // D15: a capture always lands in a search; default to last-used / 'My jobs'.
    searchId: draft.searchId ?? ensureDefaultSearch().id,
  }
  _apps.push(newApp)
  return applicationView(newApp, jobLookup())
}

/**
 * The immutable resume snapshot submitted with an application (D10). Synthesized
 * from the application's selected resume; in a real backend this row is
 * materialized at the APPLIED transition and never changes afterward. Throws
 * `conflict` before APPLIED (no submitted copy exists yet).
 *
 * REST: GET /applications/{id}/snapshot -> ResumeSnapshot
 */
export async function getResumeSnapshot(
  appId: string,
): Promise<ResumeSnapshot> {
  await begin("applications/:id/snapshot")
  // Resolve slug-or-uuid across every pool, mirroring getApplication.
  const app = findStoredApplication(appId)
  if (!app) {
    throw MockApiError.notFound(`applications/${appId}/snapshot`)
  }
  if (app.stage === "saved" || app.stage === "draft") {
    throw MockApiError.conflict(
      `applications/${appId}/snapshot`,
      "No submitted copy exists until the application reaches APPLIED.",
    )
  }
  const resume = app.resumeId
    ? _resumes.find((candidate) => candidate.id === app.resumeId)
    : undefined
  return {
    id: app.submittedSnapshotId ?? `snap-${appId}`,
    applicationId: appId,
    resumeId: app.resumeId ?? "",
    name: resume?.name ?? "Submitted resume",
    body: resume?.body ?? "Submitted resume content -- locked at APPLIED.",
    templateVersion: "v1",
    capturedAt: "at submission",
  }
}

// ---------------------------------------------------------------------------
// Application lifecycle transitions (D12 / D15 / D18 / D19)
// State-machine rules live in docs/product/story-map/state-machines.md.
// ---------------------------------------------------------------------------

/** D15: the saved search a capture lands in when none is specified. */
function ensureDefaultSearch(): Search {
  const existing = _searches.find((search) => search.name === "My jobs")
  if (existing) {
    return existing
  }
  // Multi-search -> last-used (here, most recently added). No saved search at
  // all -> auto-create the 'My jobs' sentinel so search_id is never null.
  if (_searches.length > 0) {
    return _searches[_searches.length - 1]
  }
  const sentinel: Search = {
    id: crypto.randomUUID(),
    name: "My jobs",
    state: "active",
    eyebrow: "Default search",
    criteria: { ...BLANK_CRITERIA },
    jobsInInbox: 0,
    activeApplications: 0,
    shortlisted: 0,
    offers: 0,
    spendMo: "$0.00",
  }
  _searches.push(sentinel)
  return sentinel
}

export interface MarkWonInput {
  startDate?: string
  negotiatedComp?: string
  whatWorked?: string
}

export interface MarkWonResult {
  application: ApplicationView
  /** Token that reverses the win within the grace window (D18). */
  undoToken: string
  /** ISO-8601 expiry of the undo window. */
  undoExpiresAt: string
  /** Length of the undo window in seconds, for the countdown UI. */
  undoWindowSeconds: number
}

const WIN_UNDO_WINDOW_SECONDS = 300
const _winUndo = new Map<string, { app: Application; expiresAt: number }>()

/**
 * Mark an application WON (D18). Records the outcome, archives the active app,
 * and returns a time-boxed undo token (~5 min). Reversible via undoMarkWon
 * within the window; after that, correcting a win is a deliberate
 * OFFER_RESCINDED (see state-machines.md).
 *
 * REST: POST /applications/{id}/mark-won body MarkWonInput -> MarkWonResult
 */
export async function markWon(
  appId: string,
  input: MarkWonInput,
): Promise<MarkWonResult> {
  await begin("applications/:id/mark-won")
  const id = APP_UUID_BY_SLUG[appId] ?? appId
  const index = _apps.findIndex((application) => application.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`applications/${appId}/mark-won`)
  }
  const original = _apps[index]
  const wonApp: Application = {
    ...original,
    outcome: "won",
    outcomeAt: "just now",
    outcomeReason: input.whatWorked,
  }
  _apps.splice(index, 1)
  _archive.push(wonApp)
  const undoToken = crypto.randomUUID()
  const expiresAt = Date.now() + WIN_UNDO_WINDOW_SECONDS * 1000
  _winUndo.set(undoToken, { app: original, expiresAt })
  return {
    application: applicationView(wonApp, jobLookup()),
    undoToken,
    undoExpiresAt: new Date(expiresAt).toISOString(),
    undoWindowSeconds: WIN_UNDO_WINDOW_SECONDS,
  }
}

/**
 * Reverse a mark-won within the grace window (D18, source=user_correction).
 * Throws undo_window_expired once the window has passed.
 *
 * REST: POST /applications/{id}/undo-mark-won  body {undoToken} -> ApplicationView
 */
export async function undoMarkWon(
  appId: string,
  undoToken: string,
): Promise<ApplicationView> {
  await begin("applications/:id/undo-mark-won")
  const entry = _winUndo.get(undoToken)
  if (!entry) {
    throw MockApiError.notFound(`applications/${appId}/undo-mark-won`)
  }
  if (Date.now() > entry.expiresAt) {
    _winUndo.delete(undoToken)
    throw MockApiError.undoWindowExpired(`applications/${appId}/undo-mark-won`)
  }
  _archive = _archive.filter((application) => application.id !== entry.app.id)
  _apps.push(entry.app)
  _winUndo.delete(undoToken)
  return applicationView(entry.app, jobLookup())
}

/**
 * Reactivate a closed/archived application back into the active pipeline (D19,
 * source=user_reactivation). Clears the terminal outcome and re-enters at APPLIED.
 *
 * REST: POST /applications/{id}/reactivate -> ApplicationView
 */
export async function reactivateApplication(
  appId: string,
): Promise<ApplicationView> {
  await begin("applications/:id/reactivate")
  const id = APP_UUID_BY_SLUG[appId] ?? appId
  const index = _archive.findIndex((application) => application.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`applications/${appId}/reactivate`)
  }
  const archived = _archive[index]
  const revived: Application = {
    ...archived,
    outcome: undefined,
    outcomeAt: undefined,
    outcomeReason: undefined,
    outcomeReasons: undefined,
    stage: "applied",
    stageLabel: "reactivated",
    resurrected: true,
  }
  _archive.splice(index, 1)
  _apps.push(revived)
  return applicationView(revived, jobLookup())
}

/** Result of dismissApplication: removed pre-commit, or withdrawn post-APPLIED. */
export interface DismissResult {
  outcome: "removed" | "withdrew"
}

/**
 * Dismiss an application (D12). Pre-commit (SAVED/DRAFT) it is removed outright
 * (the posting-level DISMISSED concept). Post-APPLIED it maps to WITHDREW with
 * reason chips and lands in the archive -- a committed application is never
 * silently deleted. See state-machines.md.
 *
 * REST: POST /applications/{id}/dismiss  body {reasons?} -> DismissResult
 */
export async function dismissApplication(
  appId: string,
  reasons?: readonly string[],
): Promise<DismissResult> {
  await begin("applications/:id/dismiss")
  const id = APP_UUID_BY_SLUG[appId] ?? appId
  const index = _apps.findIndex((application) => application.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`applications/${appId}/dismiss`)
  }
  const app = _apps[index]
  if (app.stage === "saved" || app.stage === "draft") {
    _apps.splice(index, 1)
    return { outcome: "removed" }
  }
  const withdrawn: Application = {
    ...app,
    outcome: "withdrawn",
    outcomeAt: "just now",
    outcomeReasons: reasons,
    outcomeReason: reasons?.[0],
  }
  _apps.splice(index, 1)
  _archive.push(withdrawn)
  return { outcome: "withdrew" }
}

// ---------------------------------------------------------------------------
// Application timeline (TRK-118)
// ---------------------------------------------------------------------------

export async function getApplicationTimeline(
  appId: string,
): Promise<readonly TimelineEvent[]> {
  await begin("applications/:id/timeline")
  // TIMELINE_BY_APP is keyed by the original slug; resolve from the UUID id.
  const slug = APP_SLUG_BY_UUID[appId] ?? appId
  const events = TIMELINE_BY_APP[slug]
  if (events) {
    return events
  }
  // Synthetic fallback: look up the application + its job and produce one event.
  const application = findStoredApplication(appId)
  if (!application) {
    throw MockApiError.notFound(`applications/${appId}`)
  }
  const view = applicationView(application, jobLookup())
  return [
    {
      id: `tl-${appId}-apply`,
      time: "applied",
      who: "You",
      message: `Applied via ${view.source}`,
    },
  ]
}

// ---------------------------------------------------------------------------
// Interview rounds (TRK-117)
// ---------------------------------------------------------------------------

export async function getInterviewRounds(
  appId: string,
): Promise<readonly InterviewRound[]> {
  await begin("applications/:id/interviews")
  const slug = APP_SLUG_BY_UUID[appId] ?? appId
  return _interviewRounds.filter((round) => round.appId === slug)
}

/**
 * Update an interview record (D3 / TRK-127). Only the allowlisted fields
 * (date, type, format, status) are mutable; id/appId are fixed. Non-permitted
 * keys are dropped defensively.
 *
 * REST: PATCH /applications/{appId}/interviews/{roundId} -> InterviewRound
 */
export async function patchInterviewRound(
  appId: string,
  roundId: string,
  patch: Partial<Pick<InterviewRound, "date" | "type" | "format" | "status">>,
): Promise<InterviewRound> {
  await begin("applications/:id/interviews/:roundId")
  const index = _interviewRounds.findIndex((round) => round.id === roundId)
  if (index === -1) {
    throw MockApiError.notFound(`applications/${appId}/interviews/${roundId}`)
  }
  const allowed: Partial<
    Pick<InterviewRound, "date" | "type" | "format" | "status">
  > = {}
  if (patch.date !== undefined) {
    allowed.date = patch.date
  }
  if (patch.type !== undefined) {
    allowed.type = patch.type
  }
  if (patch.format !== undefined) {
    allowed.format = patch.format
  }
  if (patch.status !== undefined) {
    allowed.status = patch.status
  }
  _interviewRounds[index] = { ..._interviewRounds[index], ...allowed }
  return _interviewRounds[index]
}

// ---------------------------------------------------------------------------
// Shortlist
// ---------------------------------------------------------------------------

/**
 * NOTE: `searchId` is the wiring seam for the future API -- the design only
 * ships one search's shortlist, so the param is currently ignored.
 */
export async function getShortlist(
  searchId?: string,
): Promise<readonly ShortlistEntry[]> {
  await begin("shortlist")
  if (searchId && searchId in SHORTLIST_BY_SEARCH) {
    return SHORTLIST_BY_SEARCH[searchId]
  }
  return _shortlist
}

/** Add a job to the shortlist (ORI-014). */
export async function addToShortlist(
  entry: Pick<
    ShortlistEntry,
    "company" | "role" | "location" | "compensation" | "match"
  > &
    Partial<Pick<ShortlistEntry, "jobId">>,
): Promise<ShortlistEntry> {
  await begin("shortlist")
  const newEntry: ShortlistEntry = {
    ...entry,
    saved: "just now",
    source: "you",
  }
  _shortlist.push(newEntry)
  return newEntry
}

/** Remove a job from the shortlist by role name (ORI-014). */
export async function dismissFromShortlist(entryRole: string): Promise<void> {
  await begin("shortlist")
  const index = _shortlist.findIndex((entry) => entry.role === entryRole)
  if (index !== -1) {
    _shortlist.splice(index, 1)
  }
}

// ---------------------------------------------------------------------------
// Jobs inbox
// ---------------------------------------------------------------------------

export async function getJobsInbox(
  searchId?: string,
): Promise<readonly JobInboxItem[]> {
  await begin("jobs/inbox")
  if (searchId && searchId in INBOX_BY_SEARCH) {
    return INBOX_BY_SEARCH[searchId]
  }
  return JOBS_INBOX
}

// ---------------------------------------------------------------------------
// Jobs (ADR-006: first-class posting resource)
// ---------------------------------------------------------------------------

/** All captured jobs (the canonical posting collection). */
export async function getJobs(): Promise<readonly Job[]> {
  await begin("jobs")
  return JOBS
}

/** A single captured job by UUID. Drives the standalone `/jobs/:id` detail page.
 *  Resolves seeded postings, application-derived postings, and runtime-created
 *  postings (createApplication) -- so the app-detail "View job posting" hop works. */
export async function getJob(id: string): Promise<Job> {
  await begin("jobs/:id")
  const hit = jobLookup()[id]
  if (!hit) {
    throw MockApiError.notFound(`jobs/${id}`)
  }
  return hit
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function getAgents(): Promise<readonly Agent[]> {
  await begin("agents")
  return _agents
}

export async function getAgent(id: string): Promise<Agent> {
  const path = "agents/:id"
  await begin(path)
  const hit = _agents.find((agent) => agent.id === id)
  if (!hit) {
    throw MockApiError.notFound(`agents/${id}`)
  }
  return hit
}

/** Patch an agent's mutable fields (ORI-014 Pause / Run now). */
export async function patchAgent(
  id: string,
  patch: Partial<Pick<Agent, "state" | "stateLabel" | "live">>,
): Promise<Agent> {
  await begin("agents/:id")
  const index = _agents.findIndex((agent) => agent.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`agents/${id}`)
  }
  _agents[index] = { ..._agents[index], ...patch }
  return _agents[index]
}

export async function getAgentLog(
  filter?: AgentLogFilter,
): Promise<readonly AgentLogEntry[]> {
  await begin("agents/log")
  if (!filter) {
    return AGENT_LOG
  }
  return AGENT_LOG.filter((entry) => {
    if (filter.agentId && entry.agentId !== filter.agentId) {
      return false
    }
    if (filter.kind && entry.kind !== filter.kind) {
      return false
    }
    return true
  })
}

/**
 * Per-agent permissions (AGT-023). Each grant is enriched with its `requiredTier`
 * (D25 / AGT-031) so the UI can soft-gate above-tier permissions. Unknown
 * permissions default to 'observe' (ungated).
 *
 * REST: GET /agents/{id}/permissions
 */
export async function getAgentPermissions(
  agentId: string,
): Promise<readonly AgentPermission[]> {
  await begin("agents/:id/permissions")
  const perms = PER_AGENT_PERMISSIONS[agentId] ?? []
  return perms.map((p) => ({
    ...p,
    requiredTier:
      p.requiredTier ?? PERMISSION_REQUIRED_TIER[p.permission] ?? "observe",
  }))
}

/**
 * Agent trust standing + the full ladder for display (D25 / AGT-031).
 *
 * REST: GET /agents/{id}/trust-tier -> AgentTrustTierView
 */
export async function getAgentTrustTier(
  agentId: string,
): Promise<AgentTrustTierView> {
  await begin("agents/:id/trust-tier")
  const agent = _agents.find((a) => a.id === agentId)
  if (!agent) {
    throw MockApiError.notFound(`agents/${agentId}/trust-tier`)
  }
  return {
    agentId,
    currentTier: agent.trustTier ?? "observe",
    ladder: TRUST_TIER_LADDER,
  }
}

/**
 * Set an agent's trust tier (D25 / AGT-031). Soft-gate: the mock grants
 * immediately; a real backend may return status 'pending' for review. The UI
 * frames the request as backend-gated regardless.
 *
 * REST: PATCH /agents/{id}/trust-tier  body {targetTier} -> AgentTrustTierUpdate
 */
export async function patchAgentTrustTier(
  agentId: string,
  targetTier: AgentTrustTier,
): Promise<AgentTrustTierUpdate> {
  await begin("agents/:id/trust-tier")
  const index = _agents.findIndex((a) => a.id === agentId)
  if (index === -1) {
    throw MockApiError.notFound(`agents/${agentId}/trust-tier`)
  }
  _agents[index] = { ..._agents[index], trustTier: targetTier }
  return {
    agentId,
    currentTier: targetTier,
    status: "granted",
    message: `Trust tier set to ${targetTier}.`,
  }
}

// ---------------------------------------------------------------------------
// Resumes
// ---------------------------------------------------------------------------

export async function getResumes(): Promise<readonly Resume[]> {
  await begin("resumes")
  return _resumes
}

/**
 * D21: toggle whether a (master) resume participates in match scoring. Default
 * ON; turning masters off shrinks the eligible scoring set.
 *
 * REST: PATCH /resumes/{id}  body {scoringEnabled} -> Resume
 */
export async function patchResumeScoring(
  id: string,
  scoringEnabled: boolean,
): Promise<Resume> {
  await begin("resumes/:id")
  const index = _resumes.findIndex((resume) => resume.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`resumes/${id}`)
  }
  _resumes[index] = { ..._resumes[index], scoringEnabled }
  return _resumes[index]
}

export async function getResume(nameOrId: string | number): Promise<Resume> {
  const path = "resumes/:nameOrId"
  await begin(path)
  if (typeof nameOrId === "number") {
    const hit = _resumes[nameOrId]
    if (!hit) {
      throw MockApiError.notFound(`resumes/${nameOrId}`)
    }
    return hit
  }
  // Try id first, then name for backwards compat
  const hit =
    _resumes.find((resume) => resume.id === nameOrId) ??
    _resumes.find((resume) => resume.name === nameOrId)
  if (!hit) {
    throw MockApiError.notFound(`resumes/${nameOrId}`)
  }
  return hit
}

/** Create a new blank draft resume (RES-019). */
export async function createResume(): Promise<Resume> {
  await begin("resumes/create")
  const newResume: Resume = {
    id: crypto.randomUUID(),
    name: "Untitled revision",
    subtitle: "",
    version: "v1",
    usedIn: 0,
    updated: "just now",
    tag: "DRAFT",
    body: "",
  }
  _resumes.push(newResume)
  return newResume
}

/** Rename a resume by id (RES-019). */
export async function renameResume(id: string, name: string): Promise<Resume> {
  await begin("resumes/:id/rename")
  const index = _resumes.findIndex((resume) => resume.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`resumes/${id}`)
  }
  _resumes[index] = { ..._resumes[index], name }
  return _resumes[index]
}

/**
 * Persist a resume's edited body (RES-022). `body` is the editor's serialized
 * HTML so formatting round-trips. Swap-seam: this is the `PATCH /resume/:id`
 * the real backend implements. Mockup persistence lives in `_resumes` (session
 * only; cleared on reload / `__resetForTests`).
 */
export async function saveResumeBody(
  id: string,
  body: string,
): Promise<Resume> {
  await begin("resumes/:id/save")
  const index = _resumes.findIndex((resume) => resume.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`resumes/${id}`)
  }
  _resumes[index] = { ..._resumes[index], body }
  return _resumes[index]
}

/** Duplicate a resume (RES-019). */
export async function duplicateResume(id: string): Promise<Resume> {
  await begin("resumes/:id/duplicate")
  const source = _resumes.find((resume) => resume.id === id)
  if (!source) {
    throw MockApiError.notFound(`resumes/${id}`)
  }
  const copy: Resume = {
    ...source,
    id: `${id}-copy-${Date.now()}`,
    name: `${source.name} (copy)`,
    tag: "DRAFT",
    usedIn: 0,
    updated: "just now",
  }
  _resumes.push(copy)
  return copy
}

/** Set a resume as the default (RES-019). */
export async function setDefaultResume(id: string): Promise<readonly Resume[]> {
  await begin("resumes/:id/set-default")
  const index = _resumes.findIndex((resume) => resume.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`resumes/${id}`)
  }
  _resumes = _resumes.map((resume) => ({
    ...resume,
    tag: resume.tag === "DEFAULT" ? ("VARIANT" as const) : resume.tag,
  }))
  _resumes[index] = { ..._resumes[index], tag: "DEFAULT" }
  return _resumes
}

/** Delete a resume (RES-019). Guards locked resumes. */
export async function deleteResume(id: string): Promise<void> {
  await begin("resumes/:id/delete")
  const resume = _resumes.find((resume) => resume.id === id)
  if (!resume) {
    throw MockApiError.notFound(`resumes/${id}`)
  }
  if (
    resume.tag === "TAILORED" ||
    resume.tag === "MASTER" ||
    resume.tag === "DEFAULT" ||
    resume.usedIn > 0
  ) {
    throw MockApiError.unknown(`resumes/${id}/delete`, "locked")
  }
  _resumes = _resumes.filter((resume) => resume.id !== id)
}

/** Fork a resume as a tailored draft for a job (CUR-020). */
export async function forkResumeAsDraft(
  basisId: string,
  jobId: string,
): Promise<Resume> {
  await begin("resumes/:id/fork")
  const basis = _resumes.find((resume) => resume.id === basisId)
  if (!basis) {
    throw MockApiError.notFound(`resumes/${basisId}`)
  }
  const fork: Resume = {
    ...basis,
    id: crypto.randomUUID(),
    name: `${basis.name} - tailored draft`,
    tag: "DRAFT",
    usedIn: 0,
    updated: "just now",
    body: basis.body,
  }
  // jobId is used for the seam -- in a real API this would associate the draft
  void jobId
  _resumes.push(fork)
  return fork
}

// ---------------------------------------------------------------------------
// Match report
// ---------------------------------------------------------------------------

/**
 * NOTE: the design renders only one match report (Wes x Stripe). For now,
 * `args` is ignored and the canonical fixture is returned. The seam stays so
 * the future API can fan this out by `(resumeId, jobId)`.
 */
export async function getMatchReport(args: {
  resumeId: string
  jobId: string
}): Promise<MatchReport> {
  await begin("match-report")
  return {
    resumeId: args.resumeId,
    jobId: args.jobId,
    score: MATCH_REPORT_META.score,
    rubric: [...MATCH_RUBRIC],
    gaps: [...MATCH_GAPS],
    strengths: [...MATCH_STRENGTHS],
  }
}

// ---------------------------------------------------------------------------
// Coach
// ---------------------------------------------------------------------------

export async function getCoachThreads(): Promise<readonly CoachThread[]> {
  await begin("coach/threads")
  return COACH_THREADS
}

export async function getCoachThread(id: string): Promise<{
  thread: CoachThread
  messages: readonly CoachMessage[]
  context: readonly ContextCard[]
}> {
  const path = "coach/threads/:id"
  await begin(path)
  const thread = COACH_THREADS.find((thread) => thread.id === id)
  if (!thread) {
    throw MockApiError.notFound(`coach/threads/${id}`)
  }
  // The design only realizes the active "stripe-followup" thread messages.
  // Other threads correctly return empty -- CUR-024 empty-state handles them.
  const messages = id === "stripe-followup" ? [...COACH_MESSAGES] : []
  // Per-thread context cards (COA-021). Falls back to canonical if unknown.
  const context = COACH_CONTEXT_BY_THREAD[id] ?? COACH_CONTEXT_CARDS
  return { thread, messages, context }
}

// ---------------------------------------------------------------------------
// Notifications (ORI-012 -- mutable read-state)
// ---------------------------------------------------------------------------

export async function getNotifications(): Promise<readonly Notification[]> {
  await begin("notifications")
  return _notifications
}

/** Mark a single notification as read (ORI-012). */
export async function markNotificationRead(id: string): Promise<Notification> {
  await begin("notifications/:id/read")
  const index = _notifications.findIndex(
    (notification) => notification.id === id,
  )
  if (index === -1) {
    throw MockApiError.notFound(`notifications/${id}`)
  }
  _notifications[index] = { ..._notifications[index], unread: false }
  return _notifications[index]
}

/** Mark all notifications as read (ORI-012). */
export async function markAllNotificationsRead(): Promise<
  readonly Notification[]
> {
  await begin("notifications/mark-all-read")
  _notifications = _notifications.map((notification) => ({
    ...notification,
    unread: false,
  }))
  return _notifications
}

// ---------------------------------------------------------------------------
// User menu rows
// ---------------------------------------------------------------------------

export async function getUserMenu(): Promise<readonly UserMenuRow[]> {
  await begin("user-menu")
  return USER_MENU_ROWS
}

// ---------------------------------------------------------------------------
// Searches (ADD-006, ADD-010)
// ---------------------------------------------------------------------------

export async function getSearches(): Promise<readonly Search[]> {
  await begin("searches")
  return _searches
}

export async function getSearch(id: string): Promise<Search> {
  const path = "searches/:id"
  await begin(path)
  const hit = _searches.find((search) => search.id === id)
  if (!hit) {
    throw MockApiError.notFound(`searches/${id}`)
  }
  return hit
}

/** Create a new saved search (ADD-010). */
export async function createSearch(input: CreateSearchInput): Promise<Search> {
  await begin("searches/create")
  const newSearch: Search = {
    id: crypto.randomUUID(),
    name: input.name,
    state: "active",
    eyebrow: `Saved search - started today`,
    criteria: { ...BLANK_CRITERIA, ...input.criteria },
    jobsInInbox: 0,
    activeApplications: 0,
    shortlisted: 0,
    offers: 0,
    spendMo: "$0.00",
  }
  _searches.push(newSearch)
  return newSearch
}

/** Update search criteria in-place (ADD-006). */
export async function updateSearchCriteria(
  input: UpdateSearchCriteriaInput,
): Promise<Search> {
  await begin("searches/:id")
  const index = _searches.findIndex((search) => search.id === input.id)
  if (index === -1) {
    throw MockApiError.notFound(`searches/${input.id}`)
  }
  _searches[index] = {
    ..._searches[index],
    criteria: { ..._searches[index].criteria, ...input.criteria },
  }
  return _searches[index]
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  await begin("settings")
  return {
    profile: {
      name: SETTINGS_PROFILE.name,
      email: SETTINGS_PROFILE.email,
      phone: SETTINGS_PROFILE.phone,
      timezone: SETTINGS_PROFILE.timezone,
      currentRole: SETTINGS_PROFILE.currentRole,
      targetTitles: [...SETTINGS_PROFILE.targetTitles],
      compFloor: SETTINGS_PROFILE.compFloor,
    },
    integrations: [...SETTINGS_INTEGRATIONS],
    providers: [...SETTINGS_PROVIDERS],
    routing: [...SETTINGS_ROUTING],
    usage: [...SETTINGS_USAGE],
    monthSpend: SETTINGS_USAGE_TOTALS.monthSpend,
    monthlyCap: SETTINGS_USAGE_TOTALS.monthlyCap,
    privacy: [...SETTINGS_PRIVACY],
    privacyLastUpdated: SETTINGS_PRIVACY_LAST_UPDATED,
    plan: {
      name: SETTINGS_PLAN.name,
      price: SETTINGS_PLAN.price,
      description: SETTINGS_PLAN.description,
      nextCharge: SETTINGS_PLAN.nextCharge,
    },
    invoices: [...SETTINGS_INVOICES],
    danger: [...SETTINGS_DANGER],
    notifPrefs: [...SETTINGS_NOTIFICATION_PREFS],
    extensionTokens: [...SETTINGS_EXTENSION_TOKENS],
    emailParserFallback: SETTINGS_EMAIL_PARSER_FALLBACK,
  }
}

// ---------------------------------------------------------------------------
// LLM cost transparency + deep match score (D8b / D9a)
// ---------------------------------------------------------------------------

/**
 * Parses a string representing a USD currency value and extracts the numeric amount.
 * Removes any non-numeric characters except for the decimal point, and converts the result to a number.
 *
 * @param {string} s - The string containing the USD currency value to parse.
 * @return {number} The numeric value extracted from the string. Returns 0 if the conversion fails.
 */
const parseUsd = (s: string): number => Number(s.replace(/[^0-9.]/g, "")) || 0

/**
 * Rounds a given number to two decimal places.
 *
 * @param {number} n - The number to be rounded.
 * @return {number} The number rounded to two decimal places.
 */
const round2 = (n: number): number => Math.round(n * 100) / 100

/** Current time as an ISO-8601 string (used for soft-delete markers, D24). */
const nowIso = (): string => new Date().toISOString()

/** Remaining monthly-cap headroom in USD (D8b). */
const capRemainingUsd = (): number =>
  Math.max(
    0,
    parseUsd(SETTINGS_USAGE_TOTALS.monthlyCap) -
      parseUsd(SETTINGS_USAGE_TOTALS.monthSpend),
  )

/**
 * Cost preview for a deep (paid) match score across one or more master resumes
 * (D8b / D21). One itemized line per resume; free rough heuristic scores never
 * appear here.
 *
 * REST: POST /jobs/{id}/preview-deep-score  body {resumeNames} -> CostPreview
 */
export async function previewDeepMatchScore(
  jobId: string,
  resumeNames: readonly string[],
): Promise<CostPreview> {
  await begin("jobs/:id/preview-deep-score")
  void jobId
  const unit = LLM_TASK_COST_USD["deep-match-score"] ?? 0.14
  const model =
    SETTINGS_ROUTING.find((row) => row.label === "Match scoring")?.value ??
    "gemini-1.5-pro"
  const items = resumeNames.map((name) => ({
    label: `Deep match score -- ${name}`,
    model,
    estCostUsd: unit,
  }))
  const totalUsd = round2(items.reduce((sum, item) => sum + item.estCostUsd, 0))
  const remaining = round2(capRemainingUsd())
  return {
    items,
    totalUsd,
    capRemainingUsd: remaining,
    overCap: totalUsd > remaining,
  }
}

/**
 * Run a deep (paid) match score (D8 deep variant / D9a). Completes on the chosen
 * provider; if the monthly cap is reached it throws `cap_reached` so the UI can
 * re-consent -- never a silent model downgrade. Force the cap path in the mock
 * with VITE_MOCK_FAIL=`jobs/:id/deep-score:cap_reached`.
 *
 * REST: POST /jobs/{id}/deep-score  body {resumeName} -> DeepMatchResult
 */
export async function runDeepMatchScore(
  jobId: string,
  resumeName: string,
): Promise<DeepMatchResult> {
  await begin("jobs/:id/deep-score")
  const job = JOBS_BY_ID[jobId]
  const base = job?.match?.score ?? 80
  return {
    jobId,
    resumeId: resumeName,
    score: Math.min(99, base + 3),
    kind: "deep",
    strengths: job?.match?.strengths ?? [
      "Direct experience with the core stack",
    ],
    gaps: job?.match?.gaps ?? ["Lighter coverage on one secondary requirement"],
    costUsd: LLM_TASK_COST_USD["deep-match-score"] ?? 0.14,
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export async function getExtensionState(state: ExtensionState): Promise<{
  state: ExtensionState
  label: string
  recentCaptures: readonly ExtensionRecentCapture[]
}> {
  const path = "extension/:state"
  await begin(path)
  const hit = EXTENSION_STATES.find(
    (extensionState) => extensionState.state === state,
  )
  if (!hit) {
    throw MockApiError.notFound(`extension/${state}`)
  }
  return {
    state: hit.state,
    label: hit.label,
    // Only the "empty" state's popup renders recent captures in the design;
    // surface them uniformly so the consumer can choose to render or not.
    recentCaptures: hit.state === "empty" ? EXTENSION_RECENT_CAPTURES : [],
  }
}

// ---------------------------------------------------------------------------
// Usage aggregate (SET-billing)
// ---------------------------------------------------------------------------

/**
 * Returns the aggregated token-usage summary for the current billing period.
 * Values are derived from SETTINGS_USAGE_TOTALS + SETTINGS_USAGE_META.
 */
export async function getUsageAggregate(): Promise<UsageAggregate> {
  await begin("usage-aggregate")
  return {
    monthSpend: SETTINGS_USAGE_TOTALS.monthSpend,
    monthlyCap: SETTINGS_USAGE_TOTALS.monthlyCap,
    tokensIn: SETTINGS_USAGE_META.tokensIn,
    tokensOut: SETTINGS_USAGE_META.tokensOut,
    avgPerSession: SETTINGS_USAGE_META.avgPerSession,
  }
}

// ---------------------------------------------------------------------------
// Review queue -- approve / reject (AGT-021)
// ---------------------------------------------------------------------------

/**
 * Returns all agent-log entries that are awaiting human approval.
 * In the mockup this is a filtered view over AGENT_LOG (kind === 'await').
 */
export async function getReviewQueue(): Promise<readonly ReviewQueueItem[]> {
  await begin("agents/review-queue")
  return AGENT_LOG.filter((entry) => entry.kind === "await").map((entry) => ({
    ref: entry.ref,
    agentId: entry.agentId,
    message: entry.message,
    time: entry.time,
  }))
}

/**
 * Approve a queued agent action by its `ref` string.
 * In the mockup the action is acknowledged; no persistent state change.
 */
export async function approveAgentAction(ref: string): Promise<void> {
  await begin("agents/review-queue/:ref/approve")
  // Mockup: no-op beyond latency + failure injection. Real API would POST.
  void ref
}

/**
 * Reject a queued agent action by its `ref` string.
 * In the mockup the action is dismissed; no persistent state change.
 */
export async function rejectAgentAction(ref: string): Promise<void> {
  await begin("agents/review-queue/:ref/reject")
  // Mockup: no-op beyond latency + failure injection. Real API would POST.
  void ref
}

// ---------------------------------------------------------------------------
// Data export (ACC-export)
// ---------------------------------------------------------------------------

/**
 * Request a full account data export. Returns a fake signed URL.
 * Real API: POST /account/data-export -> { url, expiresAt }
 */
export async function requestDataExport(): Promise<DataExportRequest> {
  await begin("account/data-export")
  return {
    url: `https://export.employa.app/download/${crypto.randomUUID()}.zip`,
    requestedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Account deletion (ACC-danger)
// ---------------------------------------------------------------------------

/**
 * Initiate account deletion. In the mockup this is acknowledged immediately
 * with a 30-day grace period stub. Real API: POST /account/delete.
 */
export async function deleteAccount(): Promise<{ gracePeriodEndsAt: string }> {
  await begin("account/delete")
  const grace = new Date()
  grace.setDate(grace.getDate() + 30)
  return { gracePeriodEndsAt: grace.toISOString().slice(0, 10) }
}

// ---------------------------------------------------------------------------
// Resume mutations -- convenience re-exports for hook naming clarity
// (already declared above; this comment is a seam marker for the RESUMES cluster)
// Budget-bar convenience (used by the BudgetBar atom synchronously)
// ---------------------------------------------------------------------------

/** Synchronous budget snapshot -- avoids an async round-trip for the sidebar. */
export function getBudgetSnapshot(): { used: number; total: number } {
  return { used: BUDGET_USED, total: BUDGET_TOTAL }
}

// ---------------------------------------------------------------------------
// Test surface
// ---------------------------------------------------------------------------

/** Reset all mutable stores back to their fixture seeds. Called between tests. */
// ---------------------------------------------------------------------------
// Library artifacts -- Contacts (CON-001/002)
// ---------------------------------------------------------------------------

export async function getContacts(): Promise<readonly Contact[]> {
  await begin("contacts")
  // D24: soft-deleted items are excluded from the live list (they live in trash).
  return _contacts.filter((c) => !c.deletedAt)
}

export async function getContact(id: string): Promise<Contact> {
  await begin("contacts/:id")
  const hit = _contacts.find((c) => c.id === id)
  if (!hit) {
    throw MockApiError.notFound(`contacts/${id}`)
  }
  return hit
}

export type ContactDraft = Omit<Contact, "id" | "updated">

export async function createContact(draft: ContactDraft): Promise<Contact> {
  await begin("contacts/create")
  const created: Contact = {
    ...draft,
    id: crypto.randomUUID(),
    updated: "just now",
  }
  _contacts.push(created)
  return created
}

export async function updateContact(
  id: string,
  patch: Partial<ContactDraft>,
): Promise<Contact> {
  await begin("contacts/:id/update")
  const index = _contacts.findIndex((c) => c.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`contacts/${id}`)
  }
  _contacts[index] = { ..._contacts[index], ...patch, updated: "just now" }
  return _contacts[index]
}

export async function deleteContact(id: string): Promise<void> {
  await begin("contacts/:id/delete")
  // D24: soft delete -- mark, do not remove. Recoverable from trash.
  _contacts = _contacts.map((c) =>
    c.id === id ? { ...c, deletedAt: nowIso() } : c,
  )
}

// ---------------------------------------------------------------------------
// Library artifacts -- Accomplishments (ACC-001/002/003)
// ---------------------------------------------------------------------------

export async function getAccomplishments(): Promise<readonly Accomplishment[]> {
  await begin("accomplishments")
  return _accomplishments.filter((a) => !a.deletedAt)
}

export type AccomplishmentDraft = Omit<
  Accomplishment,
  "id" | "updated" | "usedIn"
>

export async function createAccomplishment(
  draft: AccomplishmentDraft,
): Promise<Accomplishment> {
  await begin("accomplishments/create")
  const created: Accomplishment = {
    ...draft,
    id: crypto.randomUUID(),
    usedIn: 0,
    updated: "just now",
  }
  _accomplishments.push(created)
  return created
}

export async function updateAccomplishment(
  id: string,
  patch: Partial<AccomplishmentDraft>,
): Promise<Accomplishment> {
  await begin("accomplishments/:id/update")
  const index = _accomplishments.findIndex((a) => a.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`accomplishments/${id}`)
  }
  _accomplishments[index] = {
    ..._accomplishments[index],
    ...patch,
    updated: "just now",
  }
  return _accomplishments[index]
}

export async function deleteAccomplishment(id: string): Promise<void> {
  await begin("accomplishments/:id/delete")
  _accomplishments = _accomplishments.map((a) =>
    a.id === id ? { ...a, deletedAt: nowIso() } : a,
  )
}

/** ACC-002: distill a Project into a NEW accomplishment (snapshot + backlink, not live-bound). */
export async function deriveAccomplishmentFromProject(
  projectId: string,
): Promise<Accomplishment> {
  await begin("accomplishments/derive-from-project")
  const project = _projects.find((p) => p.id === projectId)
  if (!project) {
    throw MockApiError.notFound(`projects/${projectId}`)
  }
  const created: Accomplishment = {
    id: crypto.randomUUID(),
    title: project.title,
    summary: project.body.slice(0, 160),
    tags: project.tags,
    source: { projectId },
    usedIn: 0,
    updated: "just now",
  }
  _accomplishments.push(created)
  return created
}

// ---------------------------------------------------------------------------
// Library artifacts -- Answers (ANS-001)
// ---------------------------------------------------------------------------

export async function getAnswers(): Promise<readonly Answer[]> {
  await begin("answers")
  return _answers.filter((a) => !a.deletedAt)
}

export type AnswerDraft = Omit<Answer, "id" | "updated">

export async function createAnswer(draft: AnswerDraft): Promise<Answer> {
  await begin("answers/create")
  const created: Answer = {
    ...draft,
    id: crypto.randomUUID(),
    updated: "just now",
  }
  _answers.push(created)
  return created
}

export async function updateAnswer(
  id: string,
  patch: Partial<AnswerDraft>,
): Promise<Answer> {
  await begin("answers/:id/update")
  const index = _answers.findIndex((a) => a.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`answers/${id}`)
  }
  _answers[index] = { ..._answers[index], ...patch, updated: "just now" }
  return _answers[index]
}

export async function deleteAnswer(id: string): Promise<void> {
  await begin("answers/:id/delete")
  _answers = _answers.map((a) =>
    a.id === id ? { ...a, deletedAt: nowIso() } : a,
  )
}

// ---------------------------------------------------------------------------
// Library artifacts -- Projects (PRJ-001)
// ---------------------------------------------------------------------------

export async function getProjects(): Promise<readonly Project[]> {
  await begin("projects")
  return _projects.filter((p) => !p.deletedAt)
}

export type ProjectDraft = Omit<Project, "id" | "updated">

export async function createProject(draft: ProjectDraft): Promise<Project> {
  await begin("projects/create")
  const created: Project = {
    ...draft,
    id: crypto.randomUUID(),
    updated: "just now",
  }
  _projects.push(created)
  return created
}

export async function updateProject(
  id: string,
  patch: Partial<ProjectDraft>,
): Promise<Project> {
  await begin("projects/:id/update")
  const index = _projects.findIndex((p) => p.id === id)
  if (index === -1) {
    throw MockApiError.notFound(`projects/${id}`)
  }
  _projects[index] = { ..._projects[index], ...patch, updated: "just now" }
  return _projects[index]
}

export async function deleteProject(id: string): Promise<void> {
  await begin("projects/:id/delete")
  _projects = _projects.map((p) =>
    p.id === id ? { ...p, deletedAt: nowIso() } : p,
  )
}

// ---------------------------------------------------------------------------
// Library trash: restore / purge / deletion-impact (D24)
// ---------------------------------------------------------------------------

/**
 * All soft-deleted bounded Library entities, newest-deleted first.
 */
export async function getTrash(): Promise<readonly TrashEntry[]> {
  await begin("library/trash")
  const entries: TrashEntry[] = [
    ..._contacts.flatMap((c) =>
      c.deletedAt
        ? [
            {
              kind: "contact" as const,
              id: c.id,
              label: c.name,
              deletedAt: c.deletedAt,
            },
          ]
        : [],
    ),
    ..._accomplishments.flatMap((a) =>
      a.deletedAt
        ? [
            {
              kind: "accomplishment" as const,
              id: a.id,
              label: a.title,
              deletedAt: a.deletedAt,
            },
          ]
        : [],
    ),
    ..._answers.flatMap((a) =>
      a.deletedAt
        ? [
            {
              kind: "answer" as const,
              id: a.id,
              label: a.question,
              deletedAt: a.deletedAt,
            },
          ]
        : [],
    ),
    ..._projects.flatMap((p) =>
      p.deletedAt
        ? [
            {
              kind: "project" as const,
              id: p.id,
              label: p.title,
              deletedAt: p.deletedAt,
            },
          ]
        : [],
    ),
  ]
  return entries.sort((x, y) => (x.deletedAt < y.deletedAt ? 1 : -1))
}

/**
 * Restore a soft-deleted Library item (D24).
 * REST: POST /library/{kind}/{id}/restore
 */
export async function restoreLibraryItem(
  kind: LibraryKind,
  id: string,
): Promise<void> {
  await begin("library/:kind/:id/restore")
  const clear = <T extends { id: string; deletedAt?: string }>(
    items: T[],
  ): T[] =>
    items.map((item) =>
      item.id === id ? { ...item, deletedAt: undefined } : item,
    )
  if (kind === "contact") {
    _contacts = clear(_contacts)
  } else if (kind === "accomplishment") {
    _accomplishments = clear(_accomplishments)
  } else if (kind === "answer") {
    _answers = clear(_answers)
  } else {
    _projects = clear(_projects)
  }
}

/**
 * Permanently purge a soft-deleted Library item -- frees its quota (D24).
 * REST: DELETE /library/{kind}/{id}/purge
 */
export async function purgeLibraryItem(
  kind: LibraryKind,
  id: string,
): Promise<void> {
  await begin("library/:kind/:id/purge")
  if (kind === "contact") {
    _contacts = _contacts.filter((c) => c.id !== id)
  } else if (kind === "accomplishment") {
    _accomplishments = _accomplishments.filter((a) => a.id !== id)
  } else if (kind === "answer") {
    _answers = _answers.filter((a) => a.id !== id)
  } else {
    _projects = _projects.filter((p) => p.id !== id)
  }
}

/**
 * Dependent-count report for a delete (D24). Drives the typed-count confirm
 * dialog -- shows what references this item before the user commits.
 *
 * REST: GET /library/{kind}/{id}/deletion-impact -> DeletionImpact
 */
export async function getDeletionImpact(
  kind: LibraryKind,
  id: string,
): Promise<DeletionImpact> {
  await begin("library/:kind/:id/deletion-impact")
  const dependents: {
    kind: LibraryKind
    count: number
    items: { id: string; label: string }[]
  }[] = []
  if (kind === "project") {
    // Accomplishments distilled from this project reference it (ACC-002).
    const items = _accomplishments
      .filter((a) => !a.deletedAt && a.source?.projectId === id)
      .map((a) => ({ id: a.id, label: a.title }))
    if (items.length > 0) {
      dependents.push({ kind: "accomplishment", count: items.length, items })
    }
  }
  const total = dependents.reduce((sum, d) => sum + d.count, 0)
  return { kind, id, dependents, total }
}

// ---------------------------------------------------------------------------
// Library artifacts -- Credentials (CRD-001, Post-MVP)
// ---------------------------------------------------------------------------

export async function getCredentials(): Promise<readonly Credential[]> {
  await begin("credentials")
  return _credentials
}

// ---------------------------------------------------------------------------
// Resume lifecycle -- uploads / career history / projections / exports / templates
// ---------------------------------------------------------------------------

export async function getResumeUploads(): Promise<readonly ResumeUpload[]> {
  await begin("resumes/uploads")
  return _resumeUploads
}

export async function getCareerHistory(): Promise<
  readonly CareerHistoryItem[]
> {
  await begin("career-history")
  return [..._careerHistory].sort((a, b) => a.ordinal - b.ordinal)
}

export async function getResumeTemplates(): Promise<readonly ResumeTemplate[]> {
  await begin("resumes/templates")
  return RESUME_TEMPLATES
}

export async function getResumeExports(): Promise<readonly ResumeExport[]> {
  await begin("resumes/exports")
  return _resumeExports
}

/** RES-034: projections are the non-FORMAT resumes (masters/variants/tailored). */
export async function getProjections(): Promise<readonly Resume[]> {
  await begin("projections")
  return _resumes.filter((r) => r.tag !== "FORMAT")
}

/** RES-034/035: create a master/variant projection. New history never auto-injects (pinning). */
export async function createProjection(input: {
  name: string
  targetRole?: string
  itemIds: readonly string[]
  templateId?: string
  sourceUploadId?: string
}): Promise<Resume> {
  await begin("projections/create")
  const created: Resume = {
    id: crypto.randomUUID(),
    name: input.name,
    subtitle: input.targetRole
      ? `For ${input.targetRole}`
      : "Projection over career history",
    version: "v1",
    usedIn: 0,
    updated: "just now",
    tag: "VARIANT",
    targetRole: input.targetRole,
    templateId: input.templateId ?? TEMPLATE_ID_CLASSIC,
    sourceUploadId: input.sourceUploadId,
    body: `Projection including ${input.itemIds.length} career-history items.`,
  }
  _resumes.push(created)
  return created
}

/** TPL-002: assign a template to a projection. */
export async function assignTemplate(
  projectionId: string,
  templateId: string,
): Promise<Resume> {
  await begin("projections/:id/template")
  const index = _resumes.findIndex((r) => r.id === projectionId)
  if (index === -1) {
    throw MockApiError.notFound(`projections/${projectionId}`)
  }
  _resumes[index] = { ..._resumes[index], templateId, updated: "just now" }
  return _resumes[index]
}

/** RES-037: render a projection through its template into a one-way export. */
export async function renderExport(
  projectionId: string,
): Promise<ResumeExport> {
  await begin("exports")
  const projection = _resumes.find((r) => r.id === projectionId)
  if (!projection) {
    throw MockApiError.notFound(`projections/${projectionId}`)
  }
  const created: ResumeExport = {
    id: crypto.randomUUID(),
    projectionId,
    templateId: projection.templateId ?? TEMPLATE_ID_CLASSIC,
    templateVersion: "v1",
    filename: `${projection.name.replace(/\s+/g, "_")}.pdf`,
    generatedAt: "just now",
    regenerable: true,
  }
  _resumeExports.push(created)
  return created
}

/**
 * RES-037 / D17: regenerate creates a NEW export at the current template version.
 * The original export keeps its own (templateVersion + date) provenance -- a
 * regenerate never silently restyles an old export.
 *
 * REST: POST /exports/{id}/regenerate -> ResumeExport (the freshly created one)
 */
export async function regenerateExport(
  exportId: string,
): Promise<ResumeExport> {
  await begin("exports/:id/regenerate")
  const source = _resumeExports.find((e) => e.id === exportId)
  if (!source) {
    throw MockApiError.notFound(`exports/${exportId}`)
  }
  const created: ResumeExport = {
    ...source,
    id: crypto.randomUUID(),
    templateVersion: "v2",
    generatedAt: "just now",
  }
  _resumeExports.push(created)
  return created
}

// ---------------------------------------------------------------------------
// Coach -- omnipresent panel (COA-031/032/036)
// ---------------------------------------------------------------------------

export async function getCoachGreeting(
  scope: CoachThreadScope,
): Promise<CoachGreeting> {
  await begin("coach/greeting")
  return COACH_GREETING_BY_SCOPE[scope] ?? COACH_GREETING_BY_SCOPE.general
}

/** COA-032: mock "the assistant drafts a change" -- returns a canned pending proposal. */
export async function proposeCoachEdit(
  subject: CoachSubject,
): Promise<CoachProposal> {
  await begin("coach/proposals")
  const canned =
    COACH_PROPOSAL_FIXTURES[subject.scope] ?? COACH_PROPOSAL_FIXTURES["résumé"]
  return { ...canned, id: crypto.randomUUID(), subject, status: "pending" }
}

/**
 * COA-032 gate 2 / COA-033 / COA-036: persist an accepted proposal. Routes through
 * the SAME store the user's own save does (so locks/append-only apply) and returns
 * an attributed audit event ("Coach, on behalf of you").
 */
export async function saveCoachProposal(
  proposal: CoachProposal,
): Promise<TimelineEvent> {
  await begin("coach/proposals/:id/accept")
  // If the subject is a resume/projection we hold, persist the diff's `after` text
  // through the same path saveResumeBody uses (COA-033: no special bypass).
  if (
    (proposal.subject.scope === "résumé" ||
      proposal.subject.scope === "projection") &&
    proposal.subject.id
  ) {
    const index = _resumes.findIndex((r) => r.id === proposal.subject.id)
    if (index !== -1) {
      const applied = proposal.diff.map((d) => d.after).join(" ")
      _resumes[index] = {
        ..._resumes[index],
        body: applied,
        updated: "just now",
      }
    }
  }
  return {
    id: crypto.randomUUID(),
    time: "just now",
    who: "Coach",
    actor: "coach-on-behalf",
    message: proposal.summary,
    badge: "Coach",
  }
}

export function __resetForTests(): void {
  _notifications = [...NOTIFICATIONS]
  _resumes = [...RESUMES]
  _agents = [...AGENTS_DATA]
  _shortlist = [...SHORTLIST_DATA]
  _apps = [...APPS]
  _appsRemote = [...APPS_BACKEND]
  _appsAiInfra = [...APPS_AI_INFRA]
  _searches = [...SEARCHES]
  _archive = [...ARCHIVE_APPS]
  _interviewRounds = [...INTERVIEW_ROUNDS]
  _dynamicJobs = {}
  _contacts = [...CONTACTS]
  _accomplishments = [...ACCOMPLISHMENTS]
  _answers = [...ANSWERS]
  _projects = [...PROJECTS]
  _credentials = [...CREDENTIALS]
  _resumeUploads = [...RESUME_UPLOADS]
  _careerHistory = [...CAREER_HISTORY]
  _resumeExports = [...RESUME_EXPORTS]
}
