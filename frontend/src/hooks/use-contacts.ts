import * as api from "../data/api"
import type { Contact } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** CON-001: the user's contacts list. */
export function useContacts(): HookState<readonly Contact[]> {
  return useAsyncResource(() => api.getContacts(), [])
}
