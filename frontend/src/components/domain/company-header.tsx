import * as React from "react"

import { CoLogo } from "@/components/atoms/co-logo"
import { MatchPill } from "@/components/atoms/match-pill"
import { cn } from "@/lib/utils"

export interface CompanyHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Company / organization name. Drives the CoLogo and headline. */
  name: string
  /** Optional role line (e.g. "Staff Engineer, Platform"). */
  role?: string
  /** Optional location string. */
  loc?: string
  /** Optional salary / comp band, rendered in monospace. */
  salary?: string
  /** Optional match score; when present, a `MatchPill` is shown. */
  match?: number
  /** Trailing actions slot — buttons, menus, etc. */
  actions?: React.ReactNode
}

/**
 * Header block for company-anchored detail screens (applications, shortlist,
 * jobs, match-explorer). Composes `CoLogo` (48px) + name + role/loc/salary
 * + optional `MatchPill`. The match pill renders only when `match` is set.
 */
const CompanyHeader = React.forwardRef<HTMLDivElement, CompanyHeaderProps>(
  function CompanyHeader(
    { className, name, role, loc, salary, match, actions, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="company-header"
        className={cn("flex items-start gap-4", className)}
        {...props}
      >
        <CoLogo name={name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-xl font-semibold leading-tight tracking-tight">
            {name}
          </h2>
          {role || loc || salary ? (
            <div className="text-[13px] text-[var(--fg-muted)]">
              {[role, loc].filter(Boolean).join(" · ")}
              {salary ? (
                <>
                  {role || loc ? " · " : ""}
                  <span className="font-mono">{salary}</span>
                </>
              ) : null}
            </div>
          ) : null}
          {match != null ? (
            <div className="mt-1">
              <MatchPill score={match} />
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    )
  },
)

export { CompanyHeader }
