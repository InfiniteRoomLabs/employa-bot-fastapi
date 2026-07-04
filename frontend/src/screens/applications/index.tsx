/**
 * Applications - list / table / kanban view of every applied job.
 *
 * Picker id: `applications`
 * Route path: `/applications` (Phase 9)
 *
 * Stories implemented:
 *   TRK-111 -- three-way view switcher, live filter chip counts, error+empty branches
 *   TRK-112 -- resurrected badge in Table+Kanban, filter chip wiring
 *   TRK-120 -- sortable column headers + Sort popover
 *   TRK-121 -- QuickActionMenu (move stage / dismiss / note) with toast+undo
 */

import {
  ArrowUpDownIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  FilterIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { CoLogo } from "@/components/atoms/co-logo"
import { EmptyState } from "@/components/atoms/empty-state"
import { MatchPill } from "@/components/atoms/match-pill"
import { ResourceError } from "@/components/atoms/resource-error"
import { StageBadge } from "@/components/atoms/stage-badge"
import { StageDot } from "@/components/atoms/stage-dot"
import { ReasonChipSelector } from "@/components/domain/reason-chip-selector"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { PopoverContentWithCaret } from "@/components/ui/popover-with-caret"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ApplicationView, Stage } from "@/data/types"
import { useApplicationLifecycle, useApplications, useSearch } from "@/hooks"
import { formatRelativeTime } from "@/lib/relative-time"
import { formatSalary, salaryValue } from "@/lib/salary"

// ---------------------------------------------------------------------------
// Stage ordering (used for sort + next-stage computation)
// ---------------------------------------------------------------------------

const STAGE_ORDER: readonly Stage[] = [
  "saved",
  "draft",
  "applied",
  "screen",
  "interview",
  "offer",
  "rejected",
  "closed",
]

function stageIndex(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage)
}

function nextStage(stage: Stage): Stage {
  const index = stageIndex(stage)
  if (index < 0 || index >= STAGE_ORDER.length - 1) {
    return stage
  }
  return STAGE_ORDER[index + 1]
}

function prevStage(stage: Stage): Stage {
  const index = stageIndex(stage)
  if (index <= 0) {
    return stage
  }
  return STAGE_ORDER[index - 1]
}

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortCol = "days" | "match" | "company" | "stage" | "salary" | "location"
type SortDir = "asc" | "desc"

interface SortState {
  col: SortCol
  dir: SortDir
}

const SORT_LABELS: Record<SortCol, string> = {
  days: "Recency",
  match: "Match",
  company: "Company",
  stage: "Stage",
  salary: "Salary",
  location: "Location",
}

function sortApps(
  apps: readonly ApplicationView[],
  sort: SortState,
): readonly ApplicationView[] {
  return [...apps].sort((first, second) => {
    let comparison = 0
    switch (sort.col) {
      case "days":
        comparison = second.days - first.days // more days = more stale = first
        break
      case "match":
        comparison = second.match - first.match
        break
      case "company":
        comparison = first.company.localeCompare(second.company)
        break
      case "stage":
        comparison = stageIndex(first.stage) - stageIndex(second.stage)
        break
      case "salary":
        comparison = salaryValue(first.salary) - salaryValue(second.salary)
        break
      case "location":
        comparison = first.location.localeCompare(second.location)
        break
    }
    return sort.dir === "asc" ? comparison : -comparison
  })
}

// ---------------------------------------------------------------------------
// Filter chip active-key -> apps predicate
// ---------------------------------------------------------------------------

type FilterKey =
  | "all"
  | "active"
  | "interview"
  | "offer"
  | "archived"
  | "resurrected"

function filterApps(
  apps: readonly ApplicationView[],
  key: FilterKey,
): readonly ApplicationView[] {
  switch (key) {
    case "all":
      return apps
    case "active":
      return apps.filter(
        (application) =>
          application.stage !== "rejected" && application.stage !== "closed",
      )
    case "interview":
      return apps.filter((application) => application.stage === "interview")
    case "offer":
      return apps.filter((application) => application.stage === "offer")
    case "archived":
      return apps.filter(
        (application) =>
          application.stage === "rejected" || application.stage === "closed",
      )
    case "resurrected":
      return apps.filter((application) => application.resurrected === true)
  }
}

// ---------------------------------------------------------------------------
// QuickActionMenu -- shared across ListView and TableView rows
// ---------------------------------------------------------------------------

interface QuickActionMenuProps {
  app: ApplicationView
  onMoveNext: (app: ApplicationView) => void
  onMovePrev: (app: ApplicationView) => void
  onMarkActive: (app: ApplicationView) => void
  onAddNote: (app: ApplicationView) => void
  onDismiss: (app: ApplicationView) => void
}

function QuickActionMenu({
  app,
  onMoveNext,
  onMovePrev,
  onMarkActive,
  onAddNote,
  onDismiss,
}: QuickActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label="Quick actions"
        >
          <MoreHorizontalIcon className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onMoveNext(app)}>
          Move to next stage
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMovePrev(app)}>
          Move back
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onMarkActive(app)}>
          Mark active
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAddNote(app)}>
          Add note
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDismiss(app)}
          className="text-[var(--danger-text)] focus:text-[var(--danger-text)]"
        >
          Dismiss
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// SortIndicator -- arrow icon for sortable th cells
// ---------------------------------------------------------------------------

function SortIndicator({ col, sort }: { col: SortCol; sort: SortState }) {
  if (sort.col !== col) {
    return null
  }
  return sort.dir === "asc" ? (
    <ChevronUpIcon className="ml-1 inline size-3" aria-hidden />
  ) : (
    <ChevronDownIcon className="ml-1 inline size-3" aria-hidden />
  )
}

// ---------------------------------------------------------------------------
// TableView (TRK-120 sortable, TRK-121 quick-action, TRK-112 resurrected badge)
// ---------------------------------------------------------------------------

interface TableViewProps {
  apps: readonly ApplicationView[]
  sort: SortState
  onSort: (col: SortCol) => void
  onMoveNext: (app: ApplicationView) => void
  onMovePrev: (app: ApplicationView) => void
  onMarkActive: (app: ApplicationView) => void
  onAddNote: (app: ApplicationView) => void
  onDismiss: (app: ApplicationView) => void
}

function TableView({
  apps,
  sort,
  onSort,
  onMoveNext,
  onMovePrev,
  onMarkActive,
  onAddNote,
  onDismiss,
}: TableViewProps) {
  const navigate = useNavigate()

  function thClass(col: SortCol) {
    return `cursor-pointer select-none hover:text-[var(--fg-base)] transition-colors ${
      sort.col === col ? "text-[var(--fg-base)]" : ""
    }`
  }

  function ariaSort(col: SortCol): "ascending" | "descending" | "none" {
    if (sort.col !== col) {
      return "none"
    }
    return sort.dir === "asc" ? "ascending" : "descending"
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="tbl w-full">
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            <th
              className={thClass("company")}
              aria-sort={ariaSort("company")}
              onClick={() => onSort("company")}
            >
              Company - Role <SortIndicator col="company" sort={sort} />
            </th>
            <th
              className={thClass("stage")}
              aria-sort={ariaSort("stage")}
              onClick={() => onSort("stage")}
            >
              Stage <SortIndicator col="stage" sort={sort} />
            </th>
            <th
              style={{ width: 80 }}
              className={thClass("match")}
              aria-sort={ariaSort("match")}
              onClick={() => onSort("match")}
            >
              Match <SortIndicator col="match" sort={sort} />
            </th>
            <th
              style={{ width: 60 }}
              className={thClass("days")}
              aria-sort={ariaSort("days")}
              onClick={() => onSort("days")}
            >
              Days <SortIndicator col="days" sort={sort} />
            </th>
            <th
              className={thClass("salary")}
              aria-sort={ariaSort("salary")}
              onClick={() => onSort("salary")}
            >
              Salary <SortIndicator col="salary" sort={sort} />
            </th>
            <th
              className={thClass("location")}
              aria-sort={ariaSort("location")}
              onClick={() => onSort("location")}
            >
              Location <SortIndicator col="location" sort={sort} />
            </th>
            <th>Résumé</th>
            <th style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {apps.map((application) => (
            <tr
              key={application.id}
              className="cursor-pointer hover:bg-[var(--bg-subtle)]"
              onClick={() => navigate(`/applications/${application.id}`)}
            >
              <td />
              <td>
                <div className="flex items-center gap-2.5">
                  <CoLogo name={application.company} size="default" />
                  <div>
                    <div className="font-medium">{application.company}</div>
                    <div className="text-[12px] text-[var(--fg-muted)]">
                      {application.role}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-1.5">
                  <StageBadge
                    stage={application.stage}
                    label={application.stageLabel}
                  />
                  {application.flag === "stale" ? (
                    <Badge variant="warn">stale</Badge>
                  ) : null}
                  {application.resurrected ? (
                    <Badge variant="default" className="text-[10px]">
                      resurrected
                    </Badge>
                  ) : null}
                </div>
              </td>
              <td>
                <MatchPill score={application.match} compact />
              </td>
              <td className="mono text-[12px] text-[var(--fg-muted)]">
                {formatRelativeTime(application.days)}
              </td>
              <td className="mono text-[12px] text-[var(--fg-muted)]">
                {formatSalary(application.salary)}
              </td>
              <td className="text-[12px] text-[var(--fg-muted)]">
                {application.location}
              </td>
              <td className="mono text-[11px] text-[var(--fg-subtle)]">
                {application.resumeName}
              </td>
              <td onClick={(event) => event.stopPropagation()}>
                <QuickActionMenu
                  app={application}
                  onMoveNext={onMoveNext}
                  onMovePrev={onMovePrev}
                  onMarkActive={onMarkActive}
                  onAddNote={onAddNote}
                  onDismiss={onDismiss}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KanbanView (TRK-112 resurrected badge)
// ---------------------------------------------------------------------------

function KanbanView({
  apps,
  sort,
}: {
  apps: readonly ApplicationView[]
  sort: SortState
}) {
  const cols: readonly { id: Stage; label: string }[] = [
    { id: "draft", label: "Drafting" },
    { id: "applied", label: "Applied" },
    { id: "screen", label: "Screen" },
    { id: "interview", label: "Interview" },
    { id: "offer", label: "Offer" },
    { id: "rejected", label: "Rejected" },
  ]
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {cols.map((column) => {
        // Columns group by stage; the active sort orders cards WITHIN a column.
        const items = sortApps(
          apps.filter((application) => application.stage === column.id),
          sort,
        )
        return (
          <div
            key={column.id}
            className="min-h-[420px] w-60 shrink-0 rounded-[var(--radius-lg)] border border-border bg-[var(--bg-subtle)] p-3"
          >
            <div className="mb-2.5 flex items-center gap-2">
              <StageDot stage={column.id} />
              <div className="text-[13px] font-semibold">{column.label}</div>
              <span className="ml-auto font-mono text-[11px] text-[var(--fg-subtle)]">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((application) => (
                <div
                  key={application.id}
                  className="cursor-pointer rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3 shadow-xs"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <CoLogo name={application.company} size="sm" />
                    <div className="flex-1 truncate text-[13px] font-semibold">
                      {application.company}
                    </div>
                  </div>
                  <div className="mb-2 text-[12px] text-[var(--fg-muted)]">
                    {application.role}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                      {application.match}%
                    </span>
                    <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                      - {formatRelativeTime(application.days)}
                    </span>
                    {application.flag === "stale" ? (
                      <Badge variant="warn">stale</Badge>
                    ) : null}
                    {application.resurrected ? (
                      <Badge variant="default" className="text-[10px]">
                        resurrected
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
              {items.length === 0 ? (
                <div className="py-5 text-center text-[12px] text-[var(--fg-subtle)]">
                  -
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ListView (TRK-121 quick-action added)
// ---------------------------------------------------------------------------

interface ListViewProps {
  apps: readonly ApplicationView[]
  onMoveNext: (app: ApplicationView) => void
  onMovePrev: (app: ApplicationView) => void
  onMarkActive: (app: ApplicationView) => void
  onAddNote: (app: ApplicationView) => void
  onDismiss: (app: ApplicationView) => void
}

function ListView({
  apps,
  onMoveNext,
  onMovePrev,
  onMarkActive,
  onAddNote,
  onDismiss,
}: ListViewProps) {
  const navigate = useNavigate()
  const [activeId, setActiveId] = React.useState(apps[0]?.id ?? "")
  const active =
    apps.find((application) => application.id === activeId) ?? apps[0]
  return (
    <div className="grid grid-cols-[340px_1fr] items-start gap-4">
      <div className="card max-h-[720px] overflow-auto p-0">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
          <SearchIcon className="size-3.5 text-[var(--fg-subtle)]" />
          <Input
            placeholder="Filter applications..."
            className="h-7 border-0 bg-transparent p-0 text-[12px]"
          />
        </div>
        {apps.map((application) => (
          <div
            key={application.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveId(application.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setActiveId(application.id)
              }
            }}
            aria-current={application.id === activeId ? "true" : "false"}
            className="group w-full cursor-pointer border-t border-border px-3.5 py-3 text-left aria-[current=true]:border-l-2 aria-[current=true]:border-l-[var(--accent)] aria-[current=true]:bg-[var(--bg-subtle)]"
          >
            <div className="mb-1 flex items-center gap-2">
              <StageDot stage={application.stage} />
              <div className="flex-1 truncate text-[13px] font-semibold">
                {application.company}
              </div>
              <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                {application.match}%
              </span>
              <span
                onClick={(event) => event.stopPropagation()}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <QuickActionMenu
                  app={application}
                  onMoveNext={onMoveNext}
                  onMovePrev={onMovePrev}
                  onMarkActive={onMarkActive}
                  onAddNote={onAddNote}
                  onDismiss={onDismiss}
                />
              </span>
            </div>
            <div className="mb-1.5 truncate text-[12px] text-[var(--fg-muted)]">
              {application.role}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                {formatRelativeTime(application.days)}
              </span>
              {application.flag === "stale" ? (
                <Badge variant="warn">stale</Badge>
              ) : null}
              {application.flag === "offer" ? (
                <Badge variant="success">offer</Badge>
              ) : null}
              {application.resurrected ? <Badge>resurrected</Badge> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="card p-6">
        {active ? (
          <>
            <div className="mb-5 flex items-start gap-4">
              <CoLogo name={active.company} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-xl font-semibold tracking-[-0.015em]">
                  {active.company}
                </h2>
                <div className="text-[13px] text-[var(--fg-muted)]">
                  {active.role} - {active.location} -{" "}
                  <span className="mono">{formatSalary(active.salary)}</span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  {active.flag === "stale" ? (
                    <Badge variant="warn">
                      stale - {formatRelativeTime(active.days)}
                    </Badge>
                  ) : null}
                  {active.flag === "offer" ? (
                    <Badge variant="success">offer pending</Badge>
                  ) : null}
                  <MatchPill score={active.match} />
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate(`/applications/${active.id}`)}
              >
                Open detail
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                  Résumé used
                </div>
                <div className="text-[13px] font-medium">
                  {active.resumeName}
                </div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                  Source
                </div>
                <div className="text-[13px] font-medium">{active.source}</div>
              </div>
              <div className="rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                  Contact
                </div>
                <div className="text-[13px] font-medium">
                  {active.contact ?? "Not captured"}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApplicationsScreen
// ---------------------------------------------------------------------------

export default function ApplicationsScreen() {
  const [view, setView] = React.useState<"list" | "table" | "kanban">("list")
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>("all")
  // Filter button toggles the pills row. Hidden row => filters not applied.
  const [filtersOpen, setFiltersOpen] = React.useState(true)
  const [sort, setSort] = React.useState<SortState>({
    col: "days",
    dir: "desc",
  })
  const [sortOpen, setSortOpen] = React.useState(false)

  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const searchId = params.id
  const {
    data: fetchedApps,
    isLoading,
    error,
    refetch,
  } = useApplications(searchId)
  const { data: search } = useSearch(searchId ?? "")
  const searchName = search?.name ?? "Staff / Principal - Platform - remote"

  // ----- In-screen mutable app list (TRK-121)
  // Initialized from fetched data. Local mutations (move-stage, dismiss) update
  // this state. Resetting fetchedApps (refetch) wipes local mutations -- intentional
  // mockup behavior: no persistence across refetch or page reload.
  const [localApps, setLocalApps] = React.useState<ApplicationView[]>([])
  const lifecycle = useApplicationLifecycle()
  // D12/D16: post-APPLIED dismiss opens a withdraw-reason dialog.
  const [withdrawApp, setWithdrawApp] = React.useState<ApplicationView | null>(
    null,
  )
  const [withdrawReasons, setWithdrawReasons] = React.useState<string[]>([])
  React.useEffect(() => {
    if (fetchedApps) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalApps([...fetchedApps])
    }
  }, [fetchedApps])

  // ----- Derived counts for filter chips (TRK-111, live from localApps)
  const chipCounts = React.useMemo<Record<FilterKey, number>>(() => {
    const all = localApps.length
    const active = localApps.filter(
      (application) =>
        application.stage !== "rejected" && application.stage !== "closed",
    ).length
    const interview = localApps.filter(
      (application) => application.stage === "interview",
    ).length
    const offer = localApps.filter(
      (application) => application.stage === "offer",
    ).length
    const archived = localApps.filter(
      (application) =>
        application.stage === "rejected" || application.stage === "closed",
    ).length
    const resurrected = localApps.filter(
      (application) => application.resurrected === true,
    ).length
    return { all, active, interview, offer, archived, resurrected }
  }, [localApps])

  const FILTERS: readonly { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "interview", label: "Interviewing" },
    { key: "offer", label: "Offers" },
    { key: "archived", label: "Archived" },
    { key: "resurrected", label: "Resurrected" },
  ]

  // ----- Filtered + sorted pipeline. When the pills row is hidden, filters
  // are not applied (effective filter = all).
  const effectiveFilter: FilterKey = filtersOpen ? activeFilter : "all"
  const filteredApps = React.useMemo(
    () => filterApps(localApps, effectiveFilter),
    [localApps, effectiveFilter],
  )

  // Table+List respect sort order; Kanban groups by stage so order is irrelevant
  const sortedApps = React.useMemo(
    () => (view !== "kanban" ? sortApps(filteredApps, sort) : filteredApps),
    [filteredApps, sort, view],
  )

  // Summary header counts
  const total = chipCounts.all
  const offers = chipCounts.offer
  const resurrected = chipCounts.resurrected

  // ----- Sort column toggle
  function handleSort(col: SortCol) {
    setSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "company" || col === "stage" ? "asc" : "desc" },
    )
  }

  // ----- Quick-action handlers (TRK-121)
  function handleMoveNext(app: ApplicationView) {
    const next = nextStage(app.stage)
    if (next === app.stage) {
      return
    }
    const prev = app.stage
    setLocalApps((prev2) =>
      prev2.map((application) =>
        application.id === app.id
          ? { ...application, stage: next, stageLabel: next }
          : application,
      ),
    )
    toast.success({
      title: `Moved to ${next}`,
      sub: app.company,
      undo: {
        onUndo: () =>
          setLocalApps((previous) =>
            previous.map((application) =>
              application.id === app.id
                ? { ...application, stage: prev, stageLabel: prev }
                : application,
            ),
          ),
      },
    })
  }

  function handleMovePrev(app: ApplicationView) {
    const prev2 = prevStage(app.stage)
    if (prev2 === app.stage) {
      return
    }
    const orig = app.stage
    setLocalApps((previous) =>
      previous.map((application) =>
        application.id === app.id
          ? { ...application, stage: prev2, stageLabel: prev2 }
          : application,
      ),
    )
    toast.success({
      title: `Moved back to ${prev2}`,
      sub: app.company,
      undo: {
        onUndo: () =>
          setLocalApps((previous) =>
            previous.map((application) =>
              application.id === app.id
                ? { ...application, stage: orig, stageLabel: orig }
                : application,
            ),
          ),
      },
    })
  }

  function handleMarkActive(app: ApplicationView) {
    setLocalApps((previous) =>
      previous.map((application) =>
        application.id === app.id
          ? { ...application, stage: "applied", stageLabel: "applied" }
          : application,
      ),
    )
    toast.success({ title: "Marked active", sub: app.company })
  }

  function handleAddNote(app: ApplicationView) {
    toast.default({
      title: "Note added (demo)",
      sub: `${app.company} - Notes are not persisted in the mockup.`,
    })
  }

  function removeFromActive(app: ApplicationView): ApplicationView[] {
    const snapshot = [...localApps]
    setLocalApps((previous) =>
      previous.filter((application) => application.id !== app.id),
    )
    return snapshot
  }

  // D12: dismissing branches on stage. Pre-commit (SAVED/DRAFT) removes the
  // posting with a quick undo; post-APPLIED maps to WITHDREW with reason chips
  // (a committed application is never silently deleted) via a reason dialog.
  function handleDismiss(app: ApplicationView) {
    const preApplied = app.stage === "saved" || app.stage === "draft"
    if (!preApplied) {
      setWithdrawReasons([])
      setWithdrawApp(app)
      return
    }
    const snapshot = removeFromActive(app)
    void lifecycle.dismiss(app.id).catch(() => undefined)
    toast.success({
      title: "Dismissed",
      sub: app.company,
      undo: { onUndo: () => setLocalApps(snapshot) },
    })
  }

  async function confirmWithdraw() {
    if (!withdrawApp) {
      return
    }
    const app = withdrawApp
    setWithdrawApp(null)
    try {
      await lifecycle.dismiss(app.id, withdrawReasons)
      removeFromActive(app)
      toast.success({
        title: "Withdrew application",
        sub: `${app.company} moved to Passed on.`,
      })
    } catch {
      toast.error({ title: "Could not withdraw", sub: "Please try again." })
    }
  }

  // ----- Export CSV (TRK-122): real client-side download of the visible rows
  function handleExportCsv() {
    if (sortedApps.length === 0) {
      toast.default({
        title: "Nothing to export",
        sub: "No applications in the current view.",
      })
      return
    }
    const header = [
      "Company",
      "Role",
      "Stage",
      "Match",
      "Days",
      "Salary",
      "Location",
      "Resume",
    ]
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [
      header.join(","),
      ...sortedApps.map((application) =>
        [
          application.company,
          application.role,
          application.stage,
          application.match,
          application.days,
          formatSalary(application.salary),
          application.location,
          application.resumeName,
        ]
          .map(esc)
          .join(","),
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "applications.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success({
      title: "Exported CSV",
      sub: `${sortedApps.length} application(s) downloaded.`,
    })
  }

  const mutationProps = {
    onMoveNext: handleMoveNext,
    onMovePrev: handleMovePrev,
    onMarkActive: handleMarkActive,
    onAddNote: handleAddNote,
    onDismiss: handleDismiss,
  }

  return (
    <AppFrame
      active="applications"
      title={`Applications - ${searchName}`}
      subtitle={`${total} active - ${offers} offer - ${resurrected} resurrected`}
    >
      <PageHead
        eyebrow={searchName}
        title="Applications"
        lede="Everything you've sent, in one feed. Filters, stages, ghosting-alerts and resurrected applications all live here."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              <DownloadIcon className="size-3.5" /> Export CSV
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/applications/new")}
            >
              <PlusIcon className="size-3.5" /> Add application
            </Button>
          </>
        }
      />

      {/* View + sort toolbar */}
      <div className="mb-4 flex items-center gap-2">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => value && setView(value as typeof view)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="list">List + detail</ToggleGroupItem>
          <ToggleGroupItem value="table">Table</ToggleGroupItem>
          <ToggleGroupItem value="kanban">Kanban</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex-1" />
        <Button
          variant={filtersOpen ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <FilterIcon className="size-3" /> Filter
        </Button>

        {/* Sort popover (TRK-120) */}
        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <ArrowUpDownIcon className="size-3" /> Sort:{" "}
              {SORT_LABELS[sort.col]} ({sort.dir})
            </Button>
          </PopoverTrigger>
          <PopoverContentWithCaret
            caret="top"
            align="end"
            className="w-48 p-3"
            sideOffset={8}
          >
            <RadioGroup
              value={sort.col}
              onValueChange={(value) =>
                setSort((previousSort) => ({
                  ...previousSort,
                  col: value as SortCol,
                }))
              }
              className="flex flex-col gap-2"
            >
              {(Object.keys(SORT_LABELS) as SortCol[]).map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <RadioGroupItem value={col} id={`sort-${col}`} />
                  <Label
                    htmlFor={`sort-${col}`}
                    className="cursor-pointer text-[13px]"
                  >
                    {SORT_LABELS[col]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[12px] text-[var(--fg-muted)]">
                Direction
              </span>
              <ToggleGroup
                type="single"
                value={sort.dir}
                onValueChange={(value) =>
                  value &&
                  setSort((previousSort) => ({
                    ...previousSort,
                    dir: value as SortDir,
                  }))
                }
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="asc">Asc</ToggleGroupItem>
                <ToggleGroupItem value="desc">Desc</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </PopoverContentWithCaret>
        </Popover>
      </div>

      {/* Filter chips (TRK-111 live counts, TRK-112 resurrected). Toggled by
          the Filter button -- hidden row means no filter is applied. */}
      {filtersOpen ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((filterOption) => (
            <Chip
              key={filterOption.key}
              pressed={activeFilter === filterOption.key}
              count={chipCounts[filterOption.key]}
              onPressedChange={() => setActiveFilter(filterOption.key)}
            >
              {filterOption.label}
            </Chip>
          ))}
        </div>
      ) : null}

      {/* Body: loading / error / empty / view */}
      {isLoading && !fetchedApps ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <ResourceError label="applications" error={error} onRetry={refetch} />
      ) : sortedApps.length === 0 ? (
        <EmptyState
          icon={BriefcaseIcon}
          headline={
            effectiveFilter === "all"
              ? "No applications yet"
              : `No ${FILTERS.find((filterOption) => filterOption.key === effectiveFilter)?.label.toLowerCase()} applications`
          }
          body={
            effectiveFilter === "all"
              ? "Add your first application to get started."
              : "Try a different filter or add new applications."
          }
          cta={
            effectiveFilter !== "all"
              ? { label: "Show all", onClick: () => setActiveFilter("all") }
              : undefined
          }
        />
      ) : view === "list" ? (
        <ListView apps={sortedApps} {...mutationProps} />
      ) : view === "table" ? (
        <TableView
          apps={sortedApps}
          sort={sort}
          onSort={handleSort}
          {...mutationProps}
        />
      ) : (
        // Kanban groups by stage; the active sort orders cards within each column
        <KanbanView apps={filteredApps} sort={sort} />
      )}

      {/* D12/D16: withdraw-reason dialog for post-APPLIED dismissals */}
      <Dialog
        open={withdrawApp !== null}
        onOpenChange={(open) => !open && setWithdrawApp(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw this application?</DialogTitle>
            <DialogDescription>
              {withdrawApp?.company} is past APPLIED, so dismissing it records a
              withdrawal (it moves to Passed on). Pick the reasons that fit --
              they help you spot patterns later.
            </DialogDescription>
          </DialogHeader>
          <ReasonChipSelector
            selected={withdrawReasons}
            onChange={(next) => setWithdrawReasons([...next])}
            showSystemTier
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="default"
              onClick={confirmWithdraw}
              disabled={lifecycle.isBusy}
            >
              {lifecycle.isBusy ? "Withdrawing..." : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppFrame>
  )
}
