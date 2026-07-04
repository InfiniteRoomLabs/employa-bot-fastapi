import * as api from "../data/api"
import type { AgentPermission } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useAgentPermissions(
  agentId: string,
): HookState<readonly AgentPermission[]> {
  return useAsyncResource(() => api.getAgentPermissions(agentId), [agentId])
}
