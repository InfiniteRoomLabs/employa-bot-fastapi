import * as React from "react"

import { Badge } from "@/components/ui/badge-eb"
import type { CoachThread } from "@/data/types"
import { cn } from "@/lib/utils"

export interface CoachThreadRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Thread to render. */
  thread: CoachThread
  /** Highlight this row as the currently selected thread. */
  active?: boolean
}

function scopeVariant(scope: CoachThread["scope"]) {
  if (scope === "application") {
    return "info" as const
  }
  if (scope === "résumé") {
    return "accent" as const
  }
  return "default" as const
}

/**
 * Row in the coach Threads pane. Shows the thread title, a scope badge
 * (application / résumé / general), and a monospace `when` tag.
 * `active` adds the accent-bar selection state.
 */
const CoachThreadRow = React.forwardRef<HTMLDivElement, CoachThreadRowProps>(
  function CoachThreadRow(
    { className, thread, active, onClick, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="coach-thread-row"
        data-active={active ? "true" : undefined}
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            ;(onClick as ((event: React.SyntheticEvent) => void) | undefined)?.(
              event,
            )
          }
        }}
        className={cn(
          "cursor-pointer border-b border-border px-3.5 py-3",
          "hover:bg-[var(--bg-subtle)]",
          active && "bg-[var(--bg-subtle)] border-l-2 border-l-[var(--accent)]",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "mb-1 text-[13px]",
            active ? "font-semibold" : "font-medium",
          )}
        >
          {thread.title}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={scopeVariant(thread.scope)}>{thread.scope}</Badge>
          <span className="ml-auto font-mono text-[10px] text-[var(--fg-subtle)]">
            {thread.when}
          </span>
        </div>
      </div>
    )
  },
)

export { CoachThreadRow }
