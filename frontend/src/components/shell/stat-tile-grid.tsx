import * as React from "react"

import { cn } from "@/lib/utils"

export interface StatTileGridProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Stat tiles to render. */
  children: React.ReactNode
  /**
   * Number of equal-width columns. When omitted the grid uses an
   * `auto-fit` track that flows tiles to fill the row with a sensible
   * minimum width per tile.
   */
  columns?: number
}

/**
 * Pure CSS Grid wrapper for rows of `StatCard`s. Used on the dashboard,
 * agents index, agent-detail, and settings/usage. Defaults to an
 * `auto-fit` track sized to the design's stat-tile minimum width so the
 * grid reflows from 4 → 2 → 1 column across breakpoints. Pass `columns`
 * to lock to a specific column count.
 */
const StatTileGrid = React.forwardRef<HTMLDivElement, StatTileGridProps>(
  function StatTileGrid(
    { className, children, columns, style, ...props },
    ref,
  ) {
    // `grid-cols-N` can't be expressed through Tailwind for arbitrary
    // runtime numbers — the compiler purges the unused arbitrary classes.
    // Inline `gridTemplateColumns` is the canonical Tailwind escape hatch
    // for layout that is driven by props rather than tokens.
    const gridStyle: React.CSSProperties = {
      gridTemplateColumns:
        typeof columns === "number" && columns > 0
          ? `repeat(${columns}, minmax(0, 1fr))`
          : "repeat(auto-fit, minmax(180px, 1fr))",
      ...style,
    }
    return (
      <div
        ref={ref}
        data-slot="stat-tile-grid"
        data-columns={columns ?? "auto-fit"}
        className={cn("grid gap-3", className)}
        style={gridStyle}
        {...props}
      >
        {children}
      </div>
    )
  },
)

export { StatTileGrid }
