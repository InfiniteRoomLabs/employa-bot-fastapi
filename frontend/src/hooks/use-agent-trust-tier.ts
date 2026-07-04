import * as api from "../data/api"
import type { AgentTrustTierView } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/**
 * Agent trust standing + the full ladder for display (D25 / AGT-031).
 * Call `.refetch()` after `useAgentMutations().patchTrustTier(...)` to refresh.
 */
export function useAgentTrustTier(
  agentId: string,
): HookState<AgentTrustTierView> {
  return useAsyncResource(() => api.getAgentTrustTier(agentId), [agentId])
}
