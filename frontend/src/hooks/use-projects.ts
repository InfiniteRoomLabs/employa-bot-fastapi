import * as api from "../data/api"
import type { Project } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** PRJ-001: the user's per-employer project brain-dumps. */
export function useProjects(): HookState<readonly Project[]> {
  return useAsyncResource(() => api.getProjects(), [])
}
