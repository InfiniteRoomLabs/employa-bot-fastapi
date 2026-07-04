import * as api from "../data/api"
import type { Settings } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useSettings(): HookState<Settings> {
  return useAsyncResource(() => api.getSettings(), [])
}
