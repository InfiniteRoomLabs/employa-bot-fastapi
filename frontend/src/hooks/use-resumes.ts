import * as api from "../data/api"
import type { Resume } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useResumes(): HookState<readonly Resume[]> {
  return useAsyncResource(() => api.getResumes(), [])
}
