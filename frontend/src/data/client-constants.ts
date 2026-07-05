/**
 * Client-owned runtime constants for the handful of operations the frozen
 * contract does NOT expose over HTTP (founder rulings / mock-only surfaces):
 *   - getUserMenu, getExtensionState, getBudgetSnapshot -- never had a route.
 *   - getCoachGreeting -- founder ruled 2026-07-04 (DECISIONS-NEEDED #5) to
 *     ship canned per-scope copy, not an API call.
 *
 * These are reproduced from the mock fixtures so `api.ts` never imports the
 * bulk data fixtures on the runtime path (fixtures stay for tests/Storybook).
 */

import type {
  CoachGreeting,
  CoachThreadScope,
  DangerAction,
  ExtensionRecentCapture,
  ExtensionState,
  UserMenuRow,
} from "./types"

/**
 * Danger-zone actions. The contract dropped `Settings.danger` (rows were
 * literal button copy; the actions have real endpoints -- requestDataExport /
 * deleteAccount). The client owns the copy; `getSettings` re-attaches it.
 */
export const DANGER_ACTIONS: readonly DangerAction[] = [
  {
    title: "Export your data",
    description:
      "Download everything Employa holds about you as a single archive.",
    cta: "Request export",
    danger: false,
  },
  {
    title: "Delete account",
    description:
      "Permanently delete your account and all associated data after a 30-day grace period.",
    cta: "Delete account",
    danger: true,
  },
]

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
  { icon: "life-buoy", label: "Help & support", sublabel: "Docs, contact us" },
  { icon: "gift", label: "Refer a friend", sublabel: "Get $20 credit each" },
]

export const EXTENSION_STATE_LABELS: readonly {
  state: ExtensionState
  label: string
}[] = [
  { state: "detected", label: "On a recognized job posting" },
  { state: "empty", label: "Page isn't a job posting · fallback" },
  { state: "signed-out", label: "First-run · not signed in" },
]

export const EXTENSION_RECENT_CAPTURES: readonly ExtensionRecentCapture[] = [
  { title: "Linear — Senior Staff", detail: "1d" },
  { title: "Stripe — Payments core", detail: "2d" },
  { title: "Sentry — Ingest", detail: "3d" },
]

/** Sidebar budget snapshot (derived from the mock usage totals). */
export const BUDGET_USED = 3.42
export const BUDGET_TOTAL = 20

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
