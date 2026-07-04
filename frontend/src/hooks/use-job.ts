import * as api from "../data/api"
import type { Job } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** A single captured job by UUID (ADR-006). Drives the `/jobs/:id` detail page. */
export function useJob(id: string): HookState<Job> {
  return useAsyncResource(() => api.getJob(id), [id])
}

/** The full captured-job collection. */
export function useJobs(): HookState<readonly Job[]> {
  return useAsyncResource(() => api.getJobs(), [])
}
