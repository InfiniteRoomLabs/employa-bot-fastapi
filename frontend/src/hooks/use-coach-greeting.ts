import * as api from "../data/api"
import type { CoachGreeting, CoachThreadScope } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** COA-031: the context-scoped opening greeting + suggested-action chips. */
export function useCoachGreeting(
  scope: CoachThreadScope,
): HookState<CoachGreeting> {
  return useAsyncResource(() => api.getCoachGreeting(scope), [scope])
}
