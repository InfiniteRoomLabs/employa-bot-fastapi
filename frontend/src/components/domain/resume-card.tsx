import * as React from "react"
import { MatchPill } from "@/components/atoms/match-pill"
import { Badge } from "@/components/ui/badge-eb"
import { Card } from "@/components/ui/card-eb"
import type { Resume } from "@/data/types"
import { cn } from "@/lib/utils"

export type ResumeCardVariant = "grid" | "list"

export interface ResumeCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Resume to render. Field names match `@/data/types::Resume`. */
  resume: Resume
  /** `grid` (default, vertical card) or `list` (horizontal row). */
  variant?: ResumeCardVariant
  /** Click handler — typically opens the résumé editor. */
  onSelect?: (resume: Resume) => void
}

function tagVariant(tag: Resume["tag"]) {
  if (tag === "DEFAULT") {
    return "accent" as const
  }
  return "default" as const
}

/**
 * Card representation of one {@link Resume}. Tag badge, name, target line,
 * version, usedIn count, updated date, and an optional `MatchPill` when
 * `match` is present. `variant` switches between the grid card (resumes
 * grid view) and the list row (dashboard tile).
 */
const ResumeCard = React.forwardRef<HTMLDivElement, ResumeCardProps>(
  function ResumeCard(
    { className, resume: r, variant = "grid", onSelect, ...props },
    ref,
  ) {
    if (variant === "list") {
      return (
        <div
          ref={ref}
          data-slot="resume-card"
          data-variant="list"
          role="button"
          tabIndex={0}
          onClick={() => onSelect?.(r)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onSelect?.(r)
            }
          }}
          className={cn(
            "flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2",
            "hover:bg-[var(--bg-subtle)]",
            className,
          )}
          {...props}
        >
          <Badge variant={tagVariant(r.tag)}>{r.tag}</Badge>
          <span className="text-sm font-medium">{r.name}</span>
          <span className="truncate text-xs text-[var(--fg-muted)]">
            {r.subtitle}
          </span>
          <span className="ml-auto font-mono text-[11px] text-[var(--fg-subtle)]">
            {r.usedIn} apps · {r.updated}
          </span>
          {r.match != null ? <MatchPill score={r.match} compact /> : null}
        </div>
      )
    }
    return (
      <Card
        ref={ref}
        data-slot="resume-card"
        data-variant="grid"
        className={cn("gap-2.5 p-[18px]", className)}
        onClick={() => onSelect?.(r)}
        {...props}
      >
        <div className="flex items-center gap-2">
          <Badge variant={tagVariant(r.tag)}>{r.tag}</Badge>
          <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
            {r.version}
          </span>
          {r.match != null ? (
            <div className="ml-auto">
              <MatchPill score={r.match} compact />
            </div>
          ) : null}
        </div>
        <div className="text-[15px] font-semibold leading-tight tracking-tight">
          {r.name}
        </div>
        <div className="text-[12.5px] text-[var(--fg-muted)]">{r.subtitle}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--fg-subtle)]">
          used in <b className="font-mono text-[var(--fg)]">{r.usedIn}</b>{" "}
          {r.usedIn === 1 ? "app" : "apps"} · {r.updated}
        </div>
      </Card>
    )
  },
)

export { ResumeCard }
