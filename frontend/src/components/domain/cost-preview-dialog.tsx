/**
 * Cost-preview consent dialog (D8b / D9a) -- the cost-transparency pillar.
 *
 * A single modal with two states:
 *  - preview: itemized per-task lines, running total, monthly-cap headroom, and
 *    an explicit approve/cancel. Over-cap is flagged before the user commits.
 *  - cap-reached: shown when a run returns `cap_reached`. The in-flight call
 *    completed (no silent downgrade); the user re-consents or stops.
 *
 * Loading and error states are first-class (the preview is fetched async).
 * Copy is low-pressure: "you only pay for deep AI runs", "re-consent to continue".
 */

import { AlertTriangle } from "lucide-react"
import { ResourceError } from "@/components/atoms/resource-error"
import { Button } from "@/components/ui/button-eb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { CostPreview } from "@/data/types"
import type { MockApiError } from "@/lib/mock-api-error"

function usd(n: number): string {
  return `$${n.toFixed(2)}`
}

export interface CostPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The preview to show. null while loading. */
  preview: CostPreview | null
  /** True while the preview is being fetched. */
  loading?: boolean
  /** Error fetching the preview; shows inline retry. */
  error?: MockApiError
  onRetry?: () => void
  /** Approve the spend and run. */
  onConfirm: () => void
  /** True while the confirmed run is in flight. */
  busy?: boolean
  /** When true, render the cap-reached re-consent state instead of the preview. */
  capReached?: boolean
  /** Re-consent to continue past the cap (only used in the cap-reached state). */
  onReConsent?: () => void
  /** Display strings for the cap-reached copy. */
  monthSpend?: string
  monthlyCap?: string
  confirmLabel?: string
}

export function CostPreviewDialog({
  open,
  onOpenChange,
  preview,
  loading,
  error,
  onRetry,
  onConfirm,
  busy,
  capReached,
  onReConsent,
  monthSpend,
  monthlyCap,
  confirmLabel = "Approve and run",
}: CostPreviewDialogProps) {
  // --- Cap-reached re-consent state (D9a) ---
  if (capReached) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Monthly cap reached</DialogTitle>
            <DialogDescription>
              Your last run finished -- nothing was downgraded or run on a
              different model. You have now reached your{" "}
              {monthlyCap ?? "monthly"} cap
              {monthSpend ? ` (spent ${monthSpend})` : ""}. Re-consent to keep
              running paid AI, or stop here and pick up next cycle.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Not now</Button>
            </DialogClose>
            <Button variant="default" onClick={onReConsent} disabled={busy}>
              {busy ? "Continuing..." : "Re-consent and continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // --- Preview / consent state (D8b) ---
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm AI cost</DialogTitle>
          <DialogDescription>
            You only pay for deep AI runs. Here is the cost before anything runs
            -- rough heuristic scores are always free.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ResourceError label="cost preview" error={error} onRetry={onRetry} />
        ) : loading || !preview ? (
          <div
            className="flex flex-col gap-2"
            aria-busy="true"
            aria-label="Loading cost preview"
          >
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-7 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-md)] border border-border">
              {preview.items.map((item, i) => (
                <li
                  key={`${item.label}-${i}`}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="flex-1">
                    <div className="text-[13px]">{item.label}</div>
                    <div className="font-mono text-[11px] text-[var(--fg-muted)]">
                      {item.model}
                    </div>
                  </div>
                  <span className="font-mono text-[13px]">
                    {usd(item.estCostUsd)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 px-1 pt-1">
              <span className="flex-1 text-[13px] font-semibold">
                Estimated total
              </span>
              <span
                className="font-mono text-[13px] font-semibold"
                aria-live="polite"
              >
                {usd(preview.totalUsd)}
              </span>
            </div>
            <div className="flex items-center gap-3 px-1 text-[12px] text-[var(--fg-muted)]">
              <span className="flex-1">Remaining this month</span>
              <span className="font-mono">{usd(preview.capRemainingUsd)}</span>
            </div>

            {preview.overCap ? (
              <div className="mt-1 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warn-text)]/40 bg-[var(--warn-soft)] px-3 py-2 text-[12px] text-[var(--warn-text)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  This would exceed your remaining cap. Raise your cap in
                  Settings, or run fewer resumes.
                </span>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={loading || busy || !preview || preview.overCap}
          >
            {busy ? "Running..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
