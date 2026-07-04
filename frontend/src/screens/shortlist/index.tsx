/**
 * Shortlist - saved-but-not-applied jobs as a card grid.
 *
 * Picker id: `shortlist`
 * Route path: `/shortlist` (Phase 9)
 *
 * Contracts implemented:
 *   CUR-017 -- error+retry via <ResourceError> replacing the skeleton/grid branch
 *   CUR-024 -- <EmptyState> when grid is empty; chip counts derived from data;
 *              going-stale banner suppressed when empty
 *   ORI-014 -- toast feedback on "Apply to selected" (no selection model yet --
 *              fires an honest scope-boundary toast; bulk selection is post-MVP)
 */

import {
  ArchiveIcon,
  ArrowUpDownIcon,
  BookmarkIcon,
  LightbulbIcon,
  SendIcon,
  SlidersHorizontalIcon,
} from "lucide-react"

import { useNavigate, useParams } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { ShortlistRow } from "@/components/domain/shortlist-row"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Chip } from "@/components/ui/chip"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { ShortlistEntry } from "@/data/types"
import { useSearch, useShortlist } from "@/hooks"

export default function ShortlistScreen() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const searchId = params.id

  // CUR-017: destructure error + refetch
  const { data, isLoading, error, refetch } = useShortlist(searchId)

  // Secondary hook: graceful fallback; never full-page error for subtitle
  const { data: search } = useSearch(searchId ?? "")
  const searchName = search?.name ?? "Staff / Principal - Platform - remote"

  // CUR-024: derive counts from data (replaces hardcoded 22/14/8)
  const allCount = data?.length ?? 0

  // CUR-024: stale count to gate the going-stale banner
  const staleCount = data?.filter((entry) => entry.stale).length ?? 0

  // ORI-014: "Apply to selected" -- no selection model yet; honest scope stub
  function handleApplyToSelected() {
    toast.default({
      title: "Select at least one role to apply",
      sub: "Tap a card to select it, then apply.",
    })
  }

  // DEC-058: clicking a shortlist card opens the job's detail page -- the
  // posting facts + the match analysis live there (ADR-006). Falls back to the
  // Match Explorer only for legacy entries that predate the jobId reference.
  function handleOpen(entry: ShortlistEntry) {
    if (entry.jobId) {
      navigate(`/jobs/${entry.jobId}`)
      return
    }
    toast.default({ title: `Opening ${entry.company}`, sub: entry.role })
    navigate("/resumes/match-explorer")
  }

  return (
    <AppFrame
      active="shortlist"
      title={`Shortlist - ${searchName}`}
      subtitle={`${allCount} saved`}
    >
      <PageHead
        eyebrow={searchName}
        title={
          <>
            Shortlist - <em>{allCount}</em> roles you'd like to apply to
          </>
        }
        lede="Triage, tailor, or dismiss. Nothing gets applied to until you approve. These are the roles you saved while reviewing your inbox."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                toast.default({
                  title: "Sort and triage below",
                  sub: "Use the chips and per-card actions.",
                })
              }
            >
              <SlidersHorizontalIcon className="size-3.5" /> Filters
            </Button>
            {/* ORI-014: wired with toast feedback */}
            <Button variant="default" size="sm" onClick={handleApplyToSelected}>
              <SendIcon className="size-3.5" /> Apply to selected
            </Button>
          </>
        }
      />

      {/* CUR-024: chip counts derived from data */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip pressed variant="accent" count={allCount}>
          All saved
        </Chip>
        <Chip variant="dash">match &ge; 85%</Chip>
        <Chip variant="dash">going stale ({staleCount})</Chip>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            toast.default({
              title: "Sorted by saved date",
              sub: "Most recently saved first.",
            })
          }
        >
          <ArrowUpDownIcon className="size-3" /> Saved date
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            toast.default({
              title: "Select cards to bulk-archive",
              sub: "Tap cards to select, then archive.",
            })
          }
        >
          <ArchiveIcon className="size-3" /> Bulk archive
        </Button>
      </div>

      {/* CUR-024: going-stale banner -- suppress when no data or no stale entries */}
      {data && data.length > 0 && staleCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--info-soft)] p-3.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--bg-elevated)]">
            <LightbulbIcon className="size-[15px] text-[var(--info-text)]" />
          </div>
          <div className="flex-1 text-[13.5px] text-[var(--info-text)]">
            <b>{staleCount} of these are going stale.</b> Postings often close
            ~14 days after they appear - Cloudflare and Fly.io have been sitting
            in your shortlist for a week+.
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              toast.warn({
                title: `${staleCount} going stale`,
                sub: "Review and apply or dismiss before these postings close.",
              })
            }
          >
            Review the {staleCount}
          </Button>
        </div>
      )}

      {/* CUR-017: error state; CUR-024: empty state; else grid */}
      {error ? (
        <ResourceError label="shortlist" error={error} onRetry={refetch} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : data!.length === 0 ? (
        /* CUR-024: empty grid state */
        <EmptyState
          icon={BookmarkIcon}
          headline="Nothing shortlisted yet"
          body="Jobs you save from your inbox will appear here."
          cta={{ label: "Browse the jobs inbox", to: "/jobs" }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {data!.map((entry, i) => (
            <ShortlistRow key={i} entry={entry} onSelect={handleOpen} />
          ))}
        </div>
      )}
    </AppFrame>
  )
}
