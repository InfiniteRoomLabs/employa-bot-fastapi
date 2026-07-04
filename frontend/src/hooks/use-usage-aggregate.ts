/**
 * Usage aggregate hook (SET-billing).
 *
 * Returns the current billing-period token-usage summary. Backed by
 * `useAsyncResource` so the screen can show loading / error states.
 */

import * as api from "../data/api"
import type { UsageAggregate } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useUsageAggregate(): HookState<UsageAggregate> {
  return useAsyncResource(() => api.getUsageAggregate(), [])
}
