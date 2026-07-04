/**
 * Breadcrumbs (ORI-016) -- clickable trail rendered in the topbar subtitle
 * slot. Ancestor crumbs (those with a `to`) are real router `<Link>`s; the
 * final crumb is plain text (the current page). Replaces the old plain-string
 * "<- Applications / Detail" subtitles.
 */

import { ChevronRightIcon } from "lucide-react"
import { Link } from "react-router-dom"

export interface Crumb {
  label: string
  /** Destination for ancestor crumbs. Omit on the current (last) crumb. */
  to?: string
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-[11.5px]"
    >
      {items.map((crumb, index) => {
        const isLast = index === items.length - 1
        return (
          <span
            key={`${crumb.label}-${index}`}
            className="flex items-center gap-1"
          >
            {index > 0 ? (
              <ChevronRightIcon
                className="size-3 text-[var(--fg-subtle)]"
                aria-hidden
              />
            ) : null}
            {crumb.to && !isLast ? (
              <Link
                to={crumb.to}
                className="text-[var(--fg-muted)] hover:text-[var(--fg-base)] hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? "page" : undefined}
                className="text-[var(--fg-muted)]"
              >
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
