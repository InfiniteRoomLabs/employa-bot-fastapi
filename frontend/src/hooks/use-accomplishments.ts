import * as api from "../data/api"
import type { Accomplishment } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** ACC-001: the user's reusable accomplishments. */
export function useAccomplishments(): HookState<readonly Accomplishment[]> {
  return useAsyncResource(() => api.getAccomplishments(), [])
}
