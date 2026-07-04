/**
 * CommandPalette -- ORI-011
 *
 * A Cmd-K / Ctrl-K searchable navigation palette. Destinations are derived
 * from the ROUTES table, filtered to exclude the Dev group and routes with
 * dynamic `:id` segments (which have no stable canonical URL to navigate to).
 * Routes with the same group are rendered under a shared CommandGroup heading.
 *
 * The palette opens via:
 *   - Topbar search Input click (delegating to onOpenChange)
 *   - Keyboard shortcut Cmd-K / Ctrl-K (handled inside Topbar)
 *   - Programmatic open via the `open` prop
 *
 * Escape closes via Radix Dialog's built-in behavior; focus returns to the
 * previously focused element via the Dialog's returnFocus behavior (Radix).
 */

import {
  BarChart2,
  BotIcon,
  Briefcase,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogIn,
  MessageSquareHeart,
  PlusCircle,
  ScrollText,
  Search,
  Settings2,
  Telescope,
  Trophy,
} from "lucide-react"
import * as React from "react"
import { useNavigate } from "react-router-dom"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { ROUTES } from "@/routes"

// ---------------------------------------------------------------------------
// Icon mapping by route id
// ---------------------------------------------------------------------------

const ROUTE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  dashboard: LayoutDashboard,
  "add-app": PlusCircle,
  applications: Briefcase,
  shortlist: ListChecks,
  jobs: Inbox,
  "search-criteria": Telescope,
  resumes: FileText,
  "match-explorer": BarChart2,
  "resume-editor": ScrollText,
  coach: MessageSquareHeart,
  agents: BotIcon,
  "agent-log": ScrollText,
  "agent-review-queue": ListChecks,
  settings: Settings2,
  onboarding: Home,
  auth: LogIn,
  wins: Trophy,
}

const DEFAULT_ICON = Search

// ---------------------------------------------------------------------------
// Route filtering
//
// Exclude:
//   - group === 'Dev' (component previews, not real user destinations)
//   - routes with `:id` in the path (no stable destination to navigate to)
//   - routes that are duplicated sub-views where the parent is more canonical
//     (search-shortlist, search-inbox, search-applications, search-detail,
//      search-criteria-edit, mark-won, resume-editor-param, resume-preview,
//      agent-detail) -- keep only the top-level canonical routes
// ---------------------------------------------------------------------------

const EXCLUDED_IDS = new Set([
  // per-search nested views (duplicate of top-level routes)
  "search-shortlist",
  "search-inbox",
  "search-applications",
  "search-detail",
  "search-criteria-edit",
  // stacked / modal / preview routes with :id params
  "mark-won",
  "resume-editor-param",
  "resume-preview",
  "agent-detail",
  "app-detail",
])

const PALETTE_ROUTES = ROUTES.filter(
  (route) =>
    route.group !== "Dev" &&
    !EXCLUDED_IDS.has(route.id) &&
    !route.path.includes(":"),
)

// Group routes preserving declaration order. The group heading doubles as
// the CommandGroup heading label shown above each section.
interface RouteGroup {
  group: string
  routes: typeof PALETTE_ROUTES
}

// Mockup-only scaffolding (onboarding/auth flow entry points) is still reachable
// in the mockup but is NOT real production navigation -- it is bucketed into one
// clearly-labeled group pinned to the bottom so it is obvious to drop later.
const MOCKUP_GROUP = "Mockup-only (drop in production)"

function buildGroups(routes: typeof PALETTE_ROUTES): RouteGroup[] {
  const seen = new Map<string, RouteGroup>()
  const order: string[] = []

  for (const route of routes) {
    const g = route.mockupOnly ? MOCKUP_GROUP : (route.group ?? "Other")
    if (!seen.has(g)) {
      seen.set(g, { group: g, routes: [] })
      order.push(g)
    }
    seen.get(g)!.routes.push(route)
  }

  // Pin the mockup-only bucket to the end regardless of declaration order.
  order.sort(
    (a, b) => (a === MOCKUP_GROUP ? 1 : 0) - (b === MOCKUP_GROUP ? 1 : 0),
  )

  return order.map((group) => seen.get(group)!)
}

const GROUPS = buildGroups(PALETTE_ROUTES)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

/**
 * The global command palette. Mount once in the app topbar; open/close via
 * the `open` + `onOpenChange` props. Navigation is handled by `useNavigate`.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = React.useState("")

  // Clear query when palette closes so the next open starts fresh.
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => setQuery(""), 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleSelect = React.useCallback(
    (path: string) => {
      navigate(path)
      onOpenChange(false)
    },
    [navigate, onOpenChange],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Navigate"
      description="Jump to any section of Employa-Bot"
    >
      <Command shouldFilter>
        <CommandInput
          placeholder="Where do you want to go?"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No results for &quot;{query}&quot;</CommandEmpty>
          {GROUPS.map((group, index) => (
            <React.Fragment key={group.group}>
              {index > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={group.group}>
                {group.routes.map((route) => {
                  const Icon = ROUTE_ICONS[route.id] ?? DEFAULT_ICON
                  return (
                    <CommandItem
                      key={route.id}
                      value={route.label}
                      onSelect={() => handleSelect(route.path)}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span>{route.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
