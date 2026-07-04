import { ChevronDown, ChevronUp } from "lucide-react"
import * as React from "react"

import {
  Popover,
  PopoverContentWithCaret,
  PopoverTrigger,
} from "@/components/ui/popover-with-caret"
import { cn } from "@/lib/utils"

/** One sub-score row inside the optional expansion. */
export interface MatchPillSubScore {
  /** Label for the sub-criterion (e.g. "Skills fit"). */
  label: string
  /** 0-100 score. Drives bar width and tier color. */
  value: number
}

export interface MatchPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Numeric score 0-100. */
  score: number
  /** Optional sub-score breakdown; rendering an expansion trigger. */
  subs?: ReadonlyArray<MatchPillSubScore>
  /** Compact mode hides the qualitative word ("Strong" / etc). */
  compact?: boolean
  /**
   * D8: 'rough' = free local heuristic (shown muted with a "rough" tag);
   * 'deep' / undefined = a paid/full score (default styling).
   */
  kind?: "rough" | "deep"
}

type Tier = "high" | "mid" | "low"

/** Tier thresholds — primary source `atoms.jsx:115`. */
function tierFor(score: number): Tier {
  if (score >= 80) {
    return "high"
  }
  if (score >= 60) {
    return "mid"
  }
  return "low"
}

function wordFor(score: number): string {
  if (score >= 80) {
    return "Strong"
  }
  if (score >= 60) {
    return "Worth a look"
  }
  return "Stretch"
}

function subBarClass(value: number): string {
  if (value >= 80) {
    return ""
  }
  if (value >= 65) {
    return "mid"
  }
  return "low"
}

/**
 * Match-quality pill rendering a numeric score and tier-coloured chip.
 * When `subs` is provided, the pill becomes an expandable trigger that
 * opens a caret popover containing per-sub-criterion bars. Thresholds:
 * `>= 80` high, `>= 60` mid, `< 60` low.
 */
const MatchPill = React.forwardRef<HTMLDivElement, MatchPillProps>(
  function MatchPill({ className, score, subs, compact, kind, ...props }, ref) {
    const tier = tierFor(score)
    const word = wordFor(score)
    const isRough = kind === "rough"
    const hasExpansion = subs != null && subs.length > 0
    const [open, setOpen] = React.useState(false)

    const pillContent = (
      <>
        {isRough ? (
          <span
            className="text-[9px] font-medium uppercase tracking-wide opacity-70"
            title="Rough score -- free local heuristic, not a paid AI run"
          >
            rough
          </span>
        ) : null}
        <span className="match-pill__score">{score}</span>
        {!compact ? <span>{word}</span> : null}
        {hasExpansion ? (
          open ? (
            <ChevronUp aria-hidden className="size-3" />
          ) : (
            <ChevronDown aria-hidden className="size-3" />
          )
        ) : null}
      </>
    )

    const pillClass = cn(
      "match-pill",
      `match-pill--${tier}`,
      hasExpansion ? "cursor-pointer" : null,
    )

    if (!hasExpansion) {
      return (
        <div
          ref={ref}
          data-slot="match-pill"
          data-tier={tier}
          className={cn("inline-block", className)}
          {...props}
        >
          <span className={pillClass}>{pillContent}</span>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        data-slot="match-pill"
        data-tier={tier}
        className={cn("inline-block", className)}
        {...props}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={pillClass}
              aria-expanded={open}
              aria-label={`Match ${score} of 100, ${word}. Show breakdown.`}
            >
              {pillContent}
            </button>
          </PopoverTrigger>
          <PopoverContentWithCaret
            align="start"
            caret="top"
            className="w-[260px] p-3"
          >
            {subs.map((subscore) => (
              <div key={subscore.label} className="subscore-row">
                <span>{subscore.label}</span>
                <div className="bar">
                  <i
                    className={subBarClass(subscore.value)}
                    style={{ width: `${subscore.value}%` }}
                  />
                </div>
                <span className="val">{subscore.value}</span>
              </div>
            ))}
          </PopoverContentWithCaret>
        </Popover>
      </div>
    )
  },
)

export { MatchPill }
