import * as React from "react"

import { cn } from "@/lib/utils"

export interface PageHeadProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Small uppercase eyebrow above the title. */
  eyebrow?: string
  /** Page title. Rendered with the display-serif `.page-head__title`. */
  title: React.ReactNode
  /** Optional lede paragraph below the title. */
  lede?: React.ReactNode
  /** Optional trailing actions slot (buttons, links). */
  actions?: React.ReactNode
}

/**
 * Page-level title block used at the top of every screen body. Renders
 * the design's `.page-head` markup verbatim — an eyebrow, a display-serif
 * title (`.page-head__title`), an optional lede paragraph, and an actions
 * column. Layout chrome only; knows nothing about domain shapes.
 */
const PageHead = React.forwardRef<HTMLDivElement, PageHeadProps>(
  function PageHead(
    { className, eyebrow, title, lede, actions, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="page-head"
        className={cn("page-head", className)}
        {...props}
      >
        <div className="page-head__col">
          {eyebrow ? (
            <div data-slot="page-head-eyebrow" className="page-head__eyebrow">
              {eyebrow}
            </div>
          ) : null}
          <h1 data-slot="page-head-title" className="page-head__title">
            {title}
          </h1>
          {lede ? (
            <p data-slot="page-head-lede" className="page-head__lede">
              {lede}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div data-slot="page-head-actions" className="page-head__actions">
            {actions}
          </div>
        ) : null}
      </div>
    )
  },
)

export { PageHead }
