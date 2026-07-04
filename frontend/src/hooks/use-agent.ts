import * as api from "../data/api"
import type { Agent } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useAgent(id: string): HookState<Agent> {
  return useAsyncResource(() => api.getAgent(id), [id])
}
