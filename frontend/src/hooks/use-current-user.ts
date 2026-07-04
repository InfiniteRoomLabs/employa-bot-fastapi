import * as api from "../data/api"
import type { User } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useCurrentUser(): HookState<User> {
  return useAsyncResource(() => api.getCurrentUser(), [])
}
