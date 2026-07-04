/**
 * Danger zone panel -- destructive actions guarded by a confirmation
 * Dialog. Matches `settings.jsx::SetDanger`: three cards, last two
 * styled with the danger border + soft fill.
 *
 * AUTH-029: "Delete account" row gets a 30-day grace period dialog and a
 * persistent in-panel pending-deletion banner with a "Cancel deletion" CTA.
 * Other danger rows keep the generic toast.warn confirm path.
 *
 * NOTE: pendingDeletion is local React state. It resets on unmount (navigation
 * away and back). This is intentional mockup-correct behavior -- there is no
 * server-side pending state to restore.
 */

import * as React from "react"

import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import type { DangerAction } from "@/data/types"

import { SectionHeading } from "./section-heading"

export interface DangerPanelProps {
  value: readonly DangerAction[]
}

const DELETE_ACCOUNT_TITLE = "Delete account"

function get30DayGraceDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function DangerPanel({ value }: DangerPanelProps) {
  const [pending, setPending] = React.useState<DangerAction | null>(null)
  // AUTH-029: tracks whether Delete account has been confirmed
  const [pendingDeletion, setPendingDeletion] = React.useState(false)
  const graceDate = React.useMemo(() => get30DayGraceDate(), [])

  const isDeleteAccount = pending?.title === DELETE_ACCOUNT_TITLE

  const confirm = () => {
    if (!pending) {
      return
    }

    if (isDeleteAccount) {
      // AUTH-029: enter pending-deletion state instead of generic toast
      setPendingDeletion(true)
      setPending(null)
      return
    }

    // Generic warn path for Archive / Reset actions
    console.log(`[settings] Danger action: ${pending.title}`)
    toast.warn({
      title: pending.title,
      sub: "Demo only -- nothing was actually changed.",
    })
    setPending(null)
  }

  const cancelDeletion = () => {
    setPendingDeletion(false)
    toast.success({
      title: "Deletion cancelled",
      sub: "Your account is active.",
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Danger zone"
        subtitle="Reversible operations and the permanent ones, all in one place."
      />

      {/* AUTH-029: pending-deletion banner */}
      {pendingDeletion ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3">
          <p className="text-[13px] font-semibold text-[var(--danger-text)]">
            Account scheduled for deletion on {graceDate}
          </p>
          <p className="text-[12.5px] text-[var(--danger-text)] opacity-85">
            Your data will be permanently removed after the 30-day grace period.
            Recover it instead?
          </p>
          <Button variant="secondary" size="sm" onClick={cancelDeletion}>
            Cancel deletion
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {value.map((row) => (
          <Card
            key={row.title}
            className={
              row.danger
                ? "border-[var(--danger)] bg-[var(--danger-soft)] p-4"
                : "p-4"
            }
          >
            <div className="flex items-center gap-3.5">
              <div className="flex-1">
                <div
                  className="text-sm font-semibold"
                  style={
                    row.danger ? { color: "var(--danger-text)" } : undefined
                  }
                >
                  {row.title}
                </div>
                <div
                  className="text-[12.5px]"
                  style={
                    row.danger
                      ? { color: "var(--danger-text)", opacity: 0.85 }
                      : { color: "var(--fg-muted)" }
                  }
                >
                  {row.description}
                </div>
              </div>
              <Button
                variant={row.danger ? "danger" : "secondary"}
                size="sm"
                onClick={() => setPending(row)}
                aria-label={row.cta}
                // Disable the delete button while in pending-deletion state
                disabled={row.title === DELETE_ACCOUNT_TITLE && pendingDeletion}
              >
                {row.title === DELETE_ACCOUNT_TITLE && pendingDeletion
                  ? "Scheduled"
                  : row.cta}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.title ?? ""}</DialogTitle>
            <DialogDescription>
              {isDeleteAccount ? (
                // AUTH-029: explicit 30-day grace period + account-scoped erasure (ADR-007)
                <>
                  Your entire account is the unit of erasure: all your data{" "}
                  <strong>and every actor in it</strong> -- you, your Coach, and
                  any agents -- would be permanently deleted after a{" "}
                  <strong>30-day grace period</strong>. This cannot be undone.
                </>
              ) : (
                <>
                  {pending?.description ?? ""} This action cannot be undone in
                  production.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {/* AUTH-029: Cancel dismisses unchanged (AC2) */}
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant={pending?.danger ? "danger" : "secondary"}
              onClick={confirm}
            >
              {pending?.cta ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
