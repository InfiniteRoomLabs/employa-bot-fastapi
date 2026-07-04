/**
 * COA-032 two-gate proposal flow. `propose` asks Coach to draft a change
 * (returns a pending diff); `save` persists an accepted proposal (gate 2) and
 * returns the attributed audit event. Gate 1 (accept into the working copy) is
 * front-end only and handled by the CoachPanelProvider working-copy bridge.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { CoachProposal, CoachSubject, TimelineEvent } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseCoachProposalResult {
  propose: (subject: CoachSubject) => Promise<CoachProposal>
  save: (proposal: CoachProposal) => Promise<TimelineEvent>
  isMutating: boolean
  error: MockApiError | undefined
}

export function useCoachProposal(): UseCoachProposalResult {
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const run = useCallback(
    async <T>(thunk: () => Promise<T>, path: string): Promise<T> => {
      setIsMutating(true)
      setError(undefined)
      try {
        return await thunk()
      } catch (err) {
        const apiError =
          err instanceof MockApiError ? err : MockApiError.unknown(path, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsMutating(false)
      }
    },
    [],
  )

  return {
    propose: useCallback(
      (subject) => run(() => api.proposeCoachEdit(subject), "coach/proposals"),
      [run],
    ),
    save: useCallback(
      (proposal) =>
        run(
          () => api.saveCoachProposal(proposal),
          "coach/proposals/:id/accept",
        ),
      [run],
    ),
    isMutating,
    error,
  }
}
