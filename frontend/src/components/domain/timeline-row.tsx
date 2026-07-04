import * as React from "react"

import { cn } from "@/lib/utils"

export interface TimelineRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Time / date string (e.g. `14:32`, `Mar 12`). Rendered monospace. */
  time: string
  /** Optional attribution — agent or user name. */
  who?: string
  /** Message body. ReactNode so callers can render links / badges. */
  msg: React.ReactNode
  /** Optional trailing badge slot — kind chip, success tick, etc. */
  badge?: React.ReactNode
}

/**
 * Single row in a timeline / activity feed. Used by agent-detail's recent
 * actions list and app-detail's event timeline. Layout: time (fixed col)
 * + body (flexes) + optional trailing badge. Uses the design's `.timeline`
 * / `.timeline__row` classes already in `app.css`.
 */
const TimelineRow = React.forwardRef<HTMLDivElement, TimelineRowProps>(
  function TimelineRow({ className, time, who, msg, badge, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="timeline-row"
        className={cn("timeline__row", className)}
        {...props}
      >
        <span className="timeline__time">{time}</span>
        <span className="timeline__msg flex-1 text-[13px]">{msg}</span>
        {who ? <span className="timeline__who">{who}</span> : null}
        {badge ? <span data-slot="timeline-row-badge">{badge}</span> : null}
      </div>
    )
  },
)

export { TimelineRow }
