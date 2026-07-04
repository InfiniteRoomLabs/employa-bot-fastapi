import * as api from "../data/api"
import type { CoachThread } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useCoachThreads(): HookState<readonly CoachThread[]> {
  return useAsyncResource(() => api.getCoachThreads(), [])
}
