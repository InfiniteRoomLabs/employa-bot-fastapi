import * as React from "react"

import { cn } from "@/lib/utils"

export type StatCardTone = "up" | "down"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Uppercase eyebrow label (e.g. `APPLIED THIS WEEK`). */
  label: string
  /** Large primary value — accepts string, number, or composed React. */
  value: React.ReactNode
  /** Optional delta string (e.g. `+12% vs last`). */
  delta?: string
  /** Delta direction. Drives the up/down colour classes. */
  tone?: StatCardTone
  /** Secondary hint line below the delta. */
  hint?: string
}

/**
 * Metric tile used across the dashboard, agents, agent-detail and
 * settings/usage screens. Composes the design's `.stat` block (label,
 * value, optional delta + hint). When `delta` is supplied without a
 * `tone`, the delta is rendered in the neutral muted colour.
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  function StatCard(
    { className, label, value, delta, tone, hint, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="stat-card"
        className={cn("stat", className)}
        {...props}
      >
        <div className="stat__label">{label}</div>
        <div className="stat__value">{value}</div>
        {delta ? (
          <div
            data-slot="stat-card-delta"
            data-tone={tone ?? undefined}
            className={cn(
              "stat__delta",
              tone === "up" && "stat__delta--up",
              tone === "down" && "stat__delta--down",
            )}
          >
            {delta}
          </div>
        ) : null}
        {hint ? (
          <div data-slot="stat-card-hint" className="stat__delta">
            {hint}
          </div>
        ) : null}
      </div>
    )
  },
)

export { StatCard }
