/**
 * Per-agent detail - config rows, permissions, recent actions, model selector.
 *
 * Picker id: `agent-detail`
 * Route path: `/agents/:id` (Phase 9)
 *
 * Stories implemented:
 *   AGT-023 -- per-agent permissions from PER_AGENT_PERMISSIONS fixture via
 *              useAgentPermissions; local dirty state + save bar; caution notes
 *              for high-power grants; AppFrame title derived from data
 *   CUR-017 -- ResourceError on useAgent error
 */

import * as React from "react"
import { useParams } from "react-router-dom"
import { AgentState } from "@/components/atoms/agent-state"
import { CostChip } from "@/components/atoms/cost-chip"
import { ResourceError } from "@/components/atoms/resource-error"
import { Section } from "@/components/atoms/section"
import { StatCard } from "@/components/atoms/stat-card"
import { TimelineRow } from "@/components/domain/timeline-row"
import { TrustTierCard } from "@/components/domain/trust-tier-card"
import { AppFrame } from "@/components/shell/app-frame"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { PageHead } from "@/components/shell/page-head"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"
import type { AgentPermission, AgentTrustTier } from "@/data/types"
import { useAgent, useAgentMutations, useAgentPermissions } from "@/hooks"
import { isAboveTier, TIER_LABEL } from "@/lib/trust-tier"

// High-power permission labels that warrant a caution note
const HIGH_POWER_PERMS = new Set([
  "Auto-send follow-ups",
  "Mark applications rejected",
])

// ---------------------------------------------------------------------------
// PermissionsSection (AGT-023)
// ---------------------------------------------------------------------------

function PermissionsSection({
  agentId,
  currentTier,
}: {
  agentId: string
  currentTier: AgentTrustTier
}) {
  const { data, isLoading, error, refetch } = useAgentPermissions(agentId)
  // Local mutable copy of permissions; initialized from hook data
  const [localPerms, setLocalPerms] = React.useState<AgentPermission[]>([])
  // Original snapshot for discard
  const [original, setOriginal] = React.useState<AgentPermission[]>([])
  const [isDirty, setIsDirty] = React.useState(false)
  // D25 soft-gate: index of a permission whose above-tier grant awaits confirmation
  const [gatePending, setGatePending] = React.useState<number | null>(null)

  // Sync hook data -> local state on first load
  React.useEffect(() => {
    if (data) {
      const perms = [...data]
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalPerms(perms)

      setOriginal(perms)

      setIsDirty(false)
    }
  }, [data])

  function applyToggle(index: number, checked: boolean) {
    setLocalPerms((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], granted: checked }
      return next
    })
    setIsDirty(true)
  }

  function handleToggle(index: number, checked: boolean) {
    const perm = localPerms[index]
    const required = perm.requiredTier ?? "observe"
    // D25: granting a permission above the agent's current tier is soft-gated.
    if (checked && isAboveTier(required, currentTier)) {
      setGatePending(index)
      return
    }
    applyToggle(index, checked)
  }

  function confirmGate() {
    if (gatePending === null) {
      return
    }
    applyToggle(gatePending, true)
    setGatePending(null)
  }

  function handleSave() {
    setOriginal([...localPerms])
    setIsDirty(false)
    toast.success({
      title: "Permissions saved (demo)",
      sub: "Not persisted across navigation.",
    })
  }

  function handleDiscard() {
    setLocalPerms([...original])
    setIsDirty(false)
  }

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (error) {
    return (
      <ResourceError
        label="agent permissions"
        error={error}
        onRetry={refetch}
      />
    )
  }

  const gatePerm = gatePending !== null ? localPerms[gatePending] : null
  const gateRequired = gatePerm?.requiredTier ?? "observe"

  return (
    <>
      <Section
        title="Permissions"
        subtitle="What this agent is allowed to touch."
      >
        <div className="flex flex-col gap-3">
          {localPerms.map((permission, index) => {
            const required = permission.requiredTier ?? "observe"
            const aboveTier =
              permission.granted && isAboveTier(required, currentTier)
            return (
              <div key={permission.permission}>
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-[13px]">
                    {permission.permission}
                  </span>
                  {aboveTier ? (
                    <Badge variant="warn" className="px-1.5 py-0 text-[10px]">
                      above tier
                    </Badge>
                  ) : null}
                  <Switch
                    checked={permission.granted}
                    onCheckedChange={(checked) => handleToggle(index, checked)}
                    aria-label={permission.permission}
                  />
                </div>
                {/* D25: above-tier note takes precedence over the generic caution */}
                {aboveTier ? (
                  <p className="mt-1 text-[11px] text-[var(--warn-text)]">
                    Above this agent&apos;s {TIER_LABEL[currentTier]} tier --
                    acting beyond earned trust.
                  </p>
                ) : HIGH_POWER_PERMS.has(permission.permission) &&
                  permission.granted ? (
                  <p className="mt-1 text-[11px] text-[var(--warn-text)]">
                    This agent will act without per-item review.
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </Section>

      {/* Unsaved changes save bar (AGT-023) */}
      {isDirty ? (
        <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2.5">
          <span className="flex-1 text-[13px] font-medium text-[var(--fg-base)]">
            Unsaved changes
          </span>
          <Button variant="ghost" size="sm" onClick={handleDiscard}>
            Discard
          </Button>
          <Button variant="default" size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      ) : null}

      {/* D25 soft-gate confirm for above-tier grants */}
      <Dialog
        open={gatePending !== null}
        onOpenChange={(open) => !open && setGatePending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant an above-tier permission?</DialogTitle>
            <DialogDescription>
              This agent is at the {TIER_LABEL[currentTier]} tier. &quot;
              {gatePerm?.permission}
              &quot; normally needs the {TIER_LABEL[gateRequired]} tier. You can
              grant it now, but the agent will act above its earned trust until
              you raise its tier.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="secondary" onClick={confirmGate}>
              Grant anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// AgentDetailScreen
// ---------------------------------------------------------------------------

export default function AgentDetailScreen() {
  // URL `:id` drives the fetch; `'stale'` is the fallback for isolated
  // mounts (Storybook, picker previews, tests without a router entry).
  const params = useParams<{ id: string }>()
  const agentId = params.id ?? "stale"
  const { data, isLoading, error, refetch } = useAgent(agentId)
  const { patchAgent, isPatching } = useAgentMutations()

  const isPaused = data?.state === "paused"

  // ORI-014: pause / resume toggles the agent state; Run now queues a run.
  async function handleTogglePause() {
    if (!data) {
      return
    }
    try {
      if (isPaused) {
        await patchAgent(data.id, {
          state: "running",
          stateLabel: "Running",
          live: true,
        })
        toast.success({ title: `${data.name} resumed` })
      } else {
        await patchAgent(data.id, {
          state: "paused",
          stateLabel: "Paused",
          live: false,
        })
        toast.success({ title: `${data.name} paused`, sub: "Resume anytime." })
      }
      refetch()
    } catch {
      toast.error({
        title: "Could not update the agent",
        sub: "Please try again.",
      })
    }
  }

  function handleRunNow() {
    if (!data) {
      return
    }
    toast.agent({
      title: `${data.name} queued for a run`,
      sub: "Results will appear in the log.",
    })
  }

  // ----- Error branches (CUR-017)
  if (!isLoading && error) {
    if (error.kind === "not_found") {
      return (
        <AppFrame
          active="agents"
          title="Agent not found"
          subtitle={
            <Breadcrumbs
              items={[
                { label: "Agents", to: "/agents" },
                { label: "Not found" },
              ]}
            />
          }
        >
          <ResourceError
            label="That agent"
            notFound
            backLabel="Back to Agents"
            backTo="/agents"
          />
        </AppFrame>
      )
    }
    return (
      <AppFrame
        active="agents"
        title="Agent"
        subtitle={
          <Breadcrumbs
            items={[{ label: "Agents", to: "/agents" }, { label: "Error" }]}
          />
        }
      >
        <ResourceError label="agent" error={error} onRetry={refetch} />
      </AppFrame>
    )
  }

  return (
    <AppFrame
      active="agents"
      title={data?.name ?? "Agent"}
      subtitle={
        <Breadcrumbs
          items={[
            { label: "Agents", to: "/agents" },
            { label: data?.name ?? "Agent" },
          ]}
        />
      }
    >
      <PageHead
        eyebrow={
          data ? `${data.stateLabel} - last run ${data.lastActivity}` : "Agent"
        }
        title={data?.name ?? "Agent"}
        lede={data?.description ?? ""}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleTogglePause}
              disabled={isPatching || !data}
            >
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button variant="default" onClick={handleRunNow} disabled={!data}>
              Run now
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2.5">
            <AgentState
              state={data.state}
              label={data.stateLabel}
              live={data.live}
            />
            <CostChip amount={data.cost} />
          </div>

          <div className="mb-6 grid grid-cols-4 gap-3">
            <StatCard label="30d actions" value={String(data.actions)} />
            <StatCard label="Last run" value={data.lastActivity} />
            <StatCard label="Cost (mo)" value={data.cost} />
            <StatCard label="Errors" value="0" />
          </div>

          <div className="grid grid-cols-[1fr_360px] gap-4">
            <div className="flex flex-col gap-4">
              <Section
                title="Configuration"
                subtitle="What this agent does and how aggressively."
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[13px]">
                      Auto-mark stale after
                    </span>
                    <span className="font-mono text-[13px] text-[var(--fg-muted)]">
                      7 days
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex-1 text-[13px]">
                      Generate follow-up drafts
                    </span>
                    <Switch defaultChecked />
                  </div>
                </div>
              </Section>

              {/* Trust tier ladder + raise-tier soft-gate (D25 / AGT-031) */}
              <TrustTierCard agentId={agentId} onTierChange={refetch} />

              {/* Per-agent permissions from fixture (AGT-023) + tier soft-gate (D25) */}
              <PermissionsSection
                agentId={agentId}
                currentTier={data.trustTier ?? "observe"}
              />
            </div>

            <Section title="Recent actions">
              <div className="flex flex-col gap-3">
                <TimelineRow
                  time="9m"
                  who={data.name}
                  msg="Flagged Stripe - 9d silence"
                />
                <TimelineRow
                  time="2h"
                  who={data.name}
                  msg="Drafted follow-up for Fly.io"
                />
                <TimelineRow
                  time="Yesterday"
                  who={data.name}
                  msg="Cleared Modal - reply received"
                />
              </div>
            </Section>
          </div>
        </>
      )}
    </AppFrame>
  )
}
