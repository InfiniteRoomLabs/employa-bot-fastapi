import {
  Archive,
  Award,
  BadgeCheck,
  Bookmark,
  Bot,
  Briefcase,
  ChevronsUpDown,
  ClipboardCheck,
  FileText,
  FolderGit2,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  MessageCircleQuestion,
  MessageSquareHeart,
  Plus,
  Settings2,
  Telescope,
  Trophy,
  Users,
} from "lucide-react"
import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { BudgetBar } from "@/components/atoms/budget-bar"
import { UserMenuPopover } from "@/components/domain/user-menu-popover"
import { Avatar } from "@/components/ui/avatar-eb"
import { toast } from "@/components/ui/toast"
import { clearToken } from "@/data/api"
import {
  SEARCH_ID_AI_INFRA,
  SEARCH_ID_BACKEND,
  SEARCH_ID_PLATFORM,
} from "@/data/fixtures"
import type { UserMenuRow } from "@/data/types"
import { useArchiveCounts, useBudgetSummary, useSearches } from "@/hooks"
import { cn } from "@/lib/utils"
import { idForPath, pathFor } from "@/routes"

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Identifier of the currently active screen. When omitted, the active
   * id is derived from `useLocation().pathname` via `idForPath`. Screens
   * that pre-Phase-9 forwarded an explicit `active` still win - the prop
   * remains the override.
   */
  active?: string
}

const ACTIVE_SEARCH_ID = SEARCH_ID_PLATFORM

const dollarFormat = (n: number): string => `$${n.toFixed(2)}`

const SAVED_SEARCH_IDS = new Set<string>([
  SEARCH_ID_PLATFORM,
  SEARCH_ID_BACKEND,
  SEARCH_ID_AI_INFRA,
])

function inSearchesBranch(active?: string): boolean {
  return (
    active === "searches" ||
    active === "search-criteria" ||
    active === "search-detail" ||
    active === "jobs" ||
    active === "shortlist" ||
    active === "applications" ||
    active === "app-detail" ||
    active === "add-app" ||
    (typeof active === "string" && SAVED_SEARCH_IDS.has(active))
  )
}

/**
 * Multi-level workspace nav rendered on every screen. Composes
 * `BudgetBar` for the spend readout (wired to `useBudgetSummary`) and
 * `UserMenuPopover` for the user pod. Active state is mirrored on each
 * nav element via `aria-current` so screen tests + a11y trees stay honest.
 *
 * ORI-008: "Wins" and "Passed on" are now Links to /wins and /passed-on
 * (the catch-all NotFoundScreen handles them until ORI-009 ships).
 * ORI-010: User pod is now wrapped by UserMenuPopover (sign-out + Settings).
 * CTX-105: BudgetBar is wired to useBudgetSummary and wrapped in a Link
 * to /settings?tab=usage.
 */
const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { className, active: activeProp, ...props },
  ref,
) {
  const location = useLocation()
  const navigate = useNavigate()

  // Explicit prop wins for backward compatibility; otherwise derive from URL.
  const active = activeProp ?? idForPath(location.pathname)
  // Pull the current saved-search id from `/searches/<uuid>` so the
  // sidebar can highlight the right branch even though `idForPath` only
  // gives us the route id (`search-detail`).
  const currentSearchId = (() => {
    const m = location.pathname.match(/^\/searches\/([^/]+)/)
    return m ? m[1] : undefined
  })()
  // SEARCH gap: derive saved-search sublist from live mutable _searches array
  // so newly created searches appear in the sidebar without a page reload.
  // Falls back to an empty array while loading -- the static SAVED_SEARCH_IDS
  // set still gates inSearchesBranch for highlight logic.
  const { data: searchesData } = useSearches()
  const liveSearches = React.useMemo(() => searchesData ?? [], [searchesData])
  // Build a live set of search IDs for the inSearches derivation below.
  const liveSearchIds = React.useMemo(
    () => new Set(liveSearches.map((savedSearch) => savedSearch.id)),
    [liveSearches],
  )
  const inSearches =
    inSearchesBranch(active) ||
    (currentSearchId != null &&
      (SAVED_SEARCH_IDS.has(currentSearchId) ||
        liveSearchIds.has(currentSearchId)))

  // CTX-105: derive live budget figures from shared hook (one source of truth
  // with the settings usage panel via BUDGET_USED / BUDGET_TOTAL constants).
  const { used: budgetUsed, total: budgetTotal } = useBudgetSummary()

  // ORI-009: live archive badge counts -- sidebar badges match rendered row counts.
  const { data: archiveCounts } = useArchiveCounts()

  // ORI-010: sign-out handler clears the stored token then navigates to /login.
  const handleSignOut = React.useCallback(() => {
    clearToken()
    toast.success({ title: "Signed out" })
    setTimeout(() => {
      navigate(pathFor("login"))
    }, 400)
  }, [navigate])

  // ORI-010: generic row select handler - Settings navigates, others toast.
  const handleUserMenuSelect = React.useCallback(
    (row: UserMenuRow) => {
      if (row.icon === "settings-2") {
        navigate(pathFor("settings"))
      } else {
        toast.default({ title: row.label, sub: "Demo only" })
      }
    },
    [navigate],
  )

  // The user pod div that acts as the DropdownMenu trigger.
  const userPodTrigger = (
    <div className="app__user-pod" data-nav-id="user-menu">
      <Avatar name="Wes Gilleland" accent />
      <div className="col flex-1">
        <span className="who">Wes Gilleland</span>
        <span className="sub">Pro plan</span>
      </div>
      <ChevronsUpDown
        className="size-3.5"
        aria-hidden
        style={{ color: "var(--fg-subtle)" }}
      />
    </div>
  )

  return (
    <aside
      ref={ref}
      data-slot="sidebar"
      className={cn("app__sidebar", className)}
      {...props}
    >
      <div className="app__brand">
        <img
          className="picker__brand-mark"
          src="/mark.svg"
          alt=""
          width={28}
          height={28}
        />
        <div className="app__brand-name">
          employa<span className="muted">-bot</span>
        </div>
      </div>

      <div className="app__nav">
        <div className="nav-group__label">Workspace</div>
        <Link
          to={pathFor("dashboard")}
          className="nav-item"
          data-nav-id="dashboard"
          aria-current={active === "dashboard" ? "page" : undefined}
        >
          <LayoutDashboard className="size-4" aria-hidden />
          <span>Dashboard</span>
        </Link>

        {/* `searches` is an expand affordance only - no destination screen.
            Keep as a plain button so it stays clickable for future toggle
            logic without manufacturing an unowned route. */}
        <button
          type="button"
          className="nav-item"
          data-nav-id="searches"
          aria-current={active === "searches" ? "page" : undefined}
        >
          <Telescope className="size-4" aria-hidden />
          <span>My searches</span>
          {/* SEARCH gap: count derived from live useSearches() data */}
          <span className="nav-count">{liveSearches.length || 3}</span>
        </button>

        <div className="nav-sublist">
          {liveSearches.map((savedSearch) => {
            const searchState = savedSearch.state ?? "active"
            const isCurrent =
              active === savedSearch.id ||
              currentSearchId === savedSearch.id ||
              (savedSearch.id === ACTIVE_SEARCH_ID &&
                inSearches &&
                currentSearchId == null)
            const to = `/searches/${savedSearch.id}`
            return (
              <div key={savedSearch.id}>
                <Link
                  to={to}
                  className="nav-item nav-subitem"
                  data-nav-id={savedSearch.id}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  <span className="nav-subitem__label">{savedSearch.name}</span>
                  <span className={`search-state search-state--${searchState}`}>
                    {searchState === "active" ? "running" : "paused"}
                  </span>
                </Link>
                {isCurrent ? (
                  <div className="nav-subitem-children">
                    <Link
                      to={`/searches/${savedSearch.id}/shortlist`}
                      className="nav-item nav-subitem nav-subitem--child"
                      data-nav-id="shortlist"
                      aria-current={
                        active === "search-shortlist" || active === "shortlist"
                          ? "page"
                          : undefined
                      }
                    >
                      <Bookmark className="size-3" aria-hidden />
                      <span className="nav-subitem__label">Shortlist</span>
                    </Link>
                    <Link
                      to={`/searches/${savedSearch.id}/inbox`}
                      className="nav-item nav-subitem nav-subitem--child"
                      data-nav-id="jobs"
                      aria-current={
                        active === "search-inbox" || active === "jobs"
                          ? "page"
                          : undefined
                      }
                    >
                      <Inbox className="size-3" aria-hidden />
                      <span className="nav-subitem__label">Jobs inbox</span>
                    </Link>
                    <Link
                      to={`/searches/${savedSearch.id}/applications`}
                      className="nav-item nav-subitem nav-subitem--child"
                      data-nav-id="applications"
                      aria-current={
                        active === "search-applications" ||
                        active === "applications" ||
                        active === "app-detail" ||
                        active === "add-app"
                          ? "page"
                          : undefined
                      }
                    >
                      <Briefcase className="size-3" aria-hidden />
                      <span className="nav-subitem__label">Applications</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            )
          })}
          <Link
            to={pathFor("search-criteria")}
            className="nav-item nav-subitem nav-subitem--add"
            data-nav-id="new-search"
          >
            <Plus className="size-3" aria-hidden />
            <span>New search</span>
          </Link>
        </div>

        <div className="nav-group__label nav-group__label--spaced">Library</div>
        <Link
          to={pathFor("library")}
          className="nav-item"
          data-nav-id="library"
          aria-current={active === "library" ? "page" : undefined}
        >
          <Library className="size-4" aria-hidden />
          <span>Overview</span>
        </Link>
        <Link
          to={pathFor("resumes")}
          className="nav-item"
          data-nav-id="resumes"
          aria-current={
            active === "resumes" ||
            active === "match-explorer" ||
            active === "resume-editor"
              ? "page"
              : undefined
          }
        >
          <FileText className="size-4" aria-hidden />
          <span>Resumes</span>
        </Link>
        <Link
          to={pathFor("contacts")}
          className="nav-item"
          data-nav-id="contacts"
          aria-current={active === "contacts" ? "page" : undefined}
        >
          <Users className="size-4" aria-hidden />
          <span>Contacts</span>
        </Link>
        <Link
          to={pathFor("accomplishments")}
          className="nav-item"
          data-nav-id="accomplishments"
          aria-current={active === "accomplishments" ? "page" : undefined}
        >
          <Award className="size-4" aria-hidden />
          <span>Accomplishments</span>
        </Link>
        <Link
          to={pathFor("answers")}
          className="nav-item"
          data-nav-id="answers"
          aria-current={active === "answers" ? "page" : undefined}
        >
          <MessageCircleQuestion className="size-4" aria-hidden />
          <span>Answers</span>
        </Link>
        <Link
          to={pathFor("projects")}
          className="nav-item"
          data-nav-id="projects"
          aria-current={active === "projects" ? "page" : undefined}
        >
          <FolderGit2 className="size-4" aria-hidden />
          <span>Projects</span>
        </Link>
        <Link
          to={pathFor("credentials")}
          className="nav-item"
          data-nav-id="credentials"
          aria-current={active === "credentials" ? "page" : undefined}
        >
          <BadgeCheck className="size-4" aria-hidden />
          <span>Credentials</span>
        </Link>
        <Link
          to={pathFor("templates")}
          className="nav-item"
          data-nav-id="templates"
          aria-current={active === "templates" ? "page" : undefined}
        >
          <LayoutTemplate className="size-4" aria-hidden />
          <span>Templates</span>
        </Link>

        <div className="nav-group__label nav-group__label--spaced">
          Intelligence
        </div>
        <Link
          to={pathFor("coach")}
          className="nav-item"
          data-nav-id="coach"
          aria-current={active === "coach" ? "page" : undefined}
        >
          <MessageSquareHeart className="size-4" aria-hidden />
          <span>Coach</span>
        </Link>
        <Link
          to={pathFor("agents")}
          className="nav-item"
          data-nav-id="agents"
          aria-current={
            active === "agents" ||
            active === "agent-log" ||
            active === "agent-detail"
              ? "page"
              : undefined
          }
        >
          <Bot className="size-4" aria-hidden />
          <span>Agents</span>
          <span className="dot dot--live nav-item__trailing-dot" />
        </Link>
        <Link
          to={pathFor("review-changelog")}
          className="nav-item"
          data-nav-id="review-changelog"
          aria-current={active === "review-changelog" ? "page" : undefined}
        >
          <ClipboardCheck className="size-4" aria-hidden />
          <span>Review Changelog</span>
        </Link>

        {/* ORI-008: Converted from plain <button> to <Link> so /wins and
            /passed-on resolve to the catch-all NotFoundScreen gracefully
            until ORI-009 ships the real archive screens. */}
        <div className="nav-group__label nav-group__label--spaced">Archive</div>
        <Link
          to="/wins"
          className="nav-item"
          data-nav-id="wins"
          aria-current={active === "wins" ? "page" : undefined}
        >
          <Trophy className="size-4" aria-hidden />
          <span>Wins</span>
          {archiveCounts != null ? (
            <span className="nav-count">{archiveCounts.won}</span>
          ) : null}
        </Link>
        <Link
          to="/passed-on"
          className="nav-item"
          data-nav-id="passed-on"
          aria-current={active === "passed-on" ? "page" : undefined}
        >
          <Archive className="size-4" aria-hidden />
          <span>Passed on</span>
          {archiveCounts != null ? (
            <span className="nav-count">{archiveCounts.passed}</span>
          ) : null}
        </Link>
      </div>

      <div className="app__nav-bottom">
        {/* CTX-105: BudgetBar is wired to useBudgetSummary() and wrapped in
            a Link to /settings?tab=usage so clicking navigates to the AI
            usage panel. The block display preserves the BudgetBar layout. */}
        <Link
          to="/settings?tab=usage"
          className="block"
          aria-label="View AI budget usage in Settings"
        >
          <BudgetBar
            label="budget"
            used={budgetUsed}
            total={budgetTotal}
            format={dollarFormat}
            className="app__nav-bottom-budget"
          />
        </Link>
        <Link
          to={pathFor("settings")}
          className="nav-item"
          data-nav-id="settings"
          aria-current={active === "settings" ? "page" : undefined}
        >
          <Settings2 className="size-4" aria-hidden />
          <span>Settings</span>
        </Link>

        {/* ORI-010: user pod wrapped with UserMenuPopover. The div becomes
            the DropdownMenuTrigger child (asChild) so Radix injects button
            semantics - no explicit role needed. */}
        <UserMenuPopover
          trigger={userPodTrigger}
          onSignOut={handleSignOut}
          onSelect={handleUserMenuSelect}
        />
      </div>
    </aside>
  )
})

export { Sidebar }
