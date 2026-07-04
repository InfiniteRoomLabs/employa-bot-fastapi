import { Bot, ExternalLink } from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import type { AgentLogEntry } from "@/data/types"
import { cn } from "@/lib/utils"

export interface AgentLogRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Agent log entry to render. Field names match `AgentLogEntry`. */
  entry: AgentLogEntry
  /** Display name for the agent that produced this entry. Falls back to `entry.agentId`. */
  agentName?: string
  /** Click handler for the row-level Review action on `await` entries. */
  onReview?: (entry: AgentLogEntry) => void
}

/**
 * Row in the agent action log. Renders time + agent + message + ref, with
 * a kind-driven trailing badge or Review button. `await` rows surface a
 * warning-tinted background.
 */
const AgentLogRow = React.forwardRef<HTMLDivElement, AgentLogRowProps>(
  function AgentLogRow(
    { className, entry, agentName, onReview, ...props },
    ref,
  ) {
    const isAwait = entry.kind === "await"
    return (
      <div
        ref={ref}
        data-slot="agent-log-row"
        data-kind={entry.kind}
        className={cn(
          "grid items-center gap-3 border-t border-border px-4 py-3 first:border-t-0",
          "grid-cols-[80px_28px_120px_1fr_160px_120px]",
          isAwait && "bg-[var(--warn-soft)]",
          className,
        )}
        {...props}
      >
        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
          {entry.time}
        </span>
        <div
          aria-hidden
          className="grid size-7 place-items-center rounded-[var(--radius-md)] border border-border bg-[var(--bg-subtle)]"
        >
          <Bot className="size-[13px]" />
        </div>
        <span className="text-[13px] font-medium">
          {agentName ?? entry.agentId}
        </span>
        <span className="text-[13px]">{entry.message}</span>
        <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--fg-subtle)]">
          <ExternalLink className="size-2.5" aria-hidden />
          {entry.ref}
        </span>
        <div className="flex items-center justify-end gap-1.5">
          {entry.kind === "await" ? (
            <Button size="sm" onClick={() => onReview?.(entry)}>
              Review
            </Button>
          ) : null}
          {entry.kind === "auto" ? <Badge variant="info">auto</Badge> : null}
          {entry.kind === "success" ? (
            <Badge variant="success">done</Badge>
          ) : null}
          {entry.kind === "skipped" ? <Badge>skipped</Badge> : null}
        </div>
      </div>
    )
  },
)

export { AgentLogRow }
