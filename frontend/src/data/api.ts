/**
 * Data seam -- HTTP adapter against the scaffold FastAPI backend.
 *
 * Consumers MUST go through `src/hooks/`. This file is the swap-seam: every
 * exported function keeps its old signature (hooks/screens/tests are unchanged)
 * but the body now speaks HTTP against the frozen `mvp-api.yaml` contract
 * (`/api/v1/...`, camelCase wire, ISO-8601 timestamps, USD numbers, the
 * 12-value stage machine, machine-token enums, `{kind, path, message}` errors).
 *
 * The wire<->app difference is absorbed by `./wire` (scalar transforms +
 * client-owned presentation constants) and the per-op mappers below; app-facing
 * shapes come straight from the frozen `./types`.
 */

import { httpErrorToMockApiError, MockApiError } from "../lib/mock-api-error"
import { formatSalary } from "../lib/salary"
import {
  BUDGET_TOTAL,
  BUDGET_USED,
  COACH_GREETING_BY_SCOPE,
  DANGER_ACTIONS,
  EXTENSION_RECENT_CAPTURES,
  EXTENSION_STATE_LABELS,
  USER_MENU_ROWS,
} from "./client-constants"
import type {
  Accomplishment,
  Agent,
  AgentLogEntry,
  AgentLogFilter,
  AgentPermission,
  AgentState,
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
  CostPreviewItem,
  CreateSearchInput,
  Credential,
  DataExportRequest,
  DeepMatchResult,
  DeletionImpact,
  ExtensionRecentCapture,
  ExtensionState,
  IntegrationRow,
  InterviewRound,
  Job,
  JobInboxItem,
  LibraryKind,
  MatchReport,
  Notification,
  NotifPref,
  PrivacyToggle,
  Project,
  ProviderRow,
  Resume,
  ResumeExport,
  ResumeSnapshot,
  ResumeTemplate,
  ResumeUpload,
  ReviewQueueItem,
  RoutingRow,
  Salary,
  Search,
  SearchCriteria,
  Settings,
  ShortlistEntry,
  Stage,
  TimelineEvent,
  TrashEntry,
  UpdateSearchCriteriaInput,
  UsageAggregate,
  UsageRow,
  User,
  UserMenuRow,
} from "./types"
import {
  abbreviateTokens,
  agentIcon,
  agentStateLabel,
  daysSince,
  displayToYearsBand,
  formatUsd,
  integrationIcon,
  moneyStringToNumber,
  notificationIcon,
  parseNegotiatedComp,
  privacyCopy,
  relativeAge,
  remotePolicyAppToWire,
  remotePolicyWireToApp,
  searchEyebrow,
  stageAppToWire,
  stageLabel,
  stageWireToApp,
  trustTierRung,
  type WireStage,
  yearsBandToDisplay,
} from "./wire"

// ===========================================================================
// HTTP core
// ===========================================================================

// Base URL follows the template convention: the generated OpenAPI client keys
// off `VITE_API_URL` (fed by compose/.env). Empty string => same-origin.
const API_ROOT = (import.meta.env.VITE_API_URL as string | undefined) ?? ""
const API_BASE = `${API_ROOT}/api/v1`

const TOKEN_KEY = "access_token"
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

/** Server-side CORS (BACKEND_CORS_ORIGINS) allows the dev origins; no proxy. */
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  const access_token: string | null = getToken()
  try {
    const hasBody = init?.body !== undefined && init?.body !== null
    const hasContentType = new Headers(init?.headers).has("Content-Type")
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(hasBody && !hasContentType
          ? { "Content-Type": "application/json" }
          : {}),
        ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    // fetch reject / DNS / TCP -> client-synthesized transport kind.
    throw MockApiError.network(path)
  }
  if (res.status === 204) {
    return undefined as T
  }
  if (!res.ok) {
    let body: {
      kind?: string
      path?: string
      message?: string
      detail?: string
    } | null = null
    try {
      body = (await res.json()) as {
        kind?: string
        message?: string
        detail?: string
      }
    } catch {
      body = null
    }
    // 401: no token sent at all (FastAPI's OAuth2PasswordBearer default).
    // 403 + this exact detail: token present but invalid/expired
    // (app.api.deps.get_current_user). Other 403s (e.g. "not enough
    // privileges") mean the user IS authenticated, just not authorized --
    // those must NOT clear the token or redirect.
    const isAuthFailure =
      res.status === 401 ||
      (res.status === 403 && body?.detail === "Could not validate credentials")
    if (isAuthFailure) {
      clearToken()
      if (window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }
    throw httpErrorToMockApiError(res.status, path, body)
  }
  try {
    return (await res.json()) as T
  } catch {
    return undefined as T
  }
}

function get<T>(path: string): Promise<T> {
  return call<T>(path)
}
function post<T>(path: string, body?: unknown): Promise<T> {
  return call<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
function formPost<T>(path: string, body?: unknown): Promise<T> {
  return call<T>(path, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
    body:
      body === undefined
        ? undefined
        : new URLSearchParams(body as Record<string, string>).toString(),
  })
}
function patch<T>(path: string, body?: unknown): Promise<T> {
  return call<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
function put<T>(path: string, body?: unknown): Promise<T> {
  return call<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
function del(path: string): Promise<void> {
  return call<void>(path, { method: "DELETE" })
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      sp.set(k, v)
    }
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

// ===========================================================================
// Wire response shapes (only where they differ from the app type)
// ===========================================================================

type WApplication = Omit<Application, "stage" | "stageLabel" | "days"> & {
  stage: string
  version: number
  createdAt: string
}
type WJob = Omit<Job, never>
type WResume = Resume
type WApplicationView = WApplication & {
  job: WJob
  resume: WResume | null
  company: string
  role: string
  location: string
  salary: Salary | null
  match: number
  source: string
  resumeName: string
}
type WAgent = Omit<Agent, "icon" | "stateLabel" | "cost"> & { costUsd: number }
type WShortlistEntry = Omit<ShortlistEntry, "compensation"> & {
  id: string
  salary: Salary | null
}
type WJobInboxItem = Omit<JobInboxItem, "compensation"> & {
  salary: Salary | null
}
type WSearchCriteria = Omit<
  SearchCriteria,
  "remotePolicy" | "baseFloor" | "baseCeiling" | "yearsExperience"
> & {
  remotePolicy: string
  baseFloorUsd: number
  baseCeilingUsd: number
  yearsExperienceMin?: number | null
  yearsExperienceMax?: number | null
}
type WSearch = Omit<Search, "eyebrow" | "spendMo" | "criteria"> & {
  spendMoUsd: number
  criteria: WSearchCriteria
}
type WTrustTierView = Omit<AgentTrustTierView, "ladder"> & {
  ladder: { tier: AgentTrustTier }[]
}
type WTimelineEvent = Omit<TimelineEvent, "badge">
type WReviewQueueItem = {
  id: string
  agentId: string
  message: string
  time: string
}
type WTrashEntry = TrashEntry

// ===========================================================================
// Wire -> app mappers
// ===========================================================================

function appJob(w: WJob): Job {
  return {
    ...w,
    posted: relativeAge(w.posted),
    source: { ...w.source, capturedAt: relativeAge(w.source.capturedAt) },
  }
}

function appResume(w: WResume): Resume {
  return { ...w, updated: relativeAge(w.updated) }
}

function appApplication(w: WApplication): Application {
  const stage: Stage = stageWireToApp(w.stage)
  return {
    ...w,
    stage,
    stageLabel: stageLabel(stage),
    days: daysSince(w.createdAt),
    outcomeAt: w.outcomeAt ? relativeAge(w.outcomeAt) : w.outcomeAt,
  }
}

function appApplicationView(w: WApplicationView): ApplicationView {
  return {
    ...appApplication(w),
    job: appJob(w.job),
    resume: w.resume ? appResume(w.resume) : null,
    company: w.company,
    role: w.role,
    location: w.location,
    salary: w.salary,
    match: w.match,
    source: w.source,
    resumeName: w.resumeName,
  }
}

function appAgent(w: WAgent): Agent {
  const { costUsd, ...rest } = w
  return {
    ...rest,
    icon: agentIcon(w.name),
    stateLabel: agentStateLabel(w.state),
    cost: formatUsd(costUsd),
    lastActivity: relativeAge(w.lastActivity),
  }
}

function appShortlistEntry(w: WShortlistEntry): ShortlistEntry {
  const { id: _id, salary, ...rest } = w
  void _id
  return {
    ...rest,
    compensation: formatSalary(salary),
    saved: relativeAge(w.saved),
  }
}

function appJobInboxItem(w: WJobInboxItem): JobInboxItem {
  const { salary, ...rest } = w
  return {
    ...rest,
    compensation: formatSalary(salary),
    posted: relativeAge(w.posted),
    capturedAt: w.capturedAt ? relativeAge(w.capturedAt) : w.capturedAt,
  }
}

function appCriteria(w: WSearchCriteria): SearchCriteria {
  return {
    titlesInclude: w.titlesInclude,
    titlesExclude: w.titlesExclude,
    locations: w.locations,
    remotePolicy: remotePolicyWireToApp(w.remotePolicy),
    maxCommuteMin: w.maxCommuteMin,
    baseFloor: formatUsd(w.baseFloorUsd),
    baseCeiling: formatUsd(w.baseCeilingUsd),
    yearsExperience: yearsBandToDisplay(
      w.yearsExperienceMin,
      w.yearsExperienceMax,
    ),
    scoringResumeIds: w.scoringResumeIds,
  }
}

function appSearch(w: WSearch): Search {
  const { spendMoUsd, criteria, ...rest } = w
  return {
    ...rest,
    eyebrow: searchEyebrow(w.state),
    spendMo: formatUsd(spendMoUsd),
    criteria: appCriteria(criteria),
  }
}

function appTimelineEvent(w: WTimelineEvent): TimelineEvent {
  return { ...w, time: relativeAge(w.time) }
}

// --- resume name/index resolution (backend is UUID-only; sec 5/9) ---

async function resolveResumeId(nameOrId: string | number): Promise<string> {
  if (typeof nameOrId === "number") {
    const list = await getResumes()
    const hit = list[nameOrId]
    if (!hit) {
      throw MockApiError.notFound(`resumes/${nameOrId}`)
    }
    return hit.id
  }
  if (isUuid(nameOrId)) {
    return nameOrId
  }
  const list = await getResumes()
  const hit =
    list.find((r) => r.id === nameOrId) ??
    list.find((r) => nameOrId.startsWith(r.name)) ??
    list.find((r) => r.name === nameOrId)
  if (!hit) {
    throw MockApiError.notFound(`resumes/${nameOrId}`)
  }
  return hit.id
}

// ===========================================================================
// User / persona
// ===========================================================================

interface RealUserPublic {
  email: string
  full_name: string | null
  initials: string | null
  city: string | null
  current: string | null
  years: number | null
  comp_floor: number | null
  target_titles: string[]
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export async function getCurrentUser(): Promise<User> {
  const u = await get<RealUserPublic>("/users/me")
  const name = u.full_name ?? u.email
  return {
    name,
    email: u.email,
    initials: u.initials ?? initialsFrom(name),
    city: u.city ?? "",
    current: u.current ?? "",
    years: u.years ?? 0,
    comp_floor: u.comp_floor ?? 0,
    target_titles: u.target_titles ?? [],
  }
}

interface AccessTokenResponse {
  access_token: string
  token_type: string
}

export async function login(username: string, password: string): Promise<void> {
  const { access_token } = await formPost<AccessTokenResponse>(
    "/login/access-token",
    { username, password },
  )
  setToken(access_token)
}

// ===========================================================================
// Applications
// ===========================================================================

export async function getApplications(
  searchId?: string,
): Promise<readonly ApplicationView[]> {
  const rows = await get<WApplicationView[]>(`/applications${qs({ searchId })}`)
  return rows.map(appApplicationView)
}

export async function getApplication(id: string): Promise<ApplicationView> {
  return appApplicationView(await get<WApplicationView>(`/applications/${id}`))
}

export async function getArchive(
  kind: "won" | "passed",
): Promise<readonly ApplicationView[]> {
  const rows = await get<WApplicationView[]>(`/archive${qs({ kind })}`)
  return rows.map(appApplicationView)
}

export function getArchiveCounts(): Promise<{ won: number; passed: number }> {
  return get<{ won: number; passed: number }>("/archive/counts")
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
  /** D15: target saved search. */
  searchId?: string
}

export async function createApplication(
  draft: CreateApplicationInput,
): Promise<ApplicationView> {
  let resumeId: string | null = null
  if (draft.resume) {
    try {
      resumeId = await resolveResumeId(draft.resume)
    } catch {
      resumeId = null
    }
  }
  const body = {
    company: draft.company,
    role: draft.role,
    location: draft.location,
    salary: draft.salary,
    match: draft.match,
    source: draft.source,
    resumeId,
    searchId: draft.searchId,
  }
  return appApplicationView(await post<WApplicationView>("/applications", body))
}

export async function getResumeSnapshot(
  appId: string,
): Promise<ResumeSnapshot> {
  const w = await get<ResumeSnapshot>(`/applications/${appId}/snapshot`)
  return { ...w, capturedAt: relativeAge(w.capturedAt) }
}

export interface MarkWonInput {
  startDate?: string
  negotiatedComp?: string
  whatWorked?: string
}

export interface MarkWonResult {
  application: ApplicationView
  undoToken: string
  undoExpiresAt: string
  undoWindowSeconds: number
}

export async function markWon(
  appId: string,
  input: MarkWonInput,
): Promise<MarkWonResult> {
  const body = {
    startDate: input.startDate,
    negotiatedComp: parseNegotiatedComp(input.negotiatedComp),
    whatWorked: input.whatWorked,
  }
  const w = await post<{
    application: WApplicationView
    undoToken: string
    undoExpiresAt: string
    undoWindowSeconds: number
  }>(`/applications/${appId}/mark-won`, body)
  return {
    application: appApplicationView(w.application),
    undoToken: w.undoToken,
    undoExpiresAt: w.undoExpiresAt,
    undoWindowSeconds: w.undoWindowSeconds,
  }
}

export async function undoMarkWon(
  appId: string,
  undoToken: string,
): Promise<ApplicationView> {
  const w = await post<WApplicationView>(
    `/applications/${appId}/undo-mark-won`,
    { undoToken },
  )
  return appApplicationView(w)
}

export async function reactivateApplication(
  appId: string,
): Promise<ApplicationView> {
  return appApplicationView(
    await post<WApplicationView>(`/applications/${appId}/reactivate`),
  )
}

export interface DismissResult {
  outcome: "removed" | "withdrew"
}

export function dismissApplication(
  appId: string,
  reasons?: readonly string[],
): Promise<DismissResult> {
  return post<DismissResult>(`/applications/${appId}/dismiss`, {
    reasons: reasons ?? undefined,
  })
}

// --- transitions (net-new contract op, sec 6a) ---

/** Input for the generic forward-transition op. `targetStage` is a wire stage. */
export interface TransitionInput {
  targetStage: WireStage | Stage
  expectedVersion: number
  source?: "user" | "user_correction" | "user_reactivation" | "system"
  reason?: string
  reasons?: readonly string[]
  resumeId?: string
}

/** One appended stage-transition audit row (app-shaped). */
export interface TransitionRecord {
  id: string
  applicationId: string
  fromStage: Stage | null
  toStage: Stage
  source: string
  reason?: string
  reasons?: readonly string[]
  resumeId?: string | null
  createdAt: string
}

export interface TransitionResult {
  application: ApplicationView
  transition: TransitionRecord
}

const WIRE_STAGES: readonly string[] = [
  "saved",
  "drafting",
  "applied",
  "screening",
  "interview",
  "offer",
  "won",
  "rejected",
  "ghosted",
  "withdrew",
  "dismissed",
  "offer_rescinded",
]

/**
 * Move an application along the settled stage machine (sec 6a). Accepts either
 * a wire stage token (won/withdrew/...) or an app Stage (draft/screen/...),
 * normalizing to the wire enum. `resumeId` is required when targeting `applied`.
 */
export async function transitionApplication(
  id: string,
  input: TransitionInput,
): Promise<TransitionResult> {
  const targetStage: WireStage = WIRE_STAGES.includes(input.targetStage)
    ? (input.targetStage as WireStage)
    : stageAppToWire(input.targetStage as Stage)
  const body = {
    targetStage,
    expectedVersion: input.expectedVersion,
    source: input.source,
    reason: input.reason,
    reasons: input.reasons,
    resumeId: input.resumeId,
  }
  const w = await post<{
    application: WApplicationView
    transition: {
      id: string
      applicationId: string
      fromStage: string | null
      toStage: string
      source: string
      reason?: string | null
      reasons?: string[] | null
      resumeId?: string | null
      createdAt: string
    }
  }>(`/applications/${id}/transitions`, body)
  return {
    application: appApplicationView(w.application),
    transition: {
      id: w.transition.id,
      applicationId: w.transition.applicationId,
      fromStage: w.transition.fromStage
        ? stageWireToApp(w.transition.fromStage)
        : null,
      toStage: stageWireToApp(w.transition.toStage),
      source: w.transition.source,
      reason: w.transition.reason ?? undefined,
      reasons: w.transition.reasons ?? undefined,
      resumeId: w.transition.resumeId ?? undefined,
      createdAt: relativeAge(w.transition.createdAt),
    },
  }
}

// ===========================================================================
// Application timeline / interviews
// ===========================================================================

export async function getApplicationTimeline(
  appId: string,
): Promise<readonly TimelineEvent[]> {
  const rows = await get<WTimelineEvent[]>(`/applications/${appId}/timeline`)
  return rows.map(appTimelineEvent)
}

export function getInterviewRounds(
  appId: string,
): Promise<readonly InterviewRound[]> {
  return get<InterviewRound[]>(`/applications/${appId}/interviews`)
}

export function patchInterviewRound(
  appId: string,
  roundId: string,
  patchBody: Partial<
    Pick<InterviewRound, "date" | "type" | "format" | "status">
  >,
): Promise<InterviewRound> {
  const body: Record<string, unknown> = {}
  if (patchBody.date !== undefined) body.date = patchBody.date
  if (patchBody.type !== undefined) body.type = patchBody.type
  if (patchBody.format !== undefined) body.format = patchBody.format
  if (patchBody.status !== undefined) body.status = patchBody.status
  return patch<InterviewRound>(
    `/applications/${appId}/interviews/${roundId}`,
    body,
  )
}

// ===========================================================================
// Shortlist
// ===========================================================================

export async function getShortlist(
  searchId?: string,
): Promise<readonly ShortlistEntry[]> {
  const rows = await get<WShortlistEntry[]>(`/shortlist${qs({ searchId })}`)
  return rows.map(appShortlistEntry)
}

export async function addToShortlist(
  entry: Pick<
    ShortlistEntry,
    "company" | "role" | "location" | "compensation" | "match"
  > &
    Partial<Pick<ShortlistEntry, "jobId">>,
): Promise<ShortlistEntry> {
  const body = {
    jobId: entry.jobId,
    company: entry.company,
    role: entry.role,
    location: entry.location,
    salary: parseNegotiatedComp(entry.compensation),
    match: entry.match,
  }
  return appShortlistEntry(await post<WShortlistEntry>("/shortlist", body))
}

/** Remove a shortlist entry by role (resolved client-side to its wire id). */
export async function dismissFromShortlist(entryRole: string): Promise<void> {
  const rows = await get<WShortlistEntry[]>("/shortlist")
  const hit = rows.find((r) => r.role === entryRole)
  if (!hit) {
    // Mock was idempotent; the entry is already gone.
    return
  }
  await del(`/shortlist/${hit.id}`)
}

// ===========================================================================
// Jobs
// ===========================================================================

export async function getJobsInbox(
  searchId?: string,
): Promise<readonly JobInboxItem[]> {
  const rows = await get<WJobInboxItem[]>(`/jobs/inbox${qs({ searchId })}`)
  return rows.map(appJobInboxItem)
}

export async function getJobs(): Promise<readonly Job[]> {
  const rows = await get<WJob[]>("/jobs")
  return rows.map(appJob)
}

export async function getJob(id: string): Promise<Job> {
  return appJob(await get<WJob>(`/jobs/${id}`))
}

// ===========================================================================
// Agents
// ===========================================================================

export async function getAgents(): Promise<readonly Agent[]> {
  const rows = await get<WAgent[]>("/agents")
  return rows.map(appAgent)
}

export async function getAgent(id: string): Promise<Agent> {
  return appAgent(await get<WAgent>(`/agents/${id}`))
}

export async function patchAgent(
  id: string,
  patchBody: Partial<Pick<Agent, "state" | "stateLabel" | "live">>,
): Promise<Agent> {
  const body: { state?: AgentState; live?: boolean } = {}
  if (patchBody.state !== undefined) body.state = patchBody.state
  if (patchBody.live !== undefined) body.live = patchBody.live
  return appAgent(await patch<WAgent>(`/agents/${id}`, body))
}

export async function getAgentLog(
  filter?: AgentLogFilter,
): Promise<readonly AgentLogEntry[]> {
  const rows = await get<AgentLogEntry[]>(
    `/agents/log${qs({ agentId: filter?.agentId, kind: filter?.kind })}`,
  )
  return rows.map((e) => ({ ...e, time: relativeAge(e.time) }))
}

export function getAgentPermissions(
  agentId: string,
): Promise<readonly AgentPermission[]> {
  return get<AgentPermission[]>(`/agents/${agentId}/permissions`)
}

export async function getAgentTrustTier(
  agentId: string,
): Promise<AgentTrustTierView> {
  const w = await get<WTrustTierView>(`/agents/${agentId}/trust-tier`)
  return {
    agentId: w.agentId,
    currentTier: w.currentTier,
    unlockedAt: w.unlockedAt ? relativeAge(w.unlockedAt) : undefined,
    ladder: w.ladder.map((r) => trustTierRung(r.tier)),
  }
}

export function patchAgentTrustTier(
  agentId: string,
  targetTier: AgentTrustTier,
): Promise<AgentTrustTierUpdate> {
  return patch<AgentTrustTierUpdate>(`/agents/${agentId}/trust-tier`, {
    targetTier,
  })
}

// ===========================================================================
// Resumes
// ===========================================================================

export async function getResumes(): Promise<readonly Resume[]> {
  const rows = await get<WResume[]>("/resumes")
  return rows.map(appResume)
}

export async function patchResumeScoring(
  id: string,
  scoringEnabled: boolean,
): Promise<Resume> {
  return appResume(await patch<WResume>(`/resumes/${id}`, { scoringEnabled }))
}

export async function getResume(nameOrId: string | number): Promise<Resume> {
  const id = await resolveResumeId(nameOrId)
  return appResume(await get<WResume>(`/resumes/${id}`))
}

export async function createResume(): Promise<Resume> {
  return appResume(await post<WResume>("/resumes"))
}

export async function renameResume(id: string, name: string): Promise<Resume> {
  return appResume(await patch<WResume>(`/resumes/${id}`, { name }))
}

export async function saveResumeBody(
  id: string,
  body: string,
): Promise<Resume> {
  return appResume(await patch<WResume>(`/resumes/${id}`, { body }))
}

export async function duplicateResume(id: string): Promise<Resume> {
  return appResume(await post<WResume>(`/resumes/${id}/duplicate`))
}

export async function setDefaultResume(id: string): Promise<readonly Resume[]> {
  const rows = await post<WResume[]>(`/resumes/${id}/set-default`)
  return rows.map(appResume)
}

export function deleteResume(id: string): Promise<void> {
  return del(`/resumes/${id}`)
}

export async function forkResumeAsDraft(
  basisId: string,
  jobId: string,
): Promise<Resume> {
  return appResume(await post<WResume>(`/resumes/${basisId}/fork`, { jobId }))
}

// ===========================================================================
// Match report
// ===========================================================================

export function getMatchReport(args: {
  resumeId: string
  jobId: string
}): Promise<MatchReport> {
  return get<MatchReport>(
    `/match-report${qs({ resumeId: args.resumeId, jobId: args.jobId })}`,
  )
}

// ===========================================================================
// Coach
// ===========================================================================

export async function getCoachThreads(): Promise<readonly CoachThread[]> {
  const rows = await get<CoachThread[]>("/coach/threads")
  return rows.map((t) => ({ ...t, when: relativeAge(t.when) }))
}

export async function getCoachThread(id: string): Promise<{
  thread: CoachThread
  messages: readonly CoachMessage[]
  context: readonly ContextCard[]
}> {
  const w = await get<{
    thread: CoachThread
    messages: CoachMessage[]
    context: ContextCard[]
  }>(`/coach/threads/${id}`)
  return {
    thread: { ...w.thread, when: relativeAge(w.thread.when) },
    messages: w.messages,
    context: w.context,
  }
}

export function getCoachGreeting(
  scope: CoachThreadScope,
): Promise<CoachGreeting> {
  // Founder ruling 2026-07-04: canned client copy, no HTTP.
  return Promise.resolve(
    COACH_GREETING_BY_SCOPE[scope] ?? COACH_GREETING_BY_SCOPE.general,
  )
}

export function proposeCoachEdit(
  subject: CoachSubject,
): Promise<CoachProposal> {
  return post<CoachProposal>("/coach/proposals", subject)
}

export async function saveCoachProposal(
  proposal: CoachProposal,
): Promise<TimelineEvent> {
  const w = await post<WTimelineEvent>(
    `/coach/proposals/${proposal.id}/accept`,
    proposal,
  )
  return appTimelineEvent(w)
}

// ===========================================================================
// Notifications
// ===========================================================================

export async function getNotifications(): Promise<readonly Notification[]> {
  const rows = await get<Omit<Notification, "icon">[]>("/notifications")
  return rows.map((n) => ({ ...n, icon: notificationIcon(n.kind, n.title) }))
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const n = await post<Omit<Notification, "icon">>(`/notifications/${id}/read`)
  return { ...n, icon: notificationIcon(n.kind, n.title) }
}

export async function markAllNotificationsRead(): Promise<
  readonly Notification[]
> {
  const rows = await post<Omit<Notification, "icon">[]>(
    "/notifications/mark-all-read",
  )
  return rows.map((n) => ({ ...n, icon: notificationIcon(n.kind, n.title) }))
}

// ===========================================================================
// User menu (client-local, no HTTP)
// ===========================================================================

export function getUserMenu(): Promise<readonly UserMenuRow[]> {
  return Promise.resolve(USER_MENU_ROWS)
}

// ===========================================================================
// Searches
// ===========================================================================

export async function getSearches(): Promise<readonly Search[]> {
  const rows = await get<WSearch[]>("/searches")
  return rows.map(appSearch)
}

export async function getSearch(id: string): Promise<Search> {
  return appSearch(await get<WSearch>(`/searches/${id}`))
}

function wireCriteria(c: Partial<SearchCriteria>): WSearchCriteria {
  const band = displayToYearsBand(c.yearsExperience)
  return {
    titlesInclude: c.titlesInclude ?? [],
    titlesExclude: c.titlesExclude ?? [],
    locations: c.locations ?? [],
    remotePolicy: remotePolicyAppToWire(c.remotePolicy ?? "OK"),
    maxCommuteMin: c.maxCommuteMin ?? 0,
    baseFloorUsd: moneyStringToNumber(c.baseFloor),
    baseCeilingUsd: moneyStringToNumber(c.baseCeiling),
    yearsExperienceMin: band.min ?? null,
    yearsExperienceMax: band.max ?? null,
    scoringResumeIds: c.scoringResumeIds,
  }
}

export async function createSearch(input: CreateSearchInput): Promise<Search> {
  const body = { name: input.name, criteria: wireCriteria(input.criteria) }
  return appSearch(await post<WSearch>("/searches", body))
}

export async function updateSearchCriteria(
  input: UpdateSearchCriteriaInput,
): Promise<Search> {
  // Body(embed=True) -> `{ "criteria": {...} }`.
  const body = { criteria: wireCriteria(input.criteria) }
  return appSearch(await patch<WSearch>(`/searches/${input.id}`, body))
}

// ===========================================================================
// Settings
// ===========================================================================

interface WSettings {
  profile: {
    name: string
    email: string
    phone: string
    timezone: string
    currentRole: string
    targetTitles: string[]
    compFloorUsd: number
  }
  integrations: (Omit<IntegrationRow, "icon" | "lastSync"> & {
    lastSync?: string | null
  })[]
  providers: (Omit<ProviderRow, "balance"> & { balanceUsd?: number | null })[]
  routing: { task: string; model: string }[]
  usage: (Omit<UsageRow, "tokens" | "cost"> & {
    tokens: number
    costUsd: number
  })[]
  monthSpendUsd: number
  monthlyCapUsd: number
  privacy: { key: string; on: boolean }[]
  privacyLastUpdated: string
  plan: {
    name: string
    priceUsd: number
    description: string
    nextCharge: string
  }
  invoices: { date: string; description: string; amountUsd: number }[]
  notifPrefs: (Omit<NotifPref, "consequence"> & Record<string, unknown>)[]
  extensionTokens: {
    id: string
    label: string
    createdAt: string
    revokedAt?: string | null
  }[]
  emailParserFallback: Settings["emailParserFallback"]
}

export async function getSettings(): Promise<Settings> {
  const w = await get<WSettings>("/settings")
  const integrations: IntegrationRow[] = w.integrations.map((row) => ({
    name: row.name,
    description: row.description,
    state: row.state,
    icon: integrationIcon(row.name),
    account: row.account,
    lastSync: row.lastSync ? relativeAge(row.lastSync) : undefined,
  }))
  const providers: ProviderRow[] = w.providers.map((row) => ({
    provider: row.provider,
    model: row.model,
    state: row.state,
    balance: row.balanceUsd != null ? formatUsd(row.balanceUsd) : undefined,
    error: row.error,
  }))
  const routing: RoutingRow[] = w.routing.map((row) => ({
    label: row.task,
    value: row.model,
  }))
  const usage: UsageRow[] = w.usage.map((row) => ({
    service: row.service,
    model: row.model,
    count: row.count,
    tokens: abbreviateTokens(row.tokens),
    cost: formatUsd(row.costUsd),
  }))
  const privacy: PrivacyToggle[] = w.privacy.map((row) => {
    const copy = privacyCopy(row.key)
    return { title: copy.title, description: copy.description, on: row.on }
  })
  const notifPrefs: NotifPref[] = w.notifPrefs.map((row) => ({
    id: row.id,
    category: row.category,
    emailEnabled: row.emailEnabled,
    inAppEnabled: row.inAppEnabled,
    emailLocked: row.emailLocked,
  }))
  return {
    profile: {
      name: w.profile.name,
      email: w.profile.email,
      phone: w.profile.phone,
      timezone: w.profile.timezone,
      currentRole: w.profile.currentRole,
      targetTitles: w.profile.targetTitles,
      compFloor: formatUsd(w.profile.compFloorUsd),
    },
    integrations,
    providers,
    routing,
    usage,
    monthSpend: formatUsd(w.monthSpendUsd),
    monthlyCap: formatUsd(w.monthlyCapUsd),
    privacy,
    privacyLastUpdated: relativeAge(w.privacyLastUpdated),
    plan: {
      name: w.plan.name,
      price: formatUsd(w.plan.priceUsd),
      description: w.plan.description,
      nextCharge: relativeAge(w.plan.nextCharge),
    },
    invoices: w.invoices.map((row) => ({
      date: relativeAge(row.date),
      description: row.description,
      amount: formatUsd(row.amountUsd),
    })),
    danger: [...DANGER_ACTIONS],
    notifPrefs,
    extensionTokens: w.extensionTokens.map((t) => ({
      id: t.id,
      label: t.label,
      createdAt: relativeAge(t.createdAt),
      revokedAt: t.revokedAt ? relativeAge(t.revokedAt) : undefined,
    })),
    emailParserFallback: w.emailParserFallback,
  }
}

// ===========================================================================
// LLM cost transparency + deep match score
// ===========================================================================

export async function previewDeepMatchScore(
  jobId: string,
  resumeNames: readonly string[],
): Promise<CostPreview> {
  const resumes = await getResumes()
  const resumeIds = resumeNames.map((name) => {
    const hit =
      resumes.find((r) => r.id === name) ??
      resumes.find((r) => name.startsWith(r.name)) ??
      resumes.find((r) => r.name === name)
    return hit?.id ?? name
  })
  const nameById = new Map<string, string>()
  for (const r of resumes) {
    nameById.set(r.id, r.name)
  }
  const w = await post<{
    items: { resumeId: string; model: string; estCostUsd: number }[]
    totalUsd: number
    capRemainingUsd: number
    overCap: boolean
  }>(`/jobs/${jobId}/preview-deep-score`, { resumeIds })
  const items: CostPreviewItem[] = w.items.map((it) => ({
    label: `Deep match score -- ${nameById.get(it.resumeId) ?? it.resumeId}`,
    model: it.model,
    estCostUsd: it.estCostUsd,
  }))
  return {
    items,
    totalUsd: w.totalUsd,
    capRemainingUsd: w.capRemainingUsd,
    overCap: w.overCap,
  }
}

export async function runDeepMatchScore(
  jobId: string,
  resumeName: string,
): Promise<DeepMatchResult> {
  const resumeId = await resolveResumeId(resumeName)
  const w = await post<DeepMatchResult & { aiRun?: unknown }>(
    `/jobs/${jobId}/deep-score`,
    { resumeId },
  )
  // aiRun telemetry is dropped -- the hook's return type is the bare result.
  const { aiRun: _aiRun, ...result } = w
  void _aiRun
  return result
}

// ===========================================================================
// Extension (client-local, no HTTP)
// ===========================================================================

export function getExtensionState(state: ExtensionState): Promise<{
  state: ExtensionState
  label: string
  recentCaptures: readonly ExtensionRecentCapture[]
}> {
  const hit = EXTENSION_STATE_LABELS.find((s) => s.state === state)
  if (!hit) {
    return Promise.reject(MockApiError.notFound(`extension/${state}`))
  }
  return Promise.resolve({
    state: hit.state,
    label: hit.label,
    recentCaptures: hit.state === "empty" ? EXTENSION_RECENT_CAPTURES : [],
  })
}

// ===========================================================================
// Usage aggregate
// ===========================================================================

export async function getUsageAggregate(): Promise<UsageAggregate> {
  const w = await get<{
    monthSpendUsd: number
    monthlyCapUsd: number
    tokensIn: number
    tokensOut: number
    avgPerSessionUsd: number
  }>("/usage-aggregate")
  return {
    monthSpend: formatUsd(w.monthSpendUsd),
    monthlyCap: formatUsd(w.monthlyCapUsd),
    tokensIn: abbreviateTokens(w.tokensIn),
    tokensOut: abbreviateTokens(w.tokensOut),
    avgPerSession: formatUsd(w.avgPerSessionUsd),
  }
}

// ===========================================================================
// Review queue (approve / reject)
// ===========================================================================

export async function getReviewQueue(): Promise<readonly ReviewQueueItem[]> {
  const rows = await get<WReviewQueueItem[]>("/agents/review-queue")
  return rows.map((r) => ({
    ref: r.id,
    agentId: r.agentId,
    message: r.message,
    time: relativeAge(r.time),
  }))
}

export function approveAgentAction(ref: string): Promise<void> {
  return post<void>(`/agents/review-queue/${ref}/approve`)
}

export function rejectAgentAction(ref: string): Promise<void> {
  return post<void>(`/agents/review-queue/${ref}/reject`)
}

// ===========================================================================
// Data export / account deletion
// ===========================================================================

export function requestDataExport(): Promise<DataExportRequest> {
  return post<DataExportRequest>("/account/data-export")
}

export function deleteAccount(): Promise<{ gracePeriodEndsAt: string }> {
  return post<{ gracePeriodEndsAt: string }>("/account/delete")
}

// ===========================================================================
// Budget snapshot (client-local, synchronous)
// ===========================================================================

export function getBudgetSnapshot(): { used: number; total: number } {
  return { used: BUDGET_USED, total: BUDGET_TOTAL }
}

// ===========================================================================
// Library -- Contacts
// ===========================================================================

export async function getContacts(): Promise<readonly Contact[]> {
  const rows = await get<Contact[]>("/contacts")
  return rows.map((c) => ({ ...c, updated: relativeAge(c.updated) }))
}

export async function getContact(id: string): Promise<Contact> {
  const c = await get<Contact>(`/contacts/${id}`)
  return { ...c, updated: relativeAge(c.updated) }
}

export type ContactDraft = Omit<Contact, "id" | "updated">

export async function createContact(draft: ContactDraft): Promise<Contact> {
  const c = await post<Contact>("/contacts", stripDraftMeta(draft))
  return { ...c, updated: relativeAge(c.updated) }
}

export async function updateContact(
  id: string,
  patchBody: Partial<ContactDraft>,
): Promise<Contact> {
  // Wire PATCH replaces with a full ContactDraft; merge onto current first.
  const current = await get<Contact>(`/contacts/${id}`)
  const merged = { ...stripEntityMeta(current), ...patchBody }
  const c = await patch<Contact>(`/contacts/${id}`, stripDraftMeta(merged))
  return { ...c, updated: relativeAge(c.updated) }
}

export function deleteContact(id: string): Promise<void> {
  return del(`/contacts/${id}`)
}

// ===========================================================================
// Library -- Accomplishments
// ===========================================================================

export async function getAccomplishments(): Promise<readonly Accomplishment[]> {
  const rows = await get<Accomplishment[]>("/accomplishments")
  return rows.map((a) => ({ ...a, updated: relativeAge(a.updated) }))
}

export type AccomplishmentDraft = Omit<
  Accomplishment,
  "id" | "updated" | "usedIn"
>

export async function createAccomplishment(
  draft: AccomplishmentDraft,
): Promise<Accomplishment> {
  const a = await post<Accomplishment>(
    "/accomplishments",
    stripDraftMeta(draft),
  )
  return { ...a, updated: relativeAge(a.updated) }
}

export async function updateAccomplishment(
  id: string,
  patchBody: Partial<AccomplishmentDraft>,
): Promise<Accomplishment> {
  const list = await get<Accomplishment[]>("/accomplishments")
  const current = list.find((a) => a.id === id)
  if (!current) {
    throw MockApiError.notFound(`accomplishments/${id}`)
  }
  const merged: AccomplishmentDraft = {
    title: current.title,
    summary: current.summary,
    tags: current.tags,
    source: current.source,
    ...patchBody,
  }
  const a = await patch<Accomplishment>(
    `/accomplishments/${id}`,
    stripDraftMeta(merged),
  )
  return { ...a, updated: relativeAge(a.updated) }
}

export function deleteAccomplishment(id: string): Promise<void> {
  return del(`/accomplishments/${id}`)
}

export async function deriveAccomplishmentFromProject(
  projectId: string,
): Promise<Accomplishment> {
  const w = await post<{ accomplishment: Accomplishment; aiRun?: unknown }>(
    "/accomplishments/derive-from-project",
    { projectId },
  )
  return { ...w.accomplishment, updated: relativeAge(w.accomplishment.updated) }
}

// ===========================================================================
// Library -- Answers
// ===========================================================================

export async function getAnswers(): Promise<readonly Answer[]> {
  const rows = await get<Answer[]>("/answers")
  return rows.map((a) => ({ ...a, updated: relativeAge(a.updated) }))
}

export type AnswerDraft = Omit<Answer, "id" | "updated">

export async function createAnswer(draft: AnswerDraft): Promise<Answer> {
  const a = await post<Answer>("/answers", stripDraftMeta(draft))
  return { ...a, updated: relativeAge(a.updated) }
}

export async function updateAnswer(
  id: string,
  patchBody: Partial<AnswerDraft>,
): Promise<Answer> {
  const list = await get<Answer[]>("/answers")
  const current = list.find((a) => a.id === id)
  if (!current) {
    throw MockApiError.notFound(`answers/${id}`)
  }
  const merged: AnswerDraft = {
    question: current.question,
    body: current.body,
    category: current.category,
    tags: current.tags,
    ...patchBody,
  }
  const a = await patch<Answer>(`/answers/${id}`, stripDraftMeta(merged))
  return { ...a, updated: relativeAge(a.updated) }
}

export function deleteAnswer(id: string): Promise<void> {
  return del(`/answers/${id}`)
}

// ===========================================================================
// Library -- Projects
// ===========================================================================

export async function getProjects(): Promise<readonly Project[]> {
  const rows = await get<Project[]>("/projects")
  return rows.map((p) => ({ ...p, updated: relativeAge(p.updated) }))
}

export type ProjectDraft = Omit<Project, "id" | "updated">

export async function createProject(draft: ProjectDraft): Promise<Project> {
  const p = await post<Project>("/projects", stripDraftMeta(draft))
  return { ...p, updated: relativeAge(p.updated) }
}

export async function updateProject(
  id: string,
  patchBody: Partial<ProjectDraft>,
): Promise<Project> {
  const list = await get<Project[]>("/projects")
  const current = list.find((p) => p.id === id)
  if (!current) {
    throw MockApiError.notFound(`projects/${id}`)
  }
  const merged: ProjectDraft = {
    title: current.title,
    employer: current.employer,
    body: current.body,
    tags: current.tags,
    ...patchBody,
  }
  const p = await patch<Project>(`/projects/${id}`, stripDraftMeta(merged))
  return { ...p, updated: relativeAge(p.updated) }
}

export function deleteProject(id: string): Promise<void> {
  return del(`/projects/${id}`)
}

// --- library draft helpers ---

/** Drop server-owned fields a draft body must not carry. */
function stripDraftMeta<T extends object>(draft: T): T {
  const {
    id: _id,
    updated: _updated,
    usedIn: _usedIn,
    deletedAt: _deletedAt,
    ...rest
  } = draft as Record<string, unknown>
  void _id
  void _updated
  void _usedIn
  void _deletedAt
  return rest as T
}

function stripEntityMeta<T extends object>(entity: T): T {
  return stripDraftMeta(entity)
}

// ===========================================================================
// Library -- Trash
// ===========================================================================

export async function getTrash(): Promise<readonly TrashEntry[]> {
  const rows = await get<WTrashEntry[]>("/library/trash")
  return rows.map((t) => ({ ...t, deletedAt: relativeAge(t.deletedAt) }))
}

export function restoreLibraryItem(
  kind: LibraryKind,
  id: string,
): Promise<void> {
  return post<void>(`/library/${kind}/${id}/restore`)
}

export function purgeLibraryItem(kind: LibraryKind, id: string): Promise<void> {
  return del(`/library/${kind}/${id}/purge`)
}

export function getDeletionImpact(
  kind: LibraryKind,
  id: string,
): Promise<DeletionImpact> {
  return get<DeletionImpact>(`/library/${kind}/${id}/deletion-impact`)
}

// ===========================================================================
// Library -- Credentials
// ===========================================================================

export async function getCredentials(): Promise<readonly Credential[]> {
  const rows = await get<Credential[]>("/credentials")
  return rows.map((c) => ({ ...c, updated: relativeAge(c.updated) }))
}

// ===========================================================================
// Resume lifecycle
// ===========================================================================

export async function getResumeUploads(): Promise<readonly ResumeUpload[]> {
  const rows = await get<ResumeUpload[]>("/resumes/uploads")
  return rows.map((u) => ({ ...u, uploadedAt: relativeAge(u.uploadedAt) }))
}

export function getCareerHistory(): Promise<readonly CareerHistoryItem[]> {
  return get<CareerHistoryItem[]>("/career-history")
}

export function getResumeTemplates(): Promise<readonly ResumeTemplate[]> {
  return get<ResumeTemplate[]>("/resumes/templates")
}

export async function getResumeExports(): Promise<readonly ResumeExport[]> {
  const rows = await get<ResumeExport[]>("/resumes/exports")
  return rows.map((e) => ({ ...e, generatedAt: relativeAge(e.generatedAt) }))
}

export async function getProjections(): Promise<readonly Resume[]> {
  const rows = await get<WResume[]>("/projections")
  return rows.map(appResume)
}

export async function createProjection(input: {
  name: string
  targetRole?: string
  itemIds: readonly string[]
  templateId?: string
  sourceUploadId?: string
}): Promise<Resume> {
  const body = {
    name: input.name,
    targetRole: input.targetRole,
    itemIds: input.itemIds,
    templateId: input.templateId,
    sourceUploadId: input.sourceUploadId,
  }
  return appResume(await post<WResume>("/projections", body))
}

export async function assignTemplate(
  projectionId: string,
  templateId: string,
): Promise<Resume> {
  return appResume(
    await put<WResume>(`/projections/${projectionId}/template`, { templateId }),
  )
}

export async function renderExport(
  projectionId: string,
): Promise<ResumeExport> {
  const e = await post<ResumeExport>("/exports", { projectionId })
  return { ...e, generatedAt: relativeAge(e.generatedAt) }
}

export async function regenerateExport(
  exportId: string,
): Promise<ResumeExport> {
  const e = await post<ResumeExport>(`/exports/${exportId}/regenerate`)
  return { ...e, generatedAt: relativeAge(e.generatedAt) }
}

// ===========================================================================
// Test surface
// ===========================================================================

/**
 * No-op in the HTTP adapter -- the mutable stores now live server-side. Kept as
 * an export so test call sites don't break; tests that need a pristine backend
 * reset it out-of-band (or run against a fresh scaffold process).
 */
export function __resetForTests(): void {
  // Intentionally empty: state is owned by the scaffold backend.
}
