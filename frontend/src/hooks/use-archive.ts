/**
 * ORI-009: hooks for the wins / passed-on archive screens.
 *
 * useArchive(kind) -- fetch the filtered archive pool for 'won' or 'passed'.
 * useArchiveCounts() -- fetch the {won, passed} badge counts for the sidebar.
 */

import * as api from "../data/api"
import type { ApplicationView } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useArchive(
  kind: "won" | "passed",
): HookState<readonly ApplicationView[]> {
  return useAsyncResource(() => api.getArchive(kind), [kind])
}

export function useArchiveCounts(): HookState<{ won: number; passed: number }> {
  return useAsyncResource(() => api.getArchiveCounts(), [])
}
