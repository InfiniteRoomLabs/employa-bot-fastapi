import * as api from "../data/api"
import type { MatchReport } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useMatchReport(args: {
  resumeId: string
  jobId: string
}): HookState<MatchReport> {
  return useAsyncResource(
    () => api.getMatchReport(args),
    [args.resumeId, args.jobId],
  )
}
