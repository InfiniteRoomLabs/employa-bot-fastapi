/**
 * Agents action log - chronological list of all agent actions.
 *
 * Picker id: `agent-log`
 * Route path: `/agents/log` (Phase 9)
 */

import * as React from "react"
import { AgentLogRow } from "@/components/domain/agent-log-row"
import { AppFrame } from "@/components/shell/app-frame"
import { PageHead } from "@/components/shell/page-head"
import { Chip } from "@/components/ui/chip"
import { Skeleton } from "@/components/ui/skeleton"
import { useAgentLog } from "@/hooks"

export default function AgentLogScreen() {
  const [kind, setKind] = React.useState<"all" | "auto" | "await" | "success">(
    "all",
  )
  const { data, isLoading } = useAgentLog()

  return (
    <AppFrame
      active="agent-log"
      title="Agents - action log"
      subtitle="Everything an agent did, newest first"
    >
      <PageHead
        eyebrow="Receipts"
        title="Agent action log"
        lede="Newest first. Every action lists what changed, when, and why. Click a row to undo."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip
          pressed={kind === "all"}
          variant="accent"
          onPressedChange={() => setKind("all")}
        >
          All
        </Chip>
        <Chip pressed={kind === "auto"} onPressedChange={() => setKind("auto")}>
          Auto
        </Chip>
        <Chip
          pressed={kind === "await"}
          onPressedChange={() => setKind("await")}
        >
          Awaiting you
        </Chip>
        <Chip
          pressed={kind === "success"}
          onPressedChange={() => setKind("success")}
        >
          Success
        </Chip>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="card p-0">
          {data.map((entry, i) => (
            <div key={i} className="border-b border-border last:border-b-0">
              <AgentLogRow entry={entry} />
            </div>
          ))}
        </div>
      )}
    </AppFrame>
  )
}
