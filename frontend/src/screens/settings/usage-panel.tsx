/**
 * AI Usage panel -- read-mostly table plus a monthly-cap input.
 * Matches `settings.jsx::SetUsage`: 3 stat tiles, a table of
 * per-surface spend, and an editable `monthlyCap` Input + alert
 * threshold badge.
 *
 * CTX-108: All three stat tiles now derive from fixture data.
 *   - "March spend" pct derived from spend / cap.
 *   - "Tokens in / out" from SETTINGS_USAGE_META.
 *   - "Most-used surface" derived by finding the UsageRow with the
 *     highest numeric $ value and computing its share of total spend.
 *
 * CTX-109:
 *   - Inert "Edit" Button wired to focus the monthlyCap Input via ref.
 *   - When pct >= 80, the delta text on the spend tile shows in warn color.
 */

import * as React from "react"
import { StatCard } from "@/components/atoms/stat-card"
import { Badge } from "@/components/ui/badge-eb"
import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import { Input } from "@/components/ui/input"
import { SETTINGS_USAGE_META } from "@/data/fixtures"
import type { UsageRow } from "@/data/types"
import { cn } from "@/lib/utils"

import { SectionHeading } from "./section-heading"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip '$' and ',' then parse as float. Returns 0 on NaN. */
function parseDollar(s: string): number {
  const n = parseFloat(s.replace(/[$,]/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** Derive most-used surface from usage rows. Returns { name, pct } or null. */
function deriveMostUsed(
  usage: readonly UsageRow[],
): { name: string; pct: number } | null {
  if (usage.length === 0) {
    return null
  }
  const total = usage.reduce((sum, r) => sum + parseDollar(r.cost), 0)
  if (total === 0) {
    return null
  }
  const topRow = usage.reduce((best, r) =>
    parseDollar(r.cost) > parseDollar(best.cost) ? r : best,
  )
  const pct = Math.round((parseDollar(topRow.cost) / total) * 100)
  return { name: topRow.service, pct }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UsagePanelProps {
  usage: readonly UsageRow[]
  monthSpend: string
  monthlyCap: string
  onMonthlyCapChange: (next: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UsagePanel({
  usage,
  monthSpend,
  monthlyCap,
  onMonthlyCapChange,
}: UsagePanelProps) {
  // CTX-109: ref for the monthlyCap Input so the Edit button can focus it
  const capInputRef = React.useRef<HTMLInputElement>(null)

  // CTX-108: derive percent of cap from props (recomputes when cap changes -- CTX-109 AC3)
  const spend = parseDollar(monthSpend)
  const cap = parseDollar(monthlyCap)
  const pct = cap > 0 ? Math.round((spend / cap) * 100) : 0

  // CTX-109: visual warning when pct >= 80
  const capExceeding = pct >= 80

  // CTX-108: derived most-used surface
  const mostUsed = deriveMostUsed(usage)

  // CTX-108: derived spend delta string
  const spendDelta = `of ${monthlyCap} - ${pct}%`

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="AI usage"
        subtitle="This month. All costs in USD. We cap paid models at your budget; haiku-tier fallback keeps working."
      />

      <div className="grid grid-cols-3 gap-3">
        {/* CTX-108: pct derived from spend/cap; CTX-109: warn color when >= 80 */}
        <StatCard
          label="March spend"
          value={monthSpend}
          delta={spendDelta}
          // Render delta in warn color when at/over threshold
          className={
            capExceeding
              ? "[&_.stat__delta]:text-[var(--warn-text)]"
              : undefined
          }
        />
        {/* CTX-108: tokens from SETTINGS_USAGE_META fixture */}
        <StatCard
          label="Tokens in / out"
          value={`${SETTINGS_USAGE_META.tokensIn} / ${SETTINGS_USAGE_META.tokensOut}`}
          delta={`avg ${SETTINGS_USAGE_META.avgPerSession} per session`}
        />
        {/* CTX-108: most-used surface derived from usage rows */}
        {mostUsed ? (
          <StatCard
            label="Most-used surface"
            value={mostUsed.name}
            delta={`${mostUsed.pct}% of spend`}
          />
        ) : (
          <StatCard label="Most-used surface" value="--" />
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <table className="tbl w-full">
          <thead>
            <tr>
              <th>Surface</th>
              <th>Model</th>
              <th style={{ width: 80, textAlign: "right" }}>Calls</th>
              <th style={{ width: 90, textAlign: "right" }}>Tokens</th>
              <th style={{ width: 80, textAlign: "right" }}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((usageRow) => (
              <tr key={usageRow.service}>
                <td className="font-medium">{usageRow.service}</td>
                <td className="font-mono text-xs text-[var(--fg-muted)]">
                  {usageRow.model}
                </td>
                <td className="text-right font-mono text-xs">
                  {usageRow.count}
                </td>
                <td className="text-right font-mono text-xs">
                  {usageRow.tokens}
                </td>
                <td className="text-right font-mono text-xs font-semibold">
                  {usageRow.cost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Monthly cap</h3>
          <p className="text-[12.5px] text-[var(--fg-muted)]">
            We stop calling paid models when you hit this. Haiku-tier fallback
            keeps working.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Input
            ref={capInputRef}
            value={monthlyCap}
            onChange={(event) => onMonthlyCapChange(event.target.value)}
            aria-label="Monthly cap"
            className="w-[120px] font-mono"
          />
          {/* CTX-109: wire Edit button to focus the Input */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => capInputRef.current?.focus()}
          >
            Edit
          </Button>
          <div className="flex-1" />
          {/* CTX-109: badge reflects current threshold; color communicates alert state */}
          <Badge
            className={cn(
              capExceeding
                ? "border-[var(--warn)] bg-[var(--warn-soft,hsl(36_100%_96%))] text-[var(--warn-text)]"
                : undefined,
            )}
          >
            {capExceeding ? `${pct}% of cap -- alert!` : "alert at 80%"}
          </Badge>
        </div>
        {/* CTX-109 AC3: visual note when spend is near/over the cap */}
        {capExceeding ? (
          <p className="mt-2 text-[12px] text-[var(--warn-text)]">
            You are at or above the 80% alert threshold. Paid model calls will
            stop at the cap.
          </p>
        ) : null}
      </Card>
    </div>
  )
}
