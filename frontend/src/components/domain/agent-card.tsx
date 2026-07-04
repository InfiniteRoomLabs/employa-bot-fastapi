import { Bot } from "lucide-react"
import * as React from "react"

import { AgentState } from "@/components/atoms/agent-state"
import { CostChip } from "@/components/atoms/cost-chip"
import { Card } from "@/components/ui/card-eb"
import type { Agent } from "@/data/types"
import { cn } from "@/lib/utils"

export interface AgentCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Agent to render. Field names match `@/data/types::Agent`. */
  agent: Agent
  /** Click handler — typically opens agent detail / configure. */
  onSelect?: (id: string) => void
}

/**
 * Card representation of one {@link Agent}. Renders an icon, agent name,
 * `AgentState` chip, a 3-cell `last-run / actions / cost` footer, and a
 * `CostChip` summary. Action buttons (Pause/Resume/Run-now) are wired in
 * higher up in the agents screen — this component just shows state.
 */
const AgentCard = React.forwardRef<HTMLDivElement, AgentCardProps>(
  function AgentCard({ className, agent, onSelect, ...props }, ref) {
    return (
      <Card
        ref={ref}
        data-slot="agent-card"
        data-state={agent.state}
        className={cn("gap-3.5 p-[18px]", className)}
        onClick={() => onSelect?.(agent.id)}
        {...props}
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] border border-border",
              agent.state === "paused"
                ? "bg-[var(--bg-subtle)] text-[var(--fg-subtle)]"
                : "bg-[var(--bg-elevated)] text-[var(--fg)]",
            )}
          >
            <Bot className="size-[18px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold">{agent.name}</span>
              <AgentState
                state={agent.state}
                label={agent.stateLabel}
                live={agent.live}
              />
            </div>
            <span className="text-[13px] leading-relaxed text-[var(--fg-muted)]">
              {agent.description}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-2.5">
          <Stat k="last run" v={agent.lastActivity} />
          <Stat k="30d actions" v={agent.actions} mono />
          <Stat k="cost (mo)" v={agent.cost} mono />
        </div>
        <div className="flex items-center gap-2">
          <CostChip amount={agent.cost === "—" ? "paused" : agent.cost} />
        </div>
      </Card>
    )
  },
)

function Stat({
  k,
  v,
  mono,
}: {
  k: string
  v: string | number
  mono?: boolean
}) {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
        {k}
      </div>
      <div className={cn("text-[13px] font-semibold", mono && "font-mono")}>
        {v}
      </div>
    </div>
  )
}

export { AgentCard }
