/**
 * Jobs inbox + job detail. Bleed layout - full-height list + right pane.
 *
 * Picker id: `jobs`
 * Route path: `/jobs` (Phase 9)
 *
 * Contracts implemented:
 *   CUR-017 -- error+retry via <ResourceError> in both the list pane and detail pane
 *   CUR-024 -- <EmptyState> when list is empty; chip counts derived from data
 *   ORI-014 -- toast feedback on '+ Shortlist' and 'Apply now' primary CTAs
 */

import {
  AlertTriangleIcon,
  ArchiveIcon,
  Building2Icon,
  CheckCircle2Icon,
  ClockIcon,
  ExternalLinkIcon,
  FileTextIcon,
  InboxIcon,
  LandmarkIcon,
  MapPinIcon,
  PlusIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SplitSquareHorizontalIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react"
import * as React from "react"

import { Link, useNavigate, useParams } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { JobInboxRow } from "@/components/domain/job-inbox-row"
import { AppFrame } from "@/components/shell/app-frame"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { Job, JobInboxItem } from "@/data/types"
import { useAddJobToShortlist, useJobs, useJobsInbox, useSearch } from "@/hooks"
import { formatSalary } from "@/lib/salary"

type InboxRow = {
  job: JobInboxItem
  key: number
  status: "active" | "archived"
}

/**
 * Project a captured Job (the DB-backed canonical collection, ADR-006) onto
 * the row shape this screen renders. The default /jobs view lists captured
 * jobs via getJobs since sprint-02 (PIN-2); search-scoped views keep the
 * mock inbox feed, so both sources meet at JobInboxItem.
 */
function jobToInboxItem(job: Job): JobInboxItem {
  return {
    jobId: job.id,
    company: job.company,
    role: job.title,
    location: job.location.raw,
    compensation: formatSalary(job.compensation),
    match: job.match?.score ?? 0,
    source: job.source.board,
    isNew: job.isNew,
    posted: job.posted,
    capturedVia: job.source.channel,
    capturedAt: job.source.capturedAt,
    sourceUrl: job.source.url,
    workMode: job.workMode,
    seniority: job.seniority,
    summary: job.summary,
    tags: job.tags,
    requirements: job.requirements,
    strengths: job.match?.strengths,
    gaps: job.match?.gaps,
    jd: job.description,
  }
}

export default function JobsScreen() {
  const [activeIdx, setActiveIdx] = React.useState(0)
  const params = useParams<{ id: string }>()
  const searchId = params.id
  const navigate = useNavigate()

  // Toolbar: Criteria opens this search's criteria editor; Add a job opens the
  // manual capture flow (paste a URL, e.g. from hiring.cafe, or forward an email).
  function handleEditCriteria() {
    navigate(searchId ? `/searches/${searchId}/criteria` : "/searches/criteria")
  }
  function handleAddJob() {
    navigate("/applications/new")
  }

  // Primary data hooks - CUR-017: destructure error + refetch.
  // PIN-2 routing split (sprint-02): the default /jobs view lists the
  // canonical captured collection (DB-backed getJobs); a search-scoped view
  // keeps the mock inbox feed. Both hooks run unconditionally (rules of
  // hooks); the unused one is ignored.
  // Only the active source fetches (SIM-1): the default /jobs view lists the
  // DB collection, a search-scoped view lists the mock inbox feed.
  const inbox = useJobsInbox(searchId, Boolean(searchId))
  const captured = useJobs(!searchId)
  // Memoized: a fresh .map() array every render would re-fire the rows
  // effect below forever.
  const data = React.useMemo(
    () =>
      searchId ? inbox.data : captured.data?.map((job) => jobToInboxItem(job)),
    [searchId, inbox.data, captured.data],
  )
  const isLoading = searchId ? inbox.isLoading : captured.isLoading
  const error = searchId ? inbox.error : captured.error
  const refetch = searchId ? inbox.refetch : captured.refetch

  // Secondary hook: fall back gracefully; never full-page error for a subtitle
  const { data: search } = useSearch(searchId ?? "")
  const searchName = search?.name ?? "Platform search"

  const { addToShortlist, isSaving } = useAddJobToShortlist()

  // DEC-055/056: local triage state. Seeded from fetched data; shortlist
  // removes, archive moves to the archived section, delete removes. Mock-only
  // -- not persisted across refetch/reload.
  const [rows, setRows] = React.useState<InboxRow[]>([])
  React.useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(
        data.map((job, i) => ({ job, key: i, status: "active" as const })),
      )
    }
  }, [data])

  const activeRows = rows.filter((inboxRow) => inboxRow.status === "active")
  const archivedRows = rows.filter((inboxRow) => inboxRow.status === "archived")

  const safeIdx = Math.min(activeIdx, Math.max(0, activeRows.length - 1))
  const active = activeRows[safeIdx]

  const total = activeRows.length
  const newCount = activeRows.filter((inboxRow) => inboxRow.job.isNew).length

  // DEC-055: shortlisting also removes the job from the active inbox.
  async function handleAddToShortlist(row: InboxRow) {
    try {
      await addToShortlist({
        company: row.job.company,
        role: row.job.role,
        location: row.job.location,
        compensation: row.job.compensation,
        match: row.job.match,
      })
      const snapshot = rows
      setRows((currentRows) =>
        currentRows.filter((inboxRow) => inboxRow.key !== row.key),
      )
      toast.success({
        title: "Saved to shortlist",
        sub: `${row.job.role} - removed from inbox`,
        undo: { onUndo: () => setRows(snapshot) },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error({ title: "Could not save to shortlist", sub: message })
    }
  }

  // DEC-055: archive -> moves to the Archived section (recoverable).
  function handleArchive(row: InboxRow) {
    setRows((currentRows) =>
      currentRows.map((inboxRow) =>
        inboxRow.key === row.key
          ? { ...inboxRow, status: "archived" }
          : inboxRow,
      ),
    )
    toast.success({
      title: "Archived",
      sub: row.job.role,
      undo: {
        onUndo: () =>
          setRows((currentRows) =>
            currentRows.map((inboxRow) =>
              inboxRow.key === row.key
                ? { ...inboxRow, status: "active" }
                : inboxRow,
            ),
          ),
      },
    })
  }

  function handleRestore(row: InboxRow) {
    setRows((currentRows) =>
      currentRows.map((inboxRow) =>
        inboxRow.key === row.key ? { ...inboxRow, status: "active" } : inboxRow,
      ),
    )
    toast.default({ title: "Restored to inbox", sub: row.job.role })
  }

  // DEC-056: delete -> removes entirely (recoverable via undo only).
  function handleDelete(row: InboxRow) {
    const snapshot = rows
    setRows((currentRows) =>
      currentRows.filter((inboxRow) => inboxRow.key !== row.key),
    )
    toast.success({
      title: "Deleted",
      sub: row.job.role,
      undo: { onUndo: () => setRows(snapshot) },
    })
  }

  const listEmpty = activeRows.length === 0 && archivedRows.length === 0

  return (
    <AppFrame
      active="jobs"
      title={`Jobs inbox - ${searchName}`}
      subtitle={`${newCount} new of ${total}`}
      bleed
    >
      <div className="flex h-full flex-col">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-8 py-4">
          <Chip pressed variant="accent" count={total}>
            All
          </Chip>
          <Chip count={newCount}>New</Chip>
          <Chip count={archivedRows.length}>Archived</Chip>
          <Chip variant="dash">match &ge; 80%</Chip>
          <Chip variant="dash">posted &le; 7d</Chip>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={handleEditCriteria}>
            <SlidersHorizontalIcon className="size-3" /> Criteria
          </Button>
          <Button variant="default" size="sm" onClick={handleAddJob}>
            <PlusIcon className="size-3" /> Add a job
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[400px_1fr]">
          {/* Left pane: job list */}
          <div className="overflow-y-auto border-r border-border bg-[var(--bg-subtle)]">
            {/* CUR-017: error state */}
            {error ? (
              <ResourceError
                label="jobs inbox"
                error={error}
                onRetry={refetch}
                className="m-4"
              />
            ) : isLoading ? (
              <Skeleton className="m-4 h-40" />
            ) : listEmpty ? (
              /* CUR-024: empty state */
              <EmptyState
                icon={InboxIcon}
                headline="No jobs yet"
                body="Capture jobs as you find them -- paste a URL (e.g. from hiring.cafe), forward an email, or use the browser extension."
                cta={{ label: "Add a job", onClick: handleAddJob }}
                className="px-6"
              />
            ) : (
              <>
                {activeRows.map((row, i) => (
                  <button
                    key={row.key}
                    onClick={() => setActiveIdx(i)}
                    aria-current={i === safeIdx ? "true" : "false"}
                    className="block w-full border-b border-border text-left aria-[current=true]:border-l-2 aria-[current=true]:border-l-[var(--accent)] aria-[current=true]:bg-[var(--bg-elevated)]"
                  >
                    <JobInboxRow job={row.job} />
                  </button>
                ))}
                {activeRows.length === 0 ? (
                  <div className="px-6 py-8 text-center text-[13px] text-[var(--fg-subtle)]">
                    Inbox zero - everything triaged.
                  </div>
                ) : null}
                {archivedRows.length > 0 ? (
                  <>
                    <div className="border-b border-t border-border bg-[var(--bg-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">
                      Archived ({archivedRows.length})
                    </div>
                    {archivedRows.map((row) => (
                      <div
                        key={row.key}
                        className="flex items-center gap-1 border-b border-border pr-2 opacity-60"
                      >
                        <div className="min-w-0 flex-1">
                          <JobInboxRow job={row.job} />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(row)}
                          aria-label={`Restore ${row.job.role} to inbox`}
                        >
                          <RotateCcwIcon className="size-3" /> Restore
                        </Button>
                      </div>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </div>

          {/* Right pane: job detail */}
          <div className="overflow-y-auto p-8">
            {/* CUR-017: error state in detail pane (same data source) */}
            {error ? (
              <ResourceError
                label="jobs inbox"
                error={error}
                onRetry={refetch}
              />
            ) : active ? (
              <JobDetailPane
                job={active.job}
                isSaving={isSaving}
                onShortlist={() => handleAddToShortlist(active)}
                onArchive={() => handleArchive(active)}
                onDelete={() => handleDelete(active)}
              />
            ) : (
              /* CUR-024: empty detail pane when no active job is selected */
              <EmptyState
                icon={SplitSquareHorizontalIcon}
                headline={
                  archivedRows.length > 0 ? "Inbox zero" : "Nothing to show yet"
                }
                body={
                  archivedRows.length > 0
                    ? "Everything is triaged. Restore an archived job to bring it back."
                    : "Pick a job from the list to see details."
                }
              />
            )}
          </div>
        </div>
      </div>
    </AppFrame>
  )
}

// ---------------------------------------------------------------------------
// DEC-057: inbox job detail pane -- renders the full captured payload, degrading
// gracefully when a capture is still partial.
// ---------------------------------------------------------------------------

const CAPTURE_LABEL: Record<
  NonNullable<JobInboxItem["capturedVia"]>,
  string
> = {
  url: "Pasted URL",
  "jd-text": "Pasted JD text",
  extension: "Browser extension",
  "email-forward": "Forwarded email",
}

const WORK_MODE_LABEL: Record<NonNullable<JobInboxItem["workMode"]>, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--fg-subtle)]" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--fg-subtle)]">
          {label}
        </div>
        <div className="text-[13px] text-[var(--fg-default)]">{value}</div>
      </div>
    </div>
  )
}

function JobDetailPane({
  job,
  isSaving,
  onShortlist,
  onArchive,
  onDelete,
}: {
  job: JobInboxItem
  isSaving: boolean
  onShortlist: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  // A capture is "enriched" once any of the optional payload fields landed.
  const enriched = Boolean(
    job.summary ||
      job.jd ||
      job.requirements?.length ||
      job.strengths?.length ||
      job.gaps?.length ||
      job.tags?.length,
  )

  const facts: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
  }[] = [
    { icon: MapPinIcon, label: "Location", value: job.location },
    { icon: WalletIcon, label: "Compensation", value: job.compensation },
    job.workMode
      ? {
          icon: Building2Icon,
          label: "Work mode",
          value: WORK_MODE_LABEL[job.workMode],
        }
      : null,
    job.employmentType
      ? { icon: LandmarkIcon, label: "Employment", value: job.employmentType }
      : null,
    job.seniority
      ? { icon: TrendingUpIcon, label: "Seniority", value: job.seniority }
      : null,
    { icon: ClockIcon, label: "Posted", value: job.posted },
  ].filter((f): f is NonNullable<typeof f> => f !== null)

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center gap-3">
        <h2 className="m-0 text-2xl font-semibold tracking-[-0.015em]">
          {job.role}
        </h2>
        {job.isNew ? <Badge variant="accent">NEW</Badge> : null}
      </div>
      <div className="mb-1 text-[15px] text-[var(--fg-muted)]">
        {job.company}
      </div>

      {/* Capture provenance (DEC-057) */}
      <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--fg-subtle)]">
        <SparklesIcon className="size-3.5" />
        <span>
          Captured via{" "}
          {job.capturedVia ? CAPTURE_LABEL[job.capturedVia] : job.source}
          {job.capturedAt ? ` - ${job.capturedAt}` : ""}
        </span>
        {job.sourceUrl ? (
          <>
            <span aria-hidden>-</span>
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
            >
              <ExternalLinkIcon className="size-3" /> View original posting
            </a>
          </>
        ) : null}
      </div>

      {/* Triage actions stay high so they're reachable without scrolling past
          the JD (DEC-057 AC). */}
      <div className="mb-6 flex gap-2">
        <Button variant="default" onClick={onShortlist} disabled={isSaving}>
          + Shortlist
        </Button>
        <Button variant="secondary" onClick={onArchive}>
          <ArchiveIcon className="size-3.5" /> Archive
        </Button>
        <Button
          variant="ghost"
          onClick={onDelete}
          className="text-[var(--danger-text)]"
        >
          <Trash2Icon className="size-3.5" /> Delete
        </Button>
        {/* ADR-006: the inbox item references a Job by id -- open the full,
            standalone job page (shared with the shortlist surface). */}
        {job.jobId ? (
          <Button variant="ghost" asChild>
            <Link to={`/jobs/${job.jobId}`}>
              <ExternalLinkIcon className="size-3.5" /> Full job page
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Key facts grid */}
      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-[var(--bg-subtle)] p-4">
        {facts.map((fact) => (
          <Fact
            key={fact.label}
            icon={fact.icon}
            label={fact.label}
            value={fact.value}
          />
        ))}
      </div>

      {/* Summary */}
      {job.summary ? (
        <p className="mb-6 text-[14px] leading-relaxed text-[var(--fg-default)]">
          {job.summary}
        </p>
      ) : null}

      {/* Match panel: score + strengths + gaps */}
      {job.strengths?.length || job.gaps?.length ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="m-0 text-[15px] font-semibold">Match analysis</h3>
            <Badge variant={job.match >= 85 ? "accent" : "default"}>
              {job.match}% match
            </Badge>
            <Badge
              variant="default"
              className="text-[10px]"
              title="Free local heuristic, not a paid AI run. Run a deep score for an AI-graded match."
            >
              rough
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {job.strengths?.length ? (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--success-text)]">
                  <CheckCircle2Icon className="size-3.5" /> Strengths
                </div>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {job.strengths.map((strength, index) => (
                    <li
                      key={index}
                      className="flex gap-2 text-[13px] text-[var(--fg-muted)]"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--success-text)]" />
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {job.gaps?.length ? (
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--warn-text)]">
                  <AlertTriangleIcon className="size-3.5" /> Gaps
                </div>
                <ul className="m-0 list-none space-y-1.5 p-0">
                  {job.gaps.map((gap, index) => (
                    <li
                      key={index}
                      className="flex gap-2 text-[13px] text-[var(--fg-muted)]"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--warn-text)]" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Tags */}
      {job.tags?.length ? (
        <section className="mb-6">
          <h3 className="mb-2 mt-0 text-[15px] font-semibold">
            Skills &amp; credentials
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <Chip key={tag} variant="dash">
                {tag}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      {/* Requirements */}
      {job.requirements?.length ? (
        <section className="mb-6">
          <h3 className="mb-2 mt-0 text-[15px] font-semibold">
            Key requirements
          </h3>
          <ul className="m-0 list-disc space-y-1 pl-5 text-[13px] text-[var(--fg-muted)]">
            {job.requirements.map((requirement, index) => (
              <li key={index}>{requirement}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Raw JD -- own scroll region so actions above stay reachable (DEC-057 AC) */}
      {job.jd ? (
        <section className="mb-2">
          <h3 className="mb-2 mt-0 flex items-center gap-1.5 text-[15px] font-semibold">
            <FileTextIcon className="size-4" /> Original job description
          </h3>
          <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-[var(--bg-subtle)] p-4 font-sans text-[13px] leading-relaxed text-[var(--fg-muted)]">
            {job.jd}
          </pre>
        </section>
      ) : null}

      {/* Partial-capture affordance (DEC-057 AC): never show empty sections. */}
      {!enriched ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-border bg-[var(--bg-subtle)] p-4 text-[13px] text-[var(--fg-subtle)]">
          <SparklesIcon className="size-4 animate-pulse" />
          Still enriching this capture - full description, requirements, and
          match analysis will appear here shortly.
        </div>
      ) : null}
    </div>
  )
}
