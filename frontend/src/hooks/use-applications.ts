import * as api from "../data/api"
import type { ApplicationView } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useApplications(
  searchId?: string,
): HookState<readonly ApplicationView[]> {
  return useAsyncResource(() => api.getApplications(searchId), [searchId])
}
