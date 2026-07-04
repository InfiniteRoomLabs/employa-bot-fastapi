import * as api from "../data/api"
import type { InterviewRound } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useInterviewRounds(
  appId: string,
): HookState<readonly InterviewRound[]> {
  return useAsyncResource(() => api.getInterviewRounds(appId), [appId])
}
