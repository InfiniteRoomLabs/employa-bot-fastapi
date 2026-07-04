/**
 * Agent trust-tier ladder + "Raise tier" soft-gate (D25 / AGT-031).
 *
 * Shows the four-rung progression (observe -> suggest -> act-with-approval ->
 * autonomous) with the current tier highlighted and higher rungs dimmed + locked.
 * "Raise tier..." opens a single dialog (one modal at a time) to pick a TARGET
 * tier and "Request unlock". The mockup soft-gates: the request is framed as
 * backend-reviewed, but the mock grants immediately. No hard enforcement here.
 */

import { Info, Lock, ShieldCheck } from "lucide-react"
import * as React from "react"
import { ResourceError } from "@/components/atoms/resource-error"
import { Section } from "@/components/atoms/section"
import { Badge } from "@/components/ui/badge-eb"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AgentTrustTier } from "@/data/types"
import { useAgentMutations, useAgentTrustTier } from "@/hooks"
import { TIER_LABEL, tierRank, tiersAbove } from "@/lib/trust-tier"

export interface TrustTierCardProps {
  agentId: string
  /** Called after a successful tier change so the parent can refetch the agent. */
  onTierChange?: () => void
}

export function TrustTierCard({ agentId, onTierChange }: TrustTierCardProps) {
  const { data, isLoading, error, refetch } = useAgentTrustTier(agentId)
  const { patchTrustTier, isPatching } = useAgentMutations()
  const [raiseOpen, setRaiseOpen] = React.useState(false)
  const [target, setTarget] = React.useState<AgentTrustTier | null>(null)

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }
  if (error) {
    return <ResourceError label="trust tier" error={error} onRetry={refetch} />
  }
  if (!data) {
    return null
  }

  const current = data.currentTier
  const higher = tiersAbove(current)

  async function handleRequestUnlock() {
    if (!target) {
      return
    }
    try {
      await patchTrustTier(agentId, target)
      toast.success({
        title: `Trust raised to ${TIER_LABEL[target]}`,
        sub: "In the real product this waits for your server-side confirmation.",
      })
      setRaiseOpen(false)
      setTarget(null)
      refetch()
      onTierChange?.()
    } catch {
      toast.error({
        title: "Could not change the tier",
        sub: "Please try again.",
      })
    }
  }

  return (
    <Section
      title="Trust tier"
      subtitle="How much autonomy this agent has earned."
      actions={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About trust tiers"
                className="text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
              >
                <Info className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px]">
              Tiers are freely selectable in this preview. The real product
              gates each unlock behind your approval and earned trust.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      <ol className="flex flex-col gap-2" aria-label="Trust tier ladder">
        {data.ladder.map((rung) => {
          const isCurrent = rung.tier === current
          const isAbove = tierRank(rung.tier) > tierRank(current)
          return (
            <li
              key={rung.tier}
              aria-current={isCurrent ? "step" : undefined}
              className={
                "flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 " +
                (isCurrent
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-border") +
                (isAbove ? " opacity-55" : "")
              }
            >
              {isAbove ? (
                <Lock
                  className="mt-0.5 size-4 shrink-0 text-[var(--fg-muted)]"
                  aria-hidden
                />
              ) : (
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-[var(--accent-text)]"
                  aria-hidden
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">
                    {rung.label}
                  </span>
                  {isCurrent ? (
                    <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
                      Current
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[12px] text-[var(--fg-muted)]">
                  {rung.blurb}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      {higher.length > 0 ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRaiseOpen(true)}
          >
            Raise tier...
          </Button>
        </div>
      ) : null}

      <Dialog
        open={raiseOpen}
        onOpenChange={(open) => {
          setRaiseOpen(open)
          if (!open) {
            setTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise trust tier</DialogTitle>
            <DialogDescription>
              Pick the tier to request. Raising trust lets the agent do more on
              its own -- choose the lowest tier that covers what you need.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={target ?? undefined}
            onValueChange={(v) => setTarget(v as AgentTrustTier)}
            className="flex flex-col gap-2"
            aria-label="Target trust tier"
          >
            {higher.map((tier) => {
              const rung = data.ladder.find((r) => r.tier === tier)
              return (
                <label
                  key={tier}
                  htmlFor={`tier-${tier}`}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-md)] border border-border px-3 py-2.5 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]"
                >
                  <RadioGroupItem
                    id={`tier-${tier}`}
                    value={tier}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">
                      {TIER_LABEL[tier]}
                    </div>
                    <p className="text-[12px] text-[var(--fg-muted)]">
                      {rung?.blurb}
                    </p>
                  </div>
                </label>
              )
            })}
          </RadioGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="default"
              onClick={handleRequestUnlock}
              disabled={!target || isPatching}
            >
              {isPatching ? "Requesting..." : "Request unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
