import * as React from "react"

import { cn } from "@/lib/utils"

export interface CostChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Formatted amount string (e.g. `$1.42`). Rendered in bold. */
  amount: string
  /** Leading label. Defaults to `cost`. */
  label?: string
}

/**
 * Compact monospace chip showing `<label> · <amount>`. Renders the
 * design's `.cost-chip` class verbatim — typography, border, and spacing
 * come from `tokens.css`.
 */
const CostChip = React.forwardRef<HTMLSpanElement, CostChipProps>(
  function CostChip({ className, amount, label = "cost", ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="cost-chip"
        className={cn("cost-chip", className)}
        {...props}
      >
        {label} · <b>{amount}</b>
      </span>
    )
  },
)

export { CostChip }
