import * as api from "../data/api"
import type { Resume } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useResume(nameOrIndex: string | number): HookState<Resume> {
  return useAsyncResource(() => api.getResume(nameOrIndex), [nameOrIndex])
}
