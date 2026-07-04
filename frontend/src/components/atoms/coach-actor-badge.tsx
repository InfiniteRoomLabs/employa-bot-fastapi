import { BotIcon, UserIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge-eb"
import type { CoachActor } from "@/data/types"

export interface CoachActorBadgeProps {
  actor: CoachActor
  /** Named agent label, used when actor === 'agent'. */
  agentName?: string
}

/**
 * COA-036: attributes an action to who performed it -- "You", "Coach (on
 * behalf of you)", or a named agent. Used wherever an audit/history entry or
 * a saved Coach change is shown.
 */
export function CoachActorBadge({ actor, agentName }: CoachActorBadgeProps) {
  if (actor === "you") {
    return (
      <Badge variant="default">
        <UserIcon className="size-3" aria-hidden /> You
      </Badge>
    )
  }
  if (actor === "agent") {
    return (
      <Badge variant="info">
        <BotIcon className="size-3" aria-hidden /> {agentName ?? "Agent"}
      </Badge>
    )
  }
  return (
    <Badge variant="accent">
      <BotIcon className="size-3" aria-hidden /> Coach (on behalf of you)
    </Badge>
  )
}
