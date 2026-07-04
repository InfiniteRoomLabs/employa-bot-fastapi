/**
 * Search detail - manual pipeline analytic + KPI tiles.
 *
 * Picker id: `search-detail`
 * Route path: `/searches/:id` (Phase 9)
 *
 * A saved search is an organizational SCOPE the user tracks applications under
 * (no scraper). The pipeline analytic is computed from the search's OWN tracked
 * applications -- counting how many sit at each active stage.
 *
 * Contracts:
 *   CUR-017 -- error/not-found panel via ResourceError
 *   ORI-014 -- toast on primary actions (Mark won stub)
 */

import {
  BookmarkIcon,
  BriefcaseIcon,
  InboxIcon,
  PauseIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
} from "lucide-react"

import * as React from "react"
import { Link, useParams } from "react-router-dom"
import { ResourceError } from "@/components/atoms/resource-error"
import { StatCard } from "@/components/atoms/stat-card"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { SEARCH_ID_PLATFORM } from "@/data/fixtures"
import type { ApplicationView, Stage } from "@/data/types"
import { useApplications, useSearch } from "@/hooks"

/** Active pipeline stages, in order, for the conversion analytic. */
const PIPELINE_STAGES: readonly { stage: Stage; label: string }[] = [
  { stage: "applied", label: "Applied" },
  { stage: "screen", label: "Screen" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
]

interface PipelineRow {
  stage: Stage
  label: string
  count: number
  /** Bar width as a percentage of the widest stage (0-100). */
  width: number
}

/** Count this search's tracked applications at each active pipeline stage. */
function buildPipeline(
  applications: readonly ApplicationView[],
): PipelineRow[] {
  const counts = PIPELINE_STAGES.map(({ stage, label }) => ({
    stage,
    label,
    count: applications.filter((application) => application.stage === stage)
      .length,
  }))
  const widest = Math.max(1, ...counts.map((row) => row.count))
  return counts.map((row) => ({
    ...row,
    width: Math.round((row.count / widest) * 100),
  }))
}

export default function SearchDetailScreen() {
  // URL `:id` is the saved-search UUID. Fallback to the canonical platform
  // search for picker/storybook mounts and bare `/searches` visits.
  const params = useParams<{ id: string }>()
  const searchId = params.id ?? SEARCH_ID_PLATFORM
  const { data, isLoading, error, refetch } = useSearch(searchId)
  const apps = useApplications(searchId)
  const pipeline = React.useMemo(
    () => buildPipeline(apps.data ?? []),
    [apps.data],
  )

  // ORI-014: local paused state (mock; seeded from the fetched search state).
  const [paused, setPaused] = React.useState(false)
  React.useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaused(data.state === "paused")
    }
  }, [data])

  function handleTogglePause() {
    setPaused((wasPaused) => {
      const nowPaused = !wasPaused
      if (nowPaused) {
        toast.success({
          title: "Search paused",
          sub: "Parked - not actively pursuing this scope.",
        })
      } else {
        toast.success({
          title: "Search resumed",
          sub: "This scope is active again.",
        })
      }
      return nowPaused
    })
  }

  function handleMarkWon() {
    toast.celebrate({
      title: "Marked this search as won",
      sub: `Nice -- ${data?.name ?? "this search"} found you a role.`,
    })
  }

  // CUR-017: error and not-found states
  if (!isLoading && error) {
    const isNotFound = error.kind === "not_found"
    return (
      <AppFrame active="search-detail" title="Search detail" subtitle="">
        <PageHead title="Search detail" />
        <div className="mt-8">
          {isNotFound ? (
            <ResourceError
              label="This search"
              notFound
              backLabel="Back to dashboard"
              backTo="/dashboard"
            />
          ) : (
            <ResourceError label="search" error={error} onRetry={refetch} />
          )}
        </div>
      </AppFrame>
    )
  }

  return (
    <AppFrame
      active="search-detail"
      title={data?.name ?? "Saved search"}
      subtitle={data?.eyebrow ?? ""}
    >
      <PageHead
        eyebrow={data?.eyebrow ?? ""}
        title={data?.name ?? <Skeleton className="inline-block h-9 w-72" />}
        lede="Your pipeline for this scope, top to bottom. Track how your tracked applications convert from applied to offer."
        actions={
          <>
            <Button variant="ghost" onClick={handleTogglePause}>
              <PauseIcon className="size-3.5" /> {paused ? "Resume" : "Pause"}
            </Button>
            <Button variant="secondary" asChild>
              <Link to={`/searches/${searchId}/criteria`}>
                <SlidersHorizontalIcon className="size-3.5" /> Edit criteria
              </Link>
            </Button>
            <Button variant="default" onClick={handleMarkWon}>
              <TrophyIcon className="size-3.5" /> Mark won
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-5 gap-3">
        <StatCard label="Jobs in inbox" value={data?.jobsInInbox ?? "—"} />
        <StatCard label="Shortlisted" value={data?.shortlisted ?? "—"} />
        <StatCard
          label="Applications"
          value={data?.activeApplications ?? "—"}
        />
        <StatCard label="Offers" value={data?.offers ?? "—"} />
        <StatCard label="Spend (mo)" value={data?.spendMo ?? "—"} />
      </div>

      <div className="grid grid-cols-[1.7fr_1fr] gap-4">
        <div className="card p-5">
          <div className="mb-3.5 flex items-center gap-2">
            <h3 className="m-0 text-[15px] font-semibold">Your pipeline</h3>
            <span className="text-[12px] text-[var(--fg-subtle)]">
              - applications you track under this scope
            </span>
          </div>
          {isLoading || !data || apps.isLoading ? (
            <Skeleton className="h-60" />
          ) : (
            <div className="flex flex-col gap-1">
              {pipeline.map((row) => (
                <div key={row.stage} className="funnel-row">
                  <span className="text-[13px] font-medium">{row.label}</span>
                  <div className="funnel-track">
                    <div
                      className="funnel-fill"
                      style={{ width: row.width + "%" }}
                    >
                      {row.width > 6 ? <span>{row.count}</span> : null}
                    </div>
                  </div>
                  <span className="mono text-right text-[13px] font-semibold">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="card p-5">
            <h3 className="mb-2 text-[14px] font-semibold">Quick links</h3>
            <div className="flex flex-col gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
              >
                <Link to={`/searches/${searchId}/inbox`}>
                  <InboxIcon className="size-3" /> Open jobs inbox -{" "}
                  {data?.jobsInInbox ?? "—"}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
              >
                <Link to={`/searches/${searchId}/shortlist`}>
                  <BookmarkIcon className="size-3" /> Open shortlist -{" "}
                  {data?.shortlisted ?? "—"}
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                asChild
              >
                <Link to={`/searches/${searchId}/applications`}>
                  <BriefcaseIcon className="size-3" /> Open applications -{" "}
                  {data?.activeApplications ?? "—"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  )
}
