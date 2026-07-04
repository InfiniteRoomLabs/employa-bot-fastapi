import * as api from "../data/api"
import type { Credential } from "../data/types"
import { type HookState, useAsyncResource } from "./_use-async-resource"

/** CRD-001: stored licenses / certifications / documents (Post-MVP, persona hook). */
export function useCredentials(): HookState<readonly Credential[]> {
  return useAsyncResource(() => api.getCredentials(), [])
}
