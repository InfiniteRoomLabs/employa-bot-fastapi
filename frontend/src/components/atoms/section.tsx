import * as React from "react"

import { Card } from "@/components/ui/card-eb"
import { cn } from "@/lib/utils"

export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Section heading. */
  title: string
  /** Optional supporting copy below the title. */
  subtitle?: string
  /** Optional trailing action slot — buttons, links, etc. */
  actions?: React.ReactNode
  /** Section body. */
  children: React.ReactNode
}

/**
 * Titled, card-shaped section composing the extended `Card`. Used by
 * search-criteria, settings, agent-detail, and add-app to group related
 * controls under an eyebrow + title block.
 */
const Section = React.forwardRef<HTMLDivElement, SectionProps>(function Section(
  { className, title, subtitle, actions, children, ...props },
  ref,
) {
  return (
    <Card
      ref={ref}
      data-slot="section"
      className={cn("gap-4", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div data-slot="section-body" className="flex flex-col gap-3">
        {children}
      </div>
    </Card>
  )
})

export { Section }
