import * as api from "../data/api"
import type { Resume } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** Look up a resume by its stable `id` field (RES-020 route-driven detail). */
export function useResumeById(id: string): HookState<Resume> {
  return useAsyncResource(() => api.getResume(id), [id])
}
