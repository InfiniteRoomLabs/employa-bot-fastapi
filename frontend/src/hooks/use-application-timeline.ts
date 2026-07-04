import * as api from "../data/api"
import type { TimelineEvent } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useApplicationTimeline(
  appId: string,
): HookState<readonly TimelineEvent[]> {
  return useAsyncResource(() => api.getApplicationTimeline(appId), [appId])
}
