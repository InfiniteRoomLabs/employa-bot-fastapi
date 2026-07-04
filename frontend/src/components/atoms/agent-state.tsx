import * as React from "react"
// Type-only import per `docs/component-inventory.md` rationale: atoms
// consume the `AgentState` string-literal union from `data/types` but do
// not reach into hooks, fixtures, or `api.ts`.
import type { AgentState as AgentStateValue } from "@/data/types"
import { cn } from "@/lib/utils"

export interface AgentStateProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Agent lifecycle state — drives `agent-state--{state}` class. */
  state: AgentStateValue
  /** Visible label. Falls back to the raw state name. */
  label?: string
  /** Show a leading pulsing dot. */
  live?: boolean
}

/**
 * Status chip rendering an agent's lifecycle state (running / paused /
 * demand / error). Uses the design's `.agent-state` and
 * `.agent-state--{state}` classes already defined in `tokens.css`.
 */
const AgentState = React.forwardRef<HTMLSpanElement, AgentStateProps>(
  function AgentState({ className, state, label, live, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="agent-state"
        data-state={state}
        className={cn("agent-state", `agent-state--${state}`, className)}
        {...props}
      >
        {live ? <span className="dot dot--live" aria-hidden /> : null}
        {label ?? state}
      </span>
    )
  },
)

export { AgentState }
