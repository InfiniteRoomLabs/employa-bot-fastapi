import { Progress as ProgressPrimitive } from "radix-ui"
import * as React from "react"

import { cn } from "@/lib/utils"

export interface BudgetBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Leading label (e.g. "Budget"). */
  label?: string
  /** Amount used so far. Same units as `total`. */
  used: number
  /** Total budget. Drives the bar's percentage fill. */
  total: number
  /** Optional formatter for the trailing readout. Defaults to `n.toString()`. */
  format?: (n: number) => string
}

/** Stage threshold for the indicator fill colour. */
function stageFor(used: number, total: number): "ok" | "warn" | "over" {
  if (total <= 0) {
    return "ok"
  }
  const pct = (used / total) * 100
  if (pct >= 100) {
    return "over"
  }
  if (pct >= 70) {
    return "warn"
  }
  return "ok"
}

function defaultFormat(n: number): string {
  return n.toString()
}

/**
 * Budget readout used in the sidebar footer + agent-detail. Renders the
 * design's `.budget` markup (label, thin bar, used/total) and uses the
 * radix `Progress.Root` primitive for ARIA semantics. The bar fill
 * switches between `--lime-500` (default), `--amber-500` (>=70%), and
 * `--red-500` (>=100%) by toggling the `.warn` / `.over` classes the
 * design CSS already targets.
 */
const BudgetBar = React.forwardRef<HTMLDivElement, BudgetBarProps>(
  function BudgetBar(
    {
      className,
      label = "Budget",
      used,
      total,
      format = defaultFormat,
      ...props
    },
    ref,
  ) {
    const stage = stageFor(used, total)
    const safeTotal = total > 0 ? total : 1
    const pct = Math.min(100, Math.max(0, (used / safeTotal) * 100))
    return (
      <div
        ref={ref}
        data-slot="budget-bar"
        data-stage={stage}
        className={cn("budget", className)}
        {...props}
      >
        <span>{label}</span>
        <ProgressPrimitive.Root
          data-slot="budget-bar-bar"
          className="budget__bar"
          value={pct}
          max={100}
          aria-label={`${label}: ${format(used)} of ${format(total)} used`}
        >
          <ProgressPrimitive.Indicator asChild style={{ width: `${pct}%` }}>
            <i
              className={
                stage === "warn"
                  ? "warn"
                  : stage === "over"
                    ? "over"
                    : undefined
              }
            />
          </ProgressPrimitive.Indicator>
        </ProgressPrimitive.Root>
        <span data-slot="budget-bar-readout">
          {format(used)} / {format(total)}
        </span>
      </div>
    )
  },
)

export { BudgetBar }
