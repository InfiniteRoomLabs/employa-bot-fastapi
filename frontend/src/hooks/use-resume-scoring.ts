/**
 * D21: toggle whether a master resume participates in match scoring. Default ON.
 * Call `useResumes().refetch()` after to refresh the list.
 */

import { useCallback, useState } from "react"

import * as api from "../data/api"
import type { Resume } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseResumeScoringResult {
  setScoring: (id: string, enabled: boolean) => Promise<Resume>
  isBusy: boolean
  error: MockApiError | undefined
}

export function useResumeScoring(): UseResumeScoringResult {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const setScoring = useCallback(
    async (id: string, enabled: boolean): Promise<Resume> => {
      setIsBusy(true)
      setError(undefined)
      try {
        return await api.patchResumeScoring(id, enabled)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(`resumes/${id}`, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsBusy(false)
      }
    },
    [],
  )

  return { setScoring, isBusy, error }
}
