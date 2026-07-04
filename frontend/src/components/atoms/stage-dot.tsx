import * as React from "react"
// Type-only import of the `Stage` string-literal union. Atoms must not
// depend on hooks, fixtures, or `data/api.ts`, but consuming a pure
// type alias from `data/types` keeps the union in one place. See
// `docs/component-inventory.md` (Phase 5 inventory) for the rationale.
import type { Stage } from "@/data/types"
import { cn } from "@/lib/utils"

/**
 * Extra stage-adjacent variants surfaced by `.dot--{name}` rules in
 * `tokens.css`. These aren't part of the canonical `Stage` union but the
 * underlying CSS class is real, so consumers occasionally need them.
 */
export type StageDotVariant = Stage | "stale" | "ghosted" | "saved"

export interface StageDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Stage (or stage-adjacent) variant. Drives `dot--{stage}` class. */
  stage: StageDotVariant
  /** When true, applies the pulse animation defined in `tokens.css`. */
  live?: boolean
}

/**
 * Coloured 8px dot used in stage badges, lists, and statuses. Reads
 * `--stage-*` and palette tokens via the `.dot.dot--{stage}` classes
 * already in the bridged CSS.
 */
const StageDot = React.forwardRef<HTMLSpanElement, StageDotProps>(
  function StageDot({ className, stage, live, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="stage-dot"
        data-stage={stage}
        data-live={live ? "true" : undefined}
        className={cn("dot", `dot--${stage}`, live && "dot--live", className)}
        {...props}
      />
    )
  },
)

export { StageDot }
