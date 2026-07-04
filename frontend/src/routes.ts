/**
 * Route table — single source of truth for routing + Playwright smoke.
 *
 * Each picker ID from `/tmp/employa-design/src/app.jsx` gets exactly one row.
 * Phase 9 wires this table into `App.tsx` via `<BrowserRouter>` + `<Routes>`.
 *
 * Conventions:
 * - `id` matches the design picker ID verbatim (kebab-case)
 * - `path` is a real URL path; React-Router v7 syntax (`:id` for params)
 * - `screen` is lazily imported so the router can code-split
 * - `group` mirrors the design's picker grouping
 * - `bypassFrame` is informational only — screens self-wrap in `<AppFrame>`,
 *   so the router renders the screen verbatim either way. Kept for docs +
 *   future Sidebar filtering (Dev-only previews etc.).
 * - `active` is the sidebar active hint (defaults to `id`)
 *
 * Add-app `/applications/new` is intentionally declared before
 * `app-detail` so React-Router's static-segment beats `:id`.
 */

import { type ComponentType, type LazyExoticComponent, lazy } from "react"

export interface Route {
  readonly id: string
  readonly path: string
  readonly label: string
  readonly screen: LazyExoticComponent<ComponentType<unknown>>
  readonly group?: string
  readonly bypassFrame?: boolean
  readonly active?: string
  /**
   * Mockup-only scaffolding (onboarding/auth flow entry points, dev previews).
   * Real production navigation does not jump to these via the command palette;
   * they are flagged so a future build knows to drop them from nav surfaces.
   */
  readonly mockupOnly?: boolean
}

// Each screen is dynamically imported for code-splitting + smaller initial bundle.
// React-Router renders these inside a single `<Suspense>` in `App.tsx`.
const DashboardScreen = lazy(() => import("./screens/dashboard"))
const OnboardingScreen = lazy(() => import("./screens/onboarding"))
// One flow component serves every auth substate; it derives which step to
// render from the URL. All seven rows below point at it.
const AuthScreen = lazy(() => import("./screens/auth"))
const ApplicationsScreen = lazy(() => import("./screens/applications"))
const AppDetailScreen = lazy(() => import("./screens/app-detail"))
const AddAppScreen = lazy(() => import("./screens/add-app"))
const ShortlistScreen = lazy(() => import("./screens/shortlist"))
const JobsScreen = lazy(() => import("./screens/jobs"))
const JobDetailScreen = lazy(() => import("./screens/job-detail"))
const SearchCriteriaScreen = lazy(() => import("./screens/search-criteria"))
const SearchDetailScreen = lazy(() => import("./screens/search-detail"))
const ResumesScreen = lazy(() => import("./screens/resumes"))
const MatchExplorerScreen = lazy(() => import("./screens/match-explorer"))
const ResumeEditorScreen = lazy(() => import("./screens/resume-editor"))
const ResumePreviewScreen = lazy(() => import("./screens/resume-preview"))
const CoachScreen = lazy(() => import("./screens/coach"))
const AgentsScreen = lazy(() => import("./screens/agents"))
const AgentLogScreen = lazy(() => import("./screens/agent-log"))
const AgentReviewQueueScreen = lazy(
  () => import("./screens/agents/review-queue"),
)
const AgentDetailScreen = lazy(() => import("./screens/agent-detail"))
// 2026-06-02 round: Library section + Intelligence (review changelog)
const LibraryScreen = lazy(() => import("./screens/library"))
const ContactsScreen = lazy(() => import("./screens/library/contacts"))
const AccomplishmentsScreen = lazy(
  () => import("./screens/library/accomplishments"),
)
const AnswersScreen = lazy(() => import("./screens/library/answers"))
const ProjectsScreen = lazy(() => import("./screens/library/projects"))
const CredentialsScreen = lazy(() => import("./screens/library/credentials"))
const TemplatesScreen = lazy(() => import("./screens/library/templates"))
const TrashScreen = lazy(() => import("./screens/library/trash"))
const ReviewChangelogScreen = lazy(
  () => import("./screens/agents/review-changelog"),
)
const SettingsScreen = lazy(() => import("./screens/settings"))
const MarkWonScreen = lazy(() => import("./screens/mark-won"))
const NotificationsScreen = lazy(() => import("./screens/notifications"))
const UserMenuScreen = lazy(() => import("./screens/user-menu"))
const ExtensionScreen = lazy(() => import("./screens/extension"))
const ToastsScreen = lazy(() => import("./screens/toasts"))
const ArchiveScreen = lazy(() => import("./screens/archive"))

export const ROUTES: readonly Route[] = [
  // Onboarding & auth — bypass frame (own chrome)
  {
    id: "onboarding",
    path: "/onboarding",
    label: "Onboarding wizard",
    screen: OnboardingScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
  },
  // Register surface + substates. All bypass the AppFrame (own chrome) and
  // render the single URL-driven AuthScreen.
  {
    id: "register",
    path: "/register",
    label: "Register",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
  },
  {
    id: "register-check-email",
    path: "/register/check-email",
    label: "Register - check email",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
    active: "register",
  },
  {
    id: "register-set-password",
    path: "/register/set-password",
    label: "Register - set password",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
    active: "register",
  },
  // Login surface + substates (forgot-password request/sent, 2FA challenge).
  {
    id: "login",
    path: "/login",
    label: "Log in",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
  },
  {
    id: "login-forgot",
    path: "/login/forgot",
    label: "Forgot password",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
    active: "login",
  },
  {
    id: "login-forgot-sent",
    path: "/login/forgot/sent",
    label: "Forgot password - sent",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
    active: "login",
  },
  {
    id: "login-2fa",
    path: "/login/2fa",
    label: "2FA challenge",
    screen: AuthScreen,
    group: "Onboarding & auth",
    bypassFrame: true,
    mockupOnly: true,
    active: "login",
  },

  // Dashboard
  {
    id: "dashboard",
    path: "/dashboard",
    label: "Dashboard",
    screen: DashboardScreen,
    group: "Dashboard",
  },

  // Applications — `/new` declared BEFORE `:id` so static beats dynamic
  {
    id: "add-app",
    path: "/applications/new",
    label: "Add application",
    screen: AddAppScreen,
    group: "Applications",
  },
  {
    id: "applications",
    path: "/applications",
    label: "Applications",
    screen: ApplicationsScreen,
    group: "Applications",
  },
  {
    id: "app-detail",
    path: "/applications/:id",
    label: "Application detail",
    screen: AppDetailScreen,
    group: "Applications",
  },
  // Mark-won is a stacked route: renders AppDetail underneath + MarkWon dialog
  // open. The element is composed in `App.tsx`; this row exists so the route
  // table stays the single source of truth (Playwright smoke can iterate).
  {
    id: "mark-won",
    path: "/applications/:id/won",
    label: "Mark Won modal",
    screen: MarkWonScreen,
    group: "Applications",
    active: "app-detail",
  },

  // Job sourcing — top-level redirects to current saved search's nested view
  {
    id: "shortlist",
    path: "/shortlist",
    label: "Shortlist",
    screen: ShortlistScreen,
    group: "Job sourcing",
  },
  {
    id: "jobs",
    path: "/jobs",
    label: "Jobs inbox",
    screen: JobsScreen,
    group: "Job sourcing",
  },
  {
    id: "job-detail",
    path: "/jobs/:id",
    label: "Job detail",
    screen: JobDetailScreen,
    group: "Job sourcing",
    active: "jobs",
  },
  {
    id: "search-criteria",
    path: "/searches/criteria",
    label: "Search criteria",
    screen: SearchCriteriaScreen,
    group: "Job sourcing",
  },
  // Per-search nested views — declared BEFORE `/searches/:id` so the more
  // specific patterns win. React-Router v7 matches by specificity but
  // ordering keeps `idForPath` consistent.
  {
    id: "search-shortlist",
    path: "/searches/:id/shortlist",
    label: "Search shortlist",
    screen: ShortlistScreen,
    group: "Job sourcing",
    active: "shortlist",
  },
  {
    id: "search-inbox",
    path: "/searches/:id/inbox",
    label: "Search jobs inbox",
    screen: JobsScreen,
    group: "Job sourcing",
    active: "jobs",
  },
  {
    id: "search-applications",
    path: "/searches/:id/applications",
    label: "Search applications",
    screen: ApplicationsScreen,
    group: "Job sourcing",
    active: "applications",
  },
  {
    id: "search-detail",
    path: "/searches/:id",
    label: "Search detail",
    screen: SearchDetailScreen,
    group: "Job sourcing",
  },

  // Searches -- /searches/:id/criteria BEFORE /searches/:id so static segment wins
  {
    id: "search-criteria-edit",
    path: "/searches/:id/criteria",
    label: "Edit search criteria",
    screen: SearchCriteriaScreen,
    group: "Job sourcing",
    active: "search-detail",
  },

  // Résumés & coach
  // Static paths (/resumes/match-explorer, /resumes/editor) declared BEFORE
  // dynamic /resume/:id so static segments beat the param.
  {
    id: "resumes",
    path: "/resumes",
    label: "Résumés library",
    screen: ResumesScreen,
    group: "Résumés & coach",
  },
  {
    id: "match-explorer",
    path: "/resumes/match-explorer",
    label: "Match Explorer",
    screen: MatchExplorerScreen,
    group: "Résumés & coach",
    active: "resumes",
  },
  {
    id: "resume-editor",
    path: "/resumes/editor",
    label: "Résumé editor",
    screen: ResumeEditorScreen,
    group: "Résumés & coach",
    active: "resumes",
  },
  // /resume/:id/edit -- parameterized editor (declared BEFORE /resume/:id)
  {
    id: "resume-editor-param",
    path: "/resume/:id/edit",
    label: "Résumé editor (by id)",
    screen: ResumeEditorScreen,
    group: "Résumés & coach",
    active: "resumes",
  },
  // /resume/:id -- preview (declared AFTER static resumes paths)
  {
    id: "resume-preview",
    path: "/resume/:id",
    label: "Résumé preview",
    screen: ResumePreviewScreen,
    group: "Résumés & coach",
    active: "resumes",
  },
  {
    id: "coach",
    path: "/coach",
    label: "Coach",
    screen: CoachScreen,
    group: "Résumés & coach",
  },

  // Library (2026-06-02 round) -- cross-cutting artifacts. Overview + per-type.
  {
    id: "library",
    path: "/library",
    label: "Library overview",
    screen: LibraryScreen,
    group: "Library",
  },
  {
    id: "contacts",
    path: "/library/contacts",
    label: "Contacts",
    screen: ContactsScreen,
    group: "Library",
  },
  {
    id: "accomplishments",
    path: "/library/accomplishments",
    label: "Accomplishments",
    screen: AccomplishmentsScreen,
    group: "Library",
  },
  {
    id: "answers",
    path: "/library/answers",
    label: "Answers",
    screen: AnswersScreen,
    group: "Library",
  },
  {
    id: "projects",
    path: "/library/projects",
    label: "Projects",
    screen: ProjectsScreen,
    group: "Library",
  },
  {
    id: "credentials",
    path: "/library/credentials",
    label: "Credentials",
    screen: CredentialsScreen,
    group: "Library",
  },
  {
    id: "templates",
    path: "/library/templates",
    label: "Templates",
    screen: TemplatesScreen,
    group: "Library",
  },
  {
    id: "library-trash",
    path: "/library/trash",
    label: "Trash",
    screen: TrashScreen,
    group: "Library",
  },

  // Agents
  // Static paths (agent-log, agent-review-queue) BEFORE dynamic /agents/:id
  {
    id: "agents",
    path: "/agents",
    label: "Agents",
    screen: AgentsScreen,
    group: "Agents",
  },
  {
    id: "agent-log",
    path: "/agents/log",
    label: "Agent action log",
    screen: AgentLogScreen,
    group: "Agents",
    active: "agents",
  },
  {
    id: "agent-review-queue",
    path: "/agents/review-queue",
    label: "Agent review queue",
    screen: AgentReviewQueueScreen,
    group: "Agents",
    active: "agents",
  },
  {
    id: "review-changelog",
    path: "/agents/review-changelog",
    label: "Review changelog",
    screen: ReviewChangelogScreen,
    group: "Intelligence",
  },
  {
    id: "agent-detail",
    path: "/agents/:id",
    label: "Per-agent detail",
    screen: AgentDetailScreen,
    group: "Agents",
    active: "agents",
  },

  // Settings
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    screen: SettingsScreen,
    group: "Settings",
  },

  // Archive (ORI-009) -- wins and passed-on views
  {
    id: "wins",
    path: "/wins",
    label: "Wins",
    screen: ArchiveScreen,
    group: "Archive",
  },
  {
    id: "passed-on",
    path: "/passed-on",
    label: "Passed on",
    screen: ArchiveScreen,
    group: "Archive",
  },

  // Dev — component previews from the design's "Modals & misc" group.
  // These aren't real user destinations. Future sidebar filtering can hide
  // them in production builds via the `Dev` group label.
  {
    id: "notifications",
    path: "/dev/notifications",
    label: "Notifications popover (preview)",
    screen: NotificationsScreen,
    group: "Dev",
    bypassFrame: true,
  },
  {
    id: "user-menu",
    path: "/dev/user-menu",
    label: "User menu popover (preview)",
    screen: UserMenuScreen,
    group: "Dev",
    bypassFrame: true,
  },
  {
    id: "extension",
    path: "/dev/extension",
    label: "Browser extension popup (preview)",
    screen: ExtensionScreen,
    group: "Dev",
    bypassFrame: true,
  },
  {
    id: "toasts",
    path: "/dev/toasts",
    label: "Action toast variants (preview)",
    screen: ToastsScreen,
    group: "Dev",
    bypassFrame: true,
  },
] as const

const BY_ID = new Map<string, Route>(ROUTES.map((route) => [route.id, route]))
const BY_PATH = new Map<string, Route>(
  ROUTES.map((route) => [route.path, route]),
)

/** Look up a {@link Route} by its picker ID. Throws if unknown. */
export function routeFor(id: string): Route {
  const route = BY_ID.get(id)
  if (!route) {
    throw new Error(`routeFor: unknown route id "${id}"`)
  }
  return route
}

/** Convenience accessor: just the URL path for a given picker ID. */
export function pathFor(id: string): string {
  return routeFor(id).path
}

/**
 * Reverse lookup: find the picker ID whose path pattern matches `path`.
 * Supports dynamic segments (`:id`) by replacing them with a regex group.
 * Returns `undefined` if no route matches.
 *
 * NOTE: not a substitute for `useMatch()` — this is the cheap helper used
 * by the sidebar to derive active-state highlighting from `location.pathname`.
 */
export function idForPath(path: string): string | undefined {
  // Direct hit — static path
  const direct = BY_PATH.get(path)
  if (direct) {
    return direct.id
  }

  // Dynamic — escape regex chars in literal segments, sub `:slug` for `[^/]+`.
  // Sort longest-path-first so `/applications/new` wins over `/applications/:id`.
  const candidates = [...ROUTES]
    .filter((route) => route.path.includes(":"))
    .sort((routeA, routeB) => routeB.path.length - routeA.path.length)

  for (const route of candidates) {
    const pattern = route.path
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:\w+/g, "[^/]+")
    if (new RegExp(`^${pattern}$`).test(path)) {
      return route.id
    }
  }
  return undefined
}
