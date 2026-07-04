import * as api from "../data/api"
import type { AgentLogEntry, AgentLogFilter } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/**
 * @param filter - Optional log filter. The reference is the dep — callers
 *   must memoize this upstream (e.g. with `useMemo`) to avoid refetch loops.
 */
export function useAgentLog(
  filter?: AgentLogFilter,
): HookState<readonly AgentLogEntry[]> {
  return useAsyncResource(() => api.getAgentLog(filter), [filter])
}
