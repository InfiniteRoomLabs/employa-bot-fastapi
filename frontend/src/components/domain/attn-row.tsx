import {
  Calendar,
  Clock,
  Ghost,
  Mail,
  MoreHorizontal,
  Trophy,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button-eb"
import { cn } from "@/lib/utils"

/**
 * Tag union for attention rows. `ghost` is invented for the
 * ghost-detector flow (not in `NudgeTag` from `@/data/types` — see
 * `app.css::.attn-row__tag--ghost`).
 */
export type AttnRowTag = "stale" | "reply" | "prep" | "offer" | "ghost"

export interface AttnRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Drives the tag chip styling and the leading icon. */
  tag: AttnRowTag
  /** Bold title — what needs attention. */
  title: string
  /** Secondary meta line — why / when / context. */
  meta: string
  /** Optional trailing CTA — a `Button` or composable equivalent. */
  cta?: React.ReactNode
  /** Click handler for the trailing `more` button (omitted when undefined). */
  onOverflow?: () => void
}

const TAG_LABEL: Record<AttnRowTag, string> = {
  stale: "Stale",
  reply: "Reply",
  prep: "Prep",
  offer: "Offer",
  ghost: "Ghost",
}

function TagIcon({ tag }: { tag: AttnRowTag }) {
  switch (tag) {
    case "reply":
      return <Mail className="size-3" aria-hidden />
    case "stale":
      return <Clock className="size-3" aria-hidden />
    case "prep":
      return <Calendar className="size-3" aria-hidden />
    case "offer":
      return <Trophy className="size-3" aria-hidden />
    case "ghost":
      return <Ghost className="size-3" aria-hidden />
  }
}

/**
 * Single attention row used in the dashboard "Needs your attention" list.
 * Renders a tag pill (icon + label, color keyed off `tag`), title + meta,
 * an optional trailing CTA, and an optional overflow `more` button.
 */
const AttnRow = React.forwardRef<HTMLDivElement, AttnRowProps>(function AttnRow(
  { className, tag, title, meta, cta, onOverflow, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="attn-row"
      data-tag={tag}
      className={cn("attn-row", className)}
      {...props}
    >
      <span className={cn("attn-row__tag", `attn-row__tag--${tag}`)}>
        <TagIcon tag={tag} />
        {TAG_LABEL[tag]}
      </span>
      <div className="attn-row__body">
        <div className="attn-row__title">{title}</div>
        <div className="attn-row__meta">{meta}</div>
      </div>
      {cta}
      {onOverflow ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="More options"
          onClick={onOverflow}
        >
          <MoreHorizontal className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  )
})

export { AttnRow }
