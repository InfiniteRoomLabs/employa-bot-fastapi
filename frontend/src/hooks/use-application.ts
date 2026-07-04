import * as api from "../data/api"
import type { ApplicationView } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useApplication(id: string): HookState<ApplicationView> {
  return useAsyncResource(() => api.getApplication(id), [id])
}
