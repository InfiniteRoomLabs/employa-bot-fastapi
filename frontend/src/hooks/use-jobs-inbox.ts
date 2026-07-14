import * as api from "../data/api"
import type { JobInboxItem } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useJobsInbox(
  searchId?: string,
  enabled = true,
): HookState<readonly JobInboxItem[]> {
  return useAsyncResource(() => api.getJobsInbox(searchId), [searchId], enabled)
}
