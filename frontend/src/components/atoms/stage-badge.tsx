import * as React from "react"

import { Badge } from "@/components/ui/badge-eb"
import type { Stage } from "@/data/types"
import { cn } from "@/lib/utils"

import { StageDot } from "./stage-dot"

export interface StageBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Stage the badge represents. Also drives the inner `StageDot` colour. */
  stage: Stage
  /** Visible label. Falls back to the raw stage name. */
  label?: string
  /** Pulse the inner dot. */
  live?: boolean
}

/**
 * Stage indicator combining a coloured dot with a textual label. Composes
 * the extended `Badge` (default variant) and the `StageDot` atom.
 */
const StageBadge = React.forwardRef<HTMLSpanElement, StageBadgeProps>(
  function StageBadge({ className, stage, label, live, ...props }, ref) {
    return (
      <Badge
        ref={ref}
        data-slot="stage-badge"
        data-stage={stage}
        className={cn(className)}
        {...props}
      >
        <StageDot stage={stage} live={live} />
        <span>{label ?? stage}</span>
      </Badge>
    )
  },
)

export { StageBadge }
