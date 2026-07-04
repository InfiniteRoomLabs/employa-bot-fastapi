/**
 * Deep (paid) match-score actions (D8 / D8b / D9a). `preview` itemizes the cost
 * before anything runs; `run` performs the paid scoring and throws `cap_reached`
 * when the monthly cap is hit (the UI re-consents -- never a silent downgrade).
 */

import { useCallback, useState } from "react"

import * as api from "../data/api"
import type { CostPreview, DeepMatchResult } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseDeepMatchScoreResult {
  preview: (
    jobId: string,
    resumeNames: readonly string[],
  ) => Promise<CostPreview>
  run: (jobId: string, resumeName: string) => Promise<DeepMatchResult>
  isPreviewing: boolean
  isRunning: boolean
  error: MockApiError | undefined
}

export function useDeepMatchScore(): UseDeepMatchScoreResult {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const preview = useCallback(
    async (
      jobId: string,
      resumeNames: readonly string[],
    ): Promise<CostPreview> => {
      setIsPreviewing(true)
      setError(undefined)
      try {
        return await api.previewDeepMatchScore(jobId, resumeNames)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(`jobs/${jobId}/preview-deep-score`, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsPreviewing(false)
      }
    },
    [],
  )

  const run = useCallback(
    async (jobId: string, resumeName: string): Promise<DeepMatchResult> => {
      setIsRunning(true)
      setError(undefined)
      try {
        return await api.runDeepMatchScore(jobId, resumeName)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(`jobs/${jobId}/deep-score`, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsRunning(false)
      }
    },
    [],
  )

  return { preview, run, isPreviewing, isRunning, error }
}
