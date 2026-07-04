import * as api from "../data/api"
import type { Answer } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** ANS-001: the user's saved answers to recurring application questions. */
export function useAnswers(): HookState<readonly Answer[]> {
  return useAsyncResource(() => api.getAnswers(), [])
}
