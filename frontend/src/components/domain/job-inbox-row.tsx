import * as React from "react"
import { CoLogo } from "@/components/atoms/co-logo"
import { MatchPill } from "@/components/atoms/match-pill"
import { Badge } from "@/components/ui/badge-eb"
import type { JobInboxItem } from "@/data/types"
import { cn } from "@/lib/utils"

export interface JobInboxRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Job inbox item to render. Field names match `@/data/types::JobInboxItem`. */
  job: JobInboxItem
  /** Mark this row as the currently active entry in a list/detail layout. */
  active?: boolean
  /** Click handler — typically opens job detail. Receives the inbox item. */
  onSelect?: (job: JobInboxItem) => void
}

/**
 * List-row for one {@link JobInboxItem} in the jobs inbox / dashboard new
 * matches feed. Renders a `CoLogo`, company + role, a `NEW` badge when
 * fresh, the location/comp/source meta line, and a compact `MatchPill`.
 */
const JobInboxRow = React.forwardRef<HTMLDivElement, JobInboxRowProps>(
  function JobInboxRow({ className, job, active, onSelect, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="job-inbox-row"
        data-active={active ? "true" : undefined}
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect?.(job)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect?.(job)
          }
        }}
        className={cn(
          "flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3",
          "hover:bg-[var(--bg-subtle)]",
          active &&
            "bg-[var(--bg-elevated)] border-l-2 border-l-[var(--accent)]",
          className,
        )}
        {...props}
      >
        <CoLogo name={job.company} size="default" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {job.company}
            </span>
            {job.isNew ? <Badge variant="accent">NEW</Badge> : null}
          </div>
          <span className="truncate text-xs text-[var(--fg-muted)]">
            {job.role}
          </span>
          <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
            {job.location} · {job.compensation} · {job.source}
          </span>
          <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
            posted {job.posted}
          </span>
        </div>
        {/* D8: inbox scores are the free local heuristic -- labelled "rough". */}
        <MatchPill score={job.match} kind="rough" compact />
      </div>
    )
  },
)

export { JobInboxRow }
