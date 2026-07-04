import * as React from "react"
import { BotPill } from "@/components/atoms/bot-pill"
import { Avatar } from "@/components/ui/avatar-eb"
import { cn } from "@/lib/utils"

export interface CoachBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label rendered inside the leading `BotPill`. Defaults to `Coach`. */
  kicker?: string
  /** Body content. */
  children: React.ReactNode
}

/**
 * Bot-attributed callout used by the coach, dashboard, and app-detail
 * screens to flag bot-generated suggestions. Renders an accent `Avatar`
 * (EB initials) + `BotPill` + body content stacked in the design's
 * elevated-bg block.
 */
const CoachBlock = React.forwardRef<HTMLDivElement, CoachBlockProps>(
  function CoachBlock(
    { className, kicker = "Coach", children, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="coach-block"
        className={cn(
          "flex items-start gap-3 rounded-[var(--radius-lg)] border border-border",
          "bg-[var(--bg-elevated)] p-4",
          className,
        )}
        {...props}
      >
        <Avatar name="E B" accent />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5">
            <BotPill>{kicker}</BotPill>
          </div>
          <div className="text-[13.5px] leading-relaxed text-[var(--fg)]">
            {children}
          </div>
        </div>
      </div>
    )
  },
)

export { CoachBlock }
