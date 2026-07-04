import * as api from "../data/api"
import type { Agent } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useAgents(): HookState<readonly Agent[]> {
  return useAsyncResource(() => api.getAgents(), [])
}
