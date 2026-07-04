/**
 * Interview-record mutations (D3 / TRK-127). Only the allowlisted fields
 * (date, type, format, status) can change; the API drops anything else.
 */

import { useCallback, useState } from "react"

import * as api from "../data/api"
import type { InterviewRound } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export type InterviewRoundPatch = Partial<
  Pick<InterviewRound, "date" | "type" | "format" | "status">
>

export interface UseInterviewMutationsResult {
  patchRound: (
    appId: string,
    roundId: string,
    patch: InterviewRoundPatch,
  ) => Promise<InterviewRound>
  isBusy: boolean
  error: MockApiError | undefined
}

export function useInterviewMutations(): UseInterviewMutationsResult {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const patchRound = useCallback(
    async (
      appId: string,
      roundId: string,
      patch: InterviewRoundPatch,
    ): Promise<InterviewRound> => {
      setIsBusy(true)
      setError(undefined)
      try {
        return await api.patchInterviewRound(appId, roundId, patch)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(
                `applications/${appId}/interviews/${roundId}`,
                err,
              )
        setError(apiError)
        throw apiError
      } finally {
        setIsBusy(false)
      }
    },
    [],
  )

  return { patchRound, isBusy, error }
}
