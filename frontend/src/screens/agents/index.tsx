/**
 * Agents overview - grid of agent cards with state, stats, and actions.
 *
 * Picker id: `agents`
 * Route path: `/agents` (Phase 9)
 *
 * Stories implemented:
 *   AGT-022 -- derived subtitle (configured/running/awaiting) + derived KPI StatCards
 *   AGT-021 -- "Review queue" Button navigates to /agents/review-queue
 *   CUR-017 -- ResourceError on useAgents error
 *   CUR-024 -- EmptyState when data is empty
 */

import {
  BriefcaseIcon,
  EyeIcon,
  HistoryIcon,
  PauseIcon,
  PlusIcon,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "@/components/atoms/empty-state"
import { ResourceError } from "@/components/atoms/resource-error"
import { StatCard } from "@/components/atoms/stat-card"
import { AgentCard } from "@/components/domain/agent-card"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Button } from "@/components/ui/button-eb"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import type { AgentLogFilter } from "@/data/types"
import { useAgentLog, useAgentMutations, useAgents } from "@/hooks"
import { pathFor } from "@/routes"

const AWAIT_FILTER: AgentLogFilter = { kind: "await" }

export default function AgentsScreen() {
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useAgents()
  const { patchAgent, isPatching } = useAgentMutations()

  // ORI-014: pause every running agent, then refresh the list.
  async function handlePauseAll() {
    const running = (data ?? []).filter((agent) => agent.state === "running")
    if (running.length === 0) {
      toast.default({
        title: "No running agents",
        sub: "Everything is already paused.",
      })
      return
    }
    try {
      await Promise.all(
        running.map((agent) =>
          patchAgent(agent.id, {
            state: "paused",
            stateLabel: "Paused",
            live: false,
          }),
        ),
      )
      refetch()
      toast.success({
        title: `Paused ${running.length} agents`,
        sub: "Resume any of them anytime.",
      })
    } catch {
      toast.error({ title: "Could not pause agents", sub: "Please try again." })
    }
  }

  // The agent marketplace is not built in the mockup -- honest mocked feedback.
  function handleBrowseMarketplace() {
    toast.default({
      title: "Agent marketplace is coming",
      sub: "In the real product this opens the catalog of installable agents.",
    })
  }
  // useAgentLog is cheap (pure in-memory filter); called here to derive await count
  const { data: logData } = useAgentLog(AWAIT_FILTER)

  // ----- Derived KPIs (AGT-022)
  const configured = data?.length ?? 0
  const running = data?.filter((agent) => agent.state === "running").length ?? 0
  const awaitCount = logData?.length ?? 0

  // Spend: sum numeric cost across agents, skip '—' and non-numeric values
  const spendTotal = (data ?? []).reduce((sum, a) => {
    const numeric = parseFloat(a.cost.replace("$", ""))
    return isNaN(numeric) ? sum : sum + numeric
  }, 0)
  const spendLabel = `$${spendTotal.toFixed(2)}`

  const subtitle =
    data != null
      ? `${configured} configured - ${running} running - ${awaitCount} need your eyes`
      : "Loading..."

  return (
    <AppFrame active="agents" title="Agents" subtitle={subtitle}>
      <PageHead
        eyebrow="Your background crew"
        title={
          <>
            A few small agents. One <em>job hunt</em>.
          </>
        }
        lede="These agents watch the applications you track - flagging stale ones, marking ghosted ones, and drafting follow-ups. Each shows what it's doing, what it cost, and where it's stuck. Pause any of them anytime. We don't hide the receipts."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(pathFor("agent-log"))}
            >
              <HistoryIcon className="size-3.5" /> Activity log
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePauseAll}
              disabled={isPatching}
            >
              <PauseIcon className="size-3.5" /> Pause all
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleBrowseMarketplace}
            >
              <PlusIcon className="size-3.5" /> Browse marketplace
            </Button>
          </>
        }
      />

      {/* Await banner -- only shown when there are items waiting */}
      {awaitCount > 0 ? (
        <div className="mb-5 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--warn)] bg-[var(--warn-soft)] p-3.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--bg-elevated)]">
            <EyeIcon className="size-[15px] text-[var(--warn-text)]" />
          </div>
          <div className="flex-1 text-[13.5px] text-[var(--warn-text)]">
            <b>
              {awaitCount} {awaitCount === 1 ? "thing needs" : "things need"}{" "}
              your eyes.
            </b>{" "}
            Coach drafted a follow-up for <b>Stripe</b> - review before you send
            it.
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(pathFor("agent-review-queue"))}
          >
            Review queue
          </Button>
        </div>
      ) : null}

      {/* Fleet KPI strip -- derived values */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCard
          label="Running"
          value={String(running)}
          hint={`of ${configured} agents`}
        />
        <StatCard
          label="Drafts waiting"
          value={String(awaitCount)}
          delta={awaitCount > 0 ? "review now" : undefined}
          tone={awaitCount > 0 ? "up" : undefined}
        />
        <StatCard
          label="Spend this month"
          value={spendLabel}
          hint={`of $20 budget - ${Math.round((spendTotal / 20) * 100)}%`}
        />
        <StatCard
          label="Hours saved (est.)"
          value="14"
          delta="this week"
          tone="up"
        />
      </div>

      {/* Agent card grid */}
      {isLoading && !data ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <ResourceError label="agents" error={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={BriefcaseIcon}
          headline="No agents configured"
          body="Browse the marketplace to add agents to your crew."
          cta={{ label: "Browse marketplace", onClick: () => {} }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {data.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </AppFrame>
  )
}
