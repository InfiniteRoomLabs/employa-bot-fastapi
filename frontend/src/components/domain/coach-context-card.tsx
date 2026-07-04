import { XIcon } from "lucide-react"
import * as React from "react"
import type { ContextCard } from "@/data/types"
import { cn } from "@/lib/utils"

export interface CoachContextCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Context card data — `label` is the eyebrow, `body` the description. */
  card: ContextCard
  /** Optional richer children. When provided, replaces `card.body` rendering. */
  children?: React.ReactNode
  /** COA-022: when provided, renders a remove (×) control in the corner. */
  onRemove?: () => void
}

/**
 * Dashed-border card in the coach's "In-context" pane. Shows the
 * resource the bot is reading (application, attached résumé, JD excerpt,
 * prior thread). Renders the design's `CtxCard`-equivalent layout: an
 * uppercase `label` eyebrow + body content (either `card.body` or
 * supplied `children` for richer compositions).
 */
const CoachContextCard = React.forwardRef<
  HTMLDivElement,
  CoachContextCardProps
>(function CoachContextCard(
  { className, card, children, onRemove, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="coach-context-card"
      className={cn(
        "relative rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)]",
        "bg-[var(--bg-subtle)] p-2.5",
        className,
      )}
      {...props}
    >
      <div className="mb-1 flex items-start gap-2">
        <div className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
          {card.label}
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${card.label} from context`}
            className="-mt-0.5 -mr-0.5 grid size-4 shrink-0 place-items-center rounded text-[var(--fg-subtle)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg-base)]"
          >
            <XIcon className="size-3" />
          </button>
        ) : null}
      </div>
      {children ?? (
        <div className="text-xs leading-relaxed text-[var(--fg-muted)]">
          {card.body}
        </div>
      )}
    </div>
  )
})

export { CoachContextCard }
