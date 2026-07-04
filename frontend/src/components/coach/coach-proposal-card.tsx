/**
 * COA-032: renders a Coach-proposed change as before/after diff rows with
 * Accept / Reject (gate 1). Once accepted it collapses to an "accepted, not yet
 * saved" state; persisting (gate 2) happens via the panel's Save action.
 */

import { CheckIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button-eb"
import { Card } from "@/components/ui/card-eb"
import type { CoachProposal } from "@/data/types"

export interface CoachProposalCardProps {
  proposal: CoachProposal
  onAccept: () => void
  onReject: () => void
  onSave: () => void
  saving?: boolean
}

export function CoachProposalCard({
  proposal,
  onAccept,
  onReject,
  onSave,
  saving,
}: CoachProposalCardProps) {
  return (
    <Card
      variant="tight"
      className="border-l-2 border-l-[var(--accent)]"
      data-slot="coach-proposal-card"
    >
      <div className="text-[13px] font-semibold">{proposal.summary}</div>
      <div className="mt-2 flex flex-col gap-2">
        {proposal.diff.map((d, i) => (
          <div
            key={i}
            className="rounded-md border border-border p-2 text-[12px]"
          >
            <div className="mb-1 font-mono text-[10px] uppercase text-[var(--fg-subtle)]">
              {d.field}
            </div>
            <div className="text-[var(--danger-text)] line-through opacity-70">
              {d.before}
            </div>
            <div className="text-[var(--fg)]">{d.after}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {proposal.status === "pending" ? (
          <>
            <Button size="sm" onClick={onAccept}>
              <CheckIcon className="size-3.5" /> Accept
            </Button>
            <Button size="sm" variant="ghost" onClick={onReject}>
              <XIcon className="size-3.5" /> Reject
            </Button>
          </>
        ) : proposal.status === "accepted" ? (
          <>
            <span className="text-[12px] text-[var(--fg-muted)]">
              Accepted -- not yet saved.
            </span>
            <Button
              size="sm"
              className="ml-auto"
              onClick={onSave}
              disabled={saving}
            >
              Save change
            </Button>
          </>
        ) : (
          <span className="text-[12px] text-[var(--fg-subtle)]">Rejected.</span>
        )}
      </div>
    </Card>
  )
}
