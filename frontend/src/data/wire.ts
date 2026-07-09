/**
 * Wire <-> app transform layer for the mock-API HTTP adapter.
 *
 * `src/data/api.ts` now speaks HTTP against the frozen `mvp-api.yaml` contract
 * (camelCase wire fields, ISO-8601 timestamps, USD numbers, the 12-value stage
 * machine, machine-token enums). The app-facing `src/data/types.ts` is frozen
 * and unchanged, so every difference between the two is absorbed HERE and in
 * `api.ts` -- consumers (hooks/screens/tests) keep the exact shapes they had.
 *
 * This file holds:
 *  - the wire response interfaces we consume,
 *  - the scalar transform helpers (relativeAge, USD/salary formatting, token
 *    abbreviation, stage/enum maps, band parsing),
 *  - the client-owned presentation constant maps for fields the contract
 *    dropped (icons, stateLabel, eyebrow, trust-ladder copy, privacy copy).
 */

import type {
  AgentState,
  AgentTrustTier,
  Salary,
  Stage,
  TrustTierRung,
} from "./types"

// ===========================================================================
// Scalar transforms
// ===========================================================================

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/**
 * ISO-8601 instant -> compact relative display string the mock components
 * expect ("just now", "12m ago", "3h ago", "2d ago", "3w ago", "Mar 1").
 * Past ~a year it falls through to an absolute short date. `now` is injectable
 * for deterministic tests.
 */
export function relativeAge(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) {
    return ""
  }
  const then = new Date(iso)
  const ms = then.getTime()
  if (Number.isNaN(ms)) {
    // Not an ISO instant (already a display label, e.g. seeded "just now").
    return iso
  }
  const diff = now.getTime() - ms
  const sec = Math.floor(diff / 1000)
  if (sec < 45) {
    return "just now"
  }
  const min = Math.floor(sec / 60)
  if (min < 60) {
    return `${min}m ago`
  }
  const hr = Math.floor(min / 60)
  if (hr < 24) {
    return `${hr}h ago`
  }
  const day = Math.floor(hr / 24)
  if (day < 7) {
    return `${day}d ago`
  }
  if (day < 30) {
    return `${Math.floor(day / 7)}w ago`
  }
  if (day < 365) {
    return `${MONTHS[then.getMonth()]} ${then.getDate()}`
  }
  return `${MONTHS[then.getMonth()]} ${then.getFullYear()}`
}

/** Whole-day age between `createdAt` and now (replaces the mock's `days`). */
export function daysSince(
  iso: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!iso) {
    return 0
  }
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) {
    return 0
  }
  return Math.max(0, Math.floor((now.getTime() - ms) / 86_400_000))
}

/**
 * USD number -> display string. Large round-ish amounts collapse to "$Nk"
 * (compensation floors etc.); sub-$1k costs keep two decimals ("$0.08").
 */
export function formatUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return "--"
  }
  if (Math.abs(n) >= 1000) {
    return `$${Math.round(n / 1000)}k`
  }
  return `$${n.toFixed(2)}`
}

/** Integer token count -> abbreviated string ("1.2M", "340k", "512"). */
export function abbreviateTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) {
    return "0"
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }
  if (n >= 1000) {
    return `${Math.round(n / 1000)}k`
  }
  return `${n}`
}

// --- Salary passthrough (wire SalaryPoint/SalaryRange are structurally the app
// Salary already; keep a helper so intent is explicit at call sites). ---

export type WireSalary = Salary | null

export function toSalary(w: WireSalary): Salary | null {
  return w ?? null
}

/** Parse a user-entered comp string ("$280k + equity") into a structured Salary. */
export function parseNegotiatedComp(
  input: string | null | undefined,
): Salary | null {
  if (!input || input.trim().length === 0) {
    return null
  }
  const trimmed = input.trim()
  // Range: "$180k-$220k ..." -> min/max.
  const range = trimmed.match(
    /\$?\s*([\d.,]+)\s*([kKmM]?)\s*[-–]\s*\$?\s*([\d.,]+)\s*([kKmM]?)/,
  )
  if (range) {
    const min = scaleMoney(range[1], range[2])
    const max = scaleMoney(range[3], range[4])
    const extra = extractExtra(trimmed.slice(range[0].length))
    return { min, max, extra }
  }
  const point = trimmed.match(/\$?\s*([\d.,]+)\s*([kKmM]?)/)
  if (point) {
    const value = scaleMoney(point[1], point[2])
    const extra = extractExtra(
      trimmed.slice((point.index ?? 0) + point[0].length),
    )
    return { value, extra }
  }
  return { value: 0, extra: [trimmed] }
}

/** Parse a display money string ("$155k", "$180,000") into a plain USD number. */
export function moneyStringToNumber(s: string | null | undefined): number {
  if (!s) {
    return 0
  }
  const m = s.trim().match(/([\d.,]+)\s*([kKmM]?)/)
  if (!m) {
    return 0
  }
  return scaleMoney(m[1], m[2])
}

function scaleMoney(digits: string, suffix: string): number {
  const base = Number(digits.replace(/,/g, "")) || 0
  const s = suffix.toLowerCase()
  if (s === "k") {
    return Math.round(base * 1000)
  }
  if (s === "m") {
    return Math.round(base * 1_000_000)
  }
  return Math.round(base)
}

function extractExtra(rest: string): string[] {
  return rest
    .split(/[+,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// ===========================================================================
// Stage machine (sec 7) + enum maps
// ===========================================================================

/** The 12-value frozen wire stage taxonomy. */
export type WireStage =
  | "saved"
  | "drafting"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "won"
  | "rejected"
  | "ghosted"
  | "withdrew"
  | "dismissed"
  | "offer_rescinded"

const WIRE_TO_APP_STAGE: Record<WireStage, Stage> = {
  saved: "saved",
  drafting: "draft",
  applied: "applied",
  screening: "screen",
  interview: "interview",
  offer: "offer",
  won: "closed",
  rejected: "rejected",
  ghosted: "closed",
  withdrew: "closed",
  dismissed: "closed",
  offer_rescinded: "closed",
}

/** Wire stage (12) -> app Stage (8), per CONTRACT-NOTES sec 7. */
export function stageWireToApp(w: string): Stage {
  return WIRE_TO_APP_STAGE[w as WireStage] ?? "applied"
}

const APP_TO_WIRE_STAGE: Record<Stage, WireStage> = {
  saved: "saved",
  draft: "drafting",
  applied: "applied",
  screen: "screening",
  interview: "interview",
  offer: "offer",
  rejected: "rejected",
  // 'closed' is a coarse mock bucket; a real forward-transition never targets
  // it. Map to 'dismissed' as the neutral terminal for completeness.
  closed: "dismissed",
}

/** App Stage -> wire stage, for the net-new transition op's targetStage input. */
export function stageAppToWire(s: Stage): WireStage {
  return APP_TO_WIRE_STAGE[s] ?? "applied"
}

const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved",
  draft: "Drafting",
  applied: "Applied",
  screen: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  closed: "Closed",
}

/** Client-owned display label for a stage (the dropped `stageLabel` field). */
export function stageLabel(s: Stage): string {
  return STAGE_LABEL[s] ?? s
}

// --- remotePolicy: machine token <-> display copy ---

export type WireRemotePolicy = "remote-ok" | "hybrid-ok" | "required"
export type AppRemotePolicy = "OK" | "Hybrid OK" | "Required"

const REMOTE_WIRE_TO_APP: Record<WireRemotePolicy, AppRemotePolicy> = {
  "remote-ok": "OK",
  "hybrid-ok": "Hybrid OK",
  required: "Required",
}
const REMOTE_APP_TO_WIRE: Record<AppRemotePolicy, WireRemotePolicy> = {
  OK: "remote-ok",
  "Hybrid OK": "hybrid-ok",
  Required: "required",
}

export function remotePolicyWireToApp(w: string): AppRemotePolicy {
  return REMOTE_WIRE_TO_APP[w as WireRemotePolicy] ?? "OK"
}
export function remotePolicyAppToWire(a: string): WireRemotePolicy {
  return REMOTE_APP_TO_WIRE[a as AppRemotePolicy] ?? "remote-ok"
}

// --- yearsExperience band: two ints <-> "8-14 yrs" string ---

export function yearsBandToDisplay(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min != null && max != null) {
    return `${min}-${max} yrs`
  }
  if (min != null) {
    return `${min}+ yrs`
  }
  if (max != null) {
    return `up to ${max} yrs`
  }
  return ""
}

export function displayToYearsBand(display: string | null | undefined): {
  min?: number
  max?: number
} {
  if (!display) {
    return {}
  }
  const range = display.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) }
  }
  const plus = display.match(/(\d+)\s*\+/)
  if (plus) {
    return { min: Number(plus[1]) }
  }
  const single = display.match(/(\d+)/)
  if (single) {
    return { min: Number(single[1]) }
  }
  return {}
}

// ===========================================================================
// Client-owned presentation constants (fields the contract dropped)
// ===========================================================================

const AGENT_STATE_LABEL: Record<AgentState, string> = {
  running: "Running",
  demand: "On-demand",
  paused: "Paused",
  error: "Error",
}

export function agentStateLabel(state: AgentState): string {
  return AGENT_STATE_LABEL[state] ?? state
}

/** Agent icon keyed by the (stable) agent name. */
const AGENT_ICON_BY_NAME: Record<string, string> = {
  "Stale-detector": "clock-alert",
  "Ghost-detector": "ghost",
  Coach: "message-square-heart",
}

export function agentIcon(name: string): string {
  return AGENT_ICON_BY_NAME[name] ?? "bot"
}

/**
 * Notification icon. The contract keeps `kind`; per-row icon nuance (the three
 * 'agent' notifications used distinct glyphs) is recovered by a title keyword,
 * falling back to a kind-based default.
 */
export function notificationIcon(kind: string, title: string): string {
  const t = title.toLowerCase()
  if (kind === "agent") {
    if (t.includes("ghost")) {
      return "ghost"
    }
    if (t.includes("coach")) {
      return "message-square-heart"
    }
    return "clock-alert"
  }
  switch (kind) {
    case "reply":
      return "mail"
    case "match":
      return "star"
    case "cal":
      return "calendar"
    default:
      return "bell"
  }
}

/** Integration row icon keyed by the integration name. */
const INTEGRATION_ICON_BY_NAME: Record<string, string> = {
  "Google Calendar": "calendar",
  Gmail: "mail",
  Slack: "message-square",
  LinkedIn: "linkedin",
  Notion: "notebook",
}

export function integrationIcon(name: string): string {
  return INTEGRATION_ICON_BY_NAME[name] ?? "plug"
}

/** Trust-ladder display copy keyed by tier (the dropped label/blurb). */
const TRUST_LADDER_COPY: Record<
  AgentTrustTier,
  { label: string; blurb: string }
> = {
  observe: {
    label: "Observe",
    blurb: "Reads your pipeline. Never writes or acts.",
  },
  suggest: {
    label: "Suggest",
    blurb:
      "Drafts follow-ups and suggestions for you to review. Sends nothing.",
  },
  "act-with-approval": {
    label: "Act with approval",
    blurb:
      "Can take actions, but each one waits in your review queue for a yes.",
  },
  autonomous: {
    label: "Autonomous",
    blurb:
      "Acts on its own without per-item review. Grant only for low-stakes tasks.",
  },
}

/** Build a full app TrustTierRung from the wire `{tier}`-only rung. */
export function trustTierRung(tier: AgentTrustTier): TrustTierRung {
  const copy = TRUST_LADDER_COPY[tier] ?? { label: tier, blurb: "" }
  return { tier, label: copy.label, blurb: copy.blurb }
}

/** Privacy toggle copy keyed by the stable wire `key`. */
const PRIVACY_COPY: Record<string, { title: string; description: string }> = {
  "coach-feedback-training": {
    title: "Use coach feedback to improve prompts",
    description:
      "Anonymized \u{1F44D}/\u{1F44E} only — no résumé or email content.",
  },
  "resume-finetune-training": {
    title: "Use my résumés to fine-tune models",
    description: "Off by default. Opt-in only.",
  },
  "anonymous-response-benchmarks": {
    title: "Share anonymous response-rate benchmarks",
    description: 'Helps everyone — "avg reply for role X is Yd".',
  },
  "chat-log-retention-30d": {
    title: "Keep chat logs after 30 days",
    description:
      "We purge threads you delete. This controls passive retention.",
  },
}

export function privacyCopy(key: string): {
  title: string
  description: string
} {
  return PRIVACY_COPY[key] ?? { title: key, description: "" }
}

/** A neutral, client-owned eyebrow for a search (the dropped `eyebrow` copy). */
export function searchEyebrow(state: string | null | undefined): string {
  return state === "paused" ? "Paused search" : "Saved search"
}

// ===========================================================================
// Wire response interfaces (only the shapes the adapter consumes)
// ===========================================================================

export interface WireAiRunEnvelope {
  provider: string
  model: string
  status: "succeeded" | "failed" | "cancelled"
  estimatedCostUsd: number
  actualCostUsd?: number | null
  synthetic: boolean
}
