import * as api from "../data/api"
import type { Search } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useSearch(id: string): HookState<Search> {
  return useAsyncResource(() => api.getSearch(id), [id])
}
