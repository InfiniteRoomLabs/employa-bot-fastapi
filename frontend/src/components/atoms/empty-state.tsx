/**
 * EmptyState atom -- CUR-024 cross-cutting contract.
 *
 * Renders a centered placeholder when a resolved data array is empty (length 0).
 * Distinct from the loading Skeleton (no animation) and ResourceError (no alert
 * coloring). Every list/grid/board surface with zero items renders this.
 *
 * Usage:
 *   <EmptyState
 *     icon={InboxIcon}
 *     headline="No jobs yet"
 *     body="Your search is running -- new matches will appear here."
 *     cta={{ label: 'Add a job manually', onClick: () => {} }}
 *   />
 */

import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button-eb"
import { cn } from "@/lib/utils"

export interface EmptyStateCta {
  label: string
  /** onClick takes precedence over `to`. */
  onClick?: () => void
  /** Navigate via react-router Link when no onClick is provided. */
  to?: string
}

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>
  headline: string
  body?: string
  cta?: EmptyStateCta
  className?: string
}

export function EmptyState({
  icon: Icon,
  headline,
  body,
  cta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center",
        className,
      )}
      role="status"
      aria-label={headline}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-subtle)]">
          <Icon className="h-6 w-6 text-[var(--fg-subtle)]" aria-hidden />
        </div>
      )}
      <p className="text-[15px] font-semibold text-[var(--fg-base)]">
        {headline}
      </p>
      {body && (
        <p className="max-w-sm text-sm text-[var(--fg-muted)]">{body}</p>
      )}
      {cta &&
        (cta.onClick ? (
          <Button size="sm" variant="default" onClick={cta.onClick}>
            {cta.label}
          </Button>
        ) : cta.to ? (
          <Button size="sm" variant="default" asChild>
            <Link to={cta.to}>{cta.label}</Link>
          </Button>
        ) : null)}
    </div>
  )
}
