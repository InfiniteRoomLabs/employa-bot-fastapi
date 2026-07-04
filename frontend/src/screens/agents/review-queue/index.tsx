/**
 * AgentReviewQueueScreen (AGT-021)
 *
 * Shows agent log entries pending human approval/rejection (kind='await').
 * Uses useReviewQueue (approve/reject mutations built-in).
 *
 * Contracts:
 *   CUR-017 -- ResourceError on fetch error
 *   CUR-024 -- EmptyState when queue is empty
 *   ORI-014 -- toast.agent on approve/reject
 */

import { ClipboardCheckIcon } from "lucide-react"
import * as React from "react"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { ReviewQueueItem } from "@/data/types"
import { useReviewQueue } from "@/hooks"

// ---------------------------------------------------------------------------
// Agent display names keyed by agent id
// ---------------------------------------------------------------------------

const AGENT_NAMES: Record<string, string> = {
  stale: "Stale-detector",
  ghost: "Ghost-detector",
  coach: "Coach",
}

function agentName(id: string): string {
  return AGENT_NAMES[id] ?? id
}

// ---------------------------------------------------------------------------
// ReviewQueueRow
// ---------------------------------------------------------------------------

interface ReviewQueueRowProps {
  item: ReviewQueueItem
  onApprove: (ref: string) => void
  onReject: (ref: string) => void
  isMutating: boolean
}

function ReviewQueueRow({
  item,
  onApprove,
  onReject,
  isMutating,
}: ReviewQueueRowProps) {
  return (
    <div className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-border bg-[var(--bg-elevated)] p-4">
      {/* Agent identifier */}
      <div className="flex w-28 shrink-0 flex-col gap-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--fg-subtle)]">
          Agent
        </div>
        <div className="text-[13px] font-medium">{agentName(item.agentId)}</div>
        <div className="font-mono text-[11px] text-[var(--fg-subtle)]">
          {item.time}
        </div>
      </div>

      {/* Action description */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[13px] font-medium leading-snug">
          {item.message}
        </div>
        <div className="text-[12px] text-[var(--fg-muted)]">{item.ref}</div>
      </div>

      {/* Approve / Reject */}
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="default"
          size="sm"
          disabled={isMutating}
          onClick={() => onApprove(item.ref)}
        >
          Approve
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isMutating}
          onClick={() => onReject(item.ref)}
        >
          Reject
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentReviewQueueScreen
// ---------------------------------------------------------------------------

export default function AgentReviewQueueScreen() {
  const { data, error, isLoading, refetch, approve, reject, isMutating } =
    useReviewQueue()

  // Local dismissed set so items disappear immediately on action without
  // waiting for the refetch round-trip.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set())

  const visibleItems = React.useMemo<readonly ReviewQueueItem[]>(
    () => (data ?? []).filter((item) => !dismissed.has(item.ref)),
    [data, dismissed],
  )

  async function handleApprove(ref: string) {
    try {
      await approve(ref)
      setDismissed((prev) => new Set([...prev, ref]))
      toast.agent({ title: "Approved", sub: ref })
    } catch {
      toast.error({ title: "Approval failed", sub: "Please try again." })
    }
  }

  async function handleReject(ref: string) {
    try {
      await reject(ref)
      setDismissed((prev) => new Set([...prev, ref]))
      toast.agent({ title: "Rejected", sub: ref })
    } catch {
      toast.error({ title: "Rejection failed", sub: "Please try again." })
    }
  }

  return (
    <AppFrame
      title={`Agent review queue${visibleItems.length > 0 ? ` (${visibleItems.length})` : ""}`}
      active="agents"
    >
      <PageHead
        eyebrow="Agents"
        title="Review queue"
        lede="Approve or reject agent actions before they go out. Each item is a draft or proposed automation waiting on your sign-off."
      />

      {isLoading && <Skeleton className="h-64 w-full" />}

      {error && !isLoading && (
        <ResourceError label="review queue" error={error} onRetry={refetch} />
      )}

      {!isLoading && !error && visibleItems.length === 0 && (
        <EmptyState
          icon={ClipboardCheckIcon}
          headline="Nothing is waiting on you"
          body="Agents will queue drafts here for your approval when they need human sign-off."
        />
      )}

      {!isLoading && !error && visibleItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleItems.map((item) => (
            <ReviewQueueRow
              key={item.ref}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              isMutating={isMutating}
            />
          ))}
        </div>
      )}
    </AppFrame>
  )
}
