import * as React from "react"
import { CoLogo } from "@/components/atoms/co-logo"
import { MatchPill } from "@/components/atoms/match-pill"
import { StageBadge } from "@/components/atoms/stage-badge"
import { Badge } from "@/components/ui/badge-eb"
import type { ApplicationView } from "@/data/types"
import { formatRelativeTime } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

export interface ApplicationRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** ApplicationView to render. Field names match `@/data/types::ApplicationView`. */
  application: ApplicationView
  /** Mark the row as the currently selected entry in a list/detail layout. */
  active?: boolean
  /** Click handler — typically selects the row. Receives `application.id`. */
  onSelect?: (id: string) => void
}

/**
 * List-row representation of one {@link ApplicationView}. Composes `CoLogo` +
 * stage indicator + role/days/flags + `MatchPill`. Used by the applications
 * list, dashboard recent-apps, and app-detail "related" rail.
 */
const ApplicationRow = React.forwardRef<HTMLDivElement, ApplicationRowProps>(
  function ApplicationRow(
    { className, application, active, onSelect, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="application-row"
        data-active={active ? "true" : undefined}
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect?.(application.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect?.(application.id)
          }
        }}
        className={cn(
          "flex items-center gap-3 border-b border-border px-4 py-3 cursor-pointer",
          "hover:bg-[var(--bg-subtle)]",
          active && "bg-[var(--bg-subtle)] border-l-2 border-l-[var(--accent)]",
          className,
        )}
        {...props}
      >
        <CoLogo name={application.company} size="default" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {application.company}
            </span>
            {application.resurrected ? <Badge>resurrected</Badge> : null}
          </div>
          <span className="truncate text-xs text-[var(--fg-muted)]">
            {application.role}
          </span>
          <div className="flex items-center gap-2">
            <StageBadge
              stage={application.stage}
              label={application.stageLabel}
            />
            {application.flag === "stale" ? (
              <Badge variant="warn">stale</Badge>
            ) : null}
            {application.flag === "offer" ? (
              <Badge variant="success">offer</Badge>
            ) : null}
            <span className="ml-auto font-mono text-[10px] text-[var(--fg-subtle)]">
              {formatRelativeTime(application.days)}
            </span>
          </div>
        </div>
        <MatchPill score={application.match} compact />
      </div>
    )
  },
)

export { ApplicationRow }
