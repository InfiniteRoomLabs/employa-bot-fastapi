import * as React from "react"

import { cn } from "@/lib/utils"

export type CoLogoSize = "sm" | "default" | "lg"

export interface CoLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Company name. The first character is used as the placeholder glyph. */
  name: string
  /** Visual size — `sm` 28px / `default` 36px / `lg` 48px. */
  size?: CoLogoSize
  /** Apply the lime accent background (used for emphasized brand cells). */
  accent?: boolean
}

/**
 * Square placeholder for a company logo, rendering the first letter of
 * `name`. Uses the design's `.co-logo`, `.co-logo--sm`, `.co-logo--lg`
 * classes already defined in `app.css`.
 */
const CoLogo = React.forwardRef<HTMLDivElement, CoLogoProps>(function CoLogo(
  { className, name, size = "default", accent, ...props },
  ref,
) {
  const glyph = name.charAt(0).toUpperCase()
  return (
    <div
      ref={ref}
      data-slot="co-logo"
      data-size={size}
      data-accent={accent ? "true" : undefined}
      aria-label={name}
      className={cn(
        "co-logo",
        size === "sm" && "co-logo--sm",
        size === "lg" && "co-logo--lg",
        accent && "bg-[var(--accent)] text-[var(--accent-foreground)]",
        className,
      )}
      {...props}
    >
      {glyph}
    </div>
  )
})

export { CoLogo }
