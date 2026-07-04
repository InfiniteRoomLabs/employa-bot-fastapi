import * as api from "../data/api"
import type { UserMenuRow } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/**
 * Returns the user-menu row config rendered by `UserMenuPopover`.
 * Wraps `api.getUserMenu()` through the standard `useAsyncResource`
 * helper so failure injection + latency simulation stay symmetric with
 * every other resource hook.
 */
export function useUserMenu(): HookState<readonly UserMenuRow[]> {
  return useAsyncResource(() => api.getUserMenu(), [])
}
