import * as React from "react"
import { CoLogo } from "@/components/atoms/co-logo"
import { Badge } from "@/components/ui/badge-eb"
import type { ApplicationView } from "@/data/types"
import { formatRelativeTime } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

export interface ApplicationKanbanCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** ApplicationView to render as a kanban card. */
  application: ApplicationView
  /** Click handler — typically opens application detail. */
  onSelect?: (id: string) => void
}

/**
 * Compact card variant of {@link ApplicationView} for the kanban view. Uses a
 * small `CoLogo`, role line, and a footer with match score, days, and the
 * stale/offer badge when present. Renders a visual drag-handle hint via
 * `cursor-grab` but does NOT wire real drag-and-drop.
 */
const ApplicationKanbanCard = React.forwardRef<
  HTMLDivElement,
  ApplicationKanbanCardProps
>(function ApplicationKanbanCard(
  { className, application, onSelect, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="application-kanban-card"
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(application.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect?.(application.id)
        }
      }}
      className={cn(
        "rounded-[var(--radius-md)] border border-border bg-[var(--bg-elevated)] p-3 shadow-xs cursor-grab",
        "hover:border-[var(--accent)]",
        className,
      )}
      {...props}
    >
      <div className="mb-1 flex items-center gap-2">
        <CoLogo name={application.company} size="sm" />
        <span className="truncate text-sm font-semibold">
          {application.company}
        </span>
      </div>
      <div className="mb-2 text-xs text-[var(--fg-muted)]">
        {application.role}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
          {application.match}%
        </span>
        <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
          · {formatRelativeTime(application.days)}
        </span>
        {application.flag === "stale" ? (
          <Badge variant="warn">stale</Badge>
        ) : null}
        {application.flag === "offer" ? (
          <Badge variant="success">offer</Badge>
        ) : null}
      </div>
    </div>
  )
})

export { ApplicationKanbanCard }
