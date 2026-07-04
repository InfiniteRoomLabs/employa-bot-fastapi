import * as api from "../data/api"
import type { Search } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useSearches(): HookState<readonly Search[]> {
  return useAsyncResource(() => api.getSearches(), [])
}
