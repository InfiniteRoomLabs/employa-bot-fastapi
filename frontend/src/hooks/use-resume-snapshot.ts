import * as api from "../data/api"
import type { ResumeSnapshot } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/**
 * The immutable resume snapshot submitted with an application (D10). Errors with
 * `conflict` before the application reaches APPLIED. Mount the consumer only
 * when needed (e.g. inside an open dialog) so the fetch is lazy.
 */
export function useResumeSnapshot(appId: string): HookState<ResumeSnapshot> {
  return useAsyncResource(() => api.getResumeSnapshot(appId), [appId])
}
