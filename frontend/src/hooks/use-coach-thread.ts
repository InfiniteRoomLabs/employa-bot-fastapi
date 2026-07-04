import * as api from "../data/api"
import type { CoachMessage, CoachThread, ContextCard } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export interface CoachThreadBundle {
  thread: CoachThread
  messages: readonly CoachMessage[]
  context: readonly ContextCard[]
}

export function useCoachThread(id: string): HookState<CoachThreadBundle> {
  return useAsyncResource(() => api.getCoachThread(id), [id])
}
