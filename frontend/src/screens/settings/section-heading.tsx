/**
 * Shared section-heading block used by Settings sub-panels. Matches the
 * design's `<H>` + `<L>` pair from `settings.jsx` (22px title +
 * 13.5px muted lede).
 */

import type * as React from "react"

import { cn } from "@/lib/utils"

export interface SectionHeadingProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Section title. Rendered as an h2 so screen-readers + heading-role
   *  test queries pick it up. */
  title: string
  /** Optional supporting copy below the title. */
  subtitle?: string
}

export function SectionHeading({
  title,
  subtitle,
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} {...props}>
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.01em]">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-[13.5px] text-[var(--fg-muted)]">{subtitle}</p>
      ) : null}
    </div>
  )
}
