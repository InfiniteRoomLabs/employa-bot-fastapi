import * as React from "react"
import type { MatchRubricRow as MatchRubricRowType } from "@/data/types"
import { cn } from "@/lib/utils"

export interface MatchRubricRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Rubric row to render. `k` is the criterion, `v` 0-100, `note` is the rationale. */
  row: MatchRubricRowType
  /** When `true`, omit the rationale note (used in app-detail's narrow display). */
  compact?: boolean
}

/**
 * One row in the match-explorer rubric. Renders a criterion label, a
 * width-driven score bar (lime ≥ 80, amber ≥ 65, red < 65 — matching
 * `match_explorer.jsx:66`), the numeric score, and an indented rationale
 * note. The compact variant drops the note line for use in app-detail.
 */
const MatchRubricRow = React.forwardRef<HTMLDivElement, MatchRubricRowProps>(
  function MatchRubricRow({ className, row, compact, ...props }, ref) {
    const fill = barFillColor(row.score)
    return (
      <div
        ref={ref}
        data-slot="match-rubric-row"
        data-compact={compact ? "true" : undefined}
        className={cn(
          "border-t border-border py-3 first:border-t-0",
          className,
        )}
        {...props}
      >
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="w-[140px] text-sm font-semibold">{row.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              data-slot="match-rubric-row-bar"
              className="h-full"
              style={{ width: `${row.score}%`, background: `var(${fill})` }}
            />
          </div>
          <span className="w-9 text-right font-mono text-sm font-semibold">
            {row.score}
          </span>
        </div>
        {!compact ? (
          <div className="pl-[150px] text-[12.5px] text-[var(--fg-muted)]">
            {row.note}
          </div>
        ) : null}
      </div>
    )
  },
)

function barFillColor(v: number): string {
  if (v >= 80) {
    return "--accent"
  }
  if (v >= 65) {
    return "--amber-400"
  }
  return "--red-400"
}

export { MatchRubricRow }
