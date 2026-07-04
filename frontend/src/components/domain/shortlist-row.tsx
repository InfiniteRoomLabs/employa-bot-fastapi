import * as React from "react"
import { BotPill } from "@/components/atoms/bot-pill"
import { CoLogo } from "@/components/atoms/co-logo"
import { MatchPill } from "@/components/atoms/match-pill"
import { Badge } from "@/components/ui/badge-eb"
import { Card } from "@/components/ui/card-eb"
import type { ShortlistEntry } from "@/data/types"
import { cn } from "@/lib/utils"

export interface ShortlistRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Shortlist entry to render. Field names match `@/data/types::ShortlistEntry`. */
  entry: ShortlistEntry
  /** Click handler — typically opens the related job. */
  onSelect?: (entry: ShortlistEntry) => void
}

/**
 * Card representation of one {@link ShortlistEntry}. Adds the `why?`
 * annotation as a coach callout and renders a `going stale` warning badge when
 * `stale` is set. Every shortlist entry is user-saved (no auto-shortlisting).
 */
const ShortlistRow = React.forwardRef<HTMLDivElement, ShortlistRowProps>(
  function ShortlistRow({ className, entry, onSelect, ...props }, ref) {
    return (
      <Card
        ref={ref}
        data-slot="shortlist-row"
        data-stale={entry.stale ? "true" : undefined}
        className={cn(
          "gap-3 p-[18px]",
          entry.stale && "border-[var(--warn)] bg-[var(--warn-soft)]",
          className,
        )}
        onClick={() => onSelect?.(entry)}
        {...props}
      >
        <div className="flex gap-3">
          <CoLogo name={entry.company} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold">
                {entry.company}
              </span>
              <div className="ml-auto">
                <MatchPill score={entry.match} compact />
              </div>
            </div>
            <span className="truncate text-[13px] text-[var(--fg-muted)]">
              {entry.role}
            </span>
            <span className="font-mono text-xs text-[var(--fg-subtle)]">
              {entry.location} · {entry.compensation}
            </span>
          </div>
        </div>
        {entry.why ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] px-3 py-2">
            <BotPill muted>Coach</BotPill>
            <span className="text-[12.5px] leading-snug text-[var(--fg-muted)]">
              {entry.why}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Badge variant="default">Saved by you</Badge>
          <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
            saved {entry.saved}
          </span>
          {entry.stale ? <Badge variant="warn">going stale</Badge> : null}
        </div>
      </Card>
    )
  },
)

export { ShortlistRow }
