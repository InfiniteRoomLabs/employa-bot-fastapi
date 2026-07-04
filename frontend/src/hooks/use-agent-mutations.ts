/**
 * Agent mutation hook (AGT-022 Pause / Run-now / toggle live).
 *
 * Wraps `patchAgent`. Call `useAgent(id).refetch()` or `useAgents().refetch()`
 * after patching to refresh the display.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { Agent, AgentTrustTier, AgentTrustTierUpdate } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseAgentMutationsResult {
  /**
   * Patch mutable fields on an agent: `state`, `stateLabel`, and/or `live`.
   * Returns the updated Agent.
   */
  patchAgent: (
    id: string,
    patch: Partial<Pick<Agent, "state" | "stateLabel" | "live">>,
  ) => Promise<Agent>
  /**
   * Request a trust-tier change (D25 / AGT-031). Soft-gate: the mock grants
   * immediately. Call `useAgentTrustTier(id).refetch()` after to refresh.
   */
  patchTrustTier: (
    id: string,
    targetTier: AgentTrustTier,
  ) => Promise<AgentTrustTierUpdate>
  /** True while any mutation is in-flight. */
  isPatching: boolean
  /** Last error, cleared on the next call. */
  error: MockApiError | undefined
}

export function useAgentMutations(): UseAgentMutationsResult {
  const [isPatching, setIsPatching] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const patchAgent = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Agent, "state" | "stateLabel" | "live">>,
    ): Promise<Agent> => {
      setIsPatching(true)
      setError(undefined)
      try {
        return await api.patchAgent(id, patch)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(`agents/${id}`, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsPatching(false)
      }
    },
    [],
  )

  const patchTrustTier = useCallback(
    async (
      id: string,
      targetTier: AgentTrustTier,
    ): Promise<AgentTrustTierUpdate> => {
      setIsPatching(true)
      setError(undefined)
      try {
        return await api.patchAgentTrustTier(id, targetTier)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(`agents/${id}/trust-tier`, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsPatching(false)
      }
    },
    [],
  )

  return { patchAgent, patchTrustTier, isPatching, error }
}
