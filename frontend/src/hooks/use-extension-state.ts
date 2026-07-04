import * as api from "../data/api"
import type { ExtensionRecentCapture, ExtensionState } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export interface ExtensionStateBundle {
  state: ExtensionState
  label: string
  recentCaptures: readonly ExtensionRecentCapture[]
}

export function useExtensionState(
  state: ExtensionState,
): HookState<ExtensionStateBundle> {
  return useAsyncResource(() => api.getExtensionState(state), [state])
}
