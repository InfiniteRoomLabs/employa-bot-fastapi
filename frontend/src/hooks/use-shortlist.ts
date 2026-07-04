import * as api from "../data/api"
import type { ShortlistEntry } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useShortlist(
  searchId?: string,
): HookState<readonly ShortlistEntry[]> {
  return useAsyncResource(() => api.getShortlist(searchId), [searchId])
}
