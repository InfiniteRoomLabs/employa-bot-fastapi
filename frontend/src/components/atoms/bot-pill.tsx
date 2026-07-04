import * as React from "react"

import { cn } from "@/lib/utils"

export interface BotPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Pulse the leading dot to indicate live/streaming output. */
  live?: boolean
  /** Render a transparent, lower-emphasis variant. */
  muted?: boolean
  /** Pill label content. */
  children: React.ReactNode
}

/**
 * Marker chip indicating bot-authored content. Renders the design's
 * `.bot-pill` markup verbatim (leading 6x6 lime dot + label). Variants
 * `live` (pulse) and `muted` map to `.bot-pill--live` / `.bot-pill--muted`
 * already in `tokens.css`.
 */
const BotPill = React.forwardRef<HTMLSpanElement, BotPillProps>(
  function BotPill({ className, live, muted, children, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="bot-pill"
        data-live={live ? "true" : undefined}
        data-muted={muted ? "true" : undefined}
        className={cn(
          "bot-pill",
          live && "bot-pill--live",
          muted && "bot-pill--muted",
          className,
        )}
        {...props}
      >
        <span className="dot" aria-hidden />
        {children}
      </span>
    )
  },
)

export { BotPill }
