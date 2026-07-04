import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { ApplicationView } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseApplyToJobResult {
  applyTo: (jobRole: string, searchId?: string) => Promise<ApplicationView>
  isApplying: boolean
  error: MockApiError | undefined
}

export function useApplyToJob(): UseApplyToJobResult {
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  // searchId reserved for future API seam; unused in mockup
  const applyTo = useCallback(
    async (jobRole: string, searchId?: string): Promise<ApplicationView> => {
      void searchId
      setIsApplying(true)
      setError(undefined)
      try {
        // Synthesise a minimal application from the job role name
        const result = await api.createApplication({
          company: jobRole,
          role: jobRole,
          stageLabel: "applied just now",
          location: "",
          salary: null,
          resume: "",
          match: 0,
          days: 0,
          source: "greenhouse",
        })
        return result
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown("applications/apply", err)
        setError(apiError)
        throw apiError
      } finally {
        setIsApplying(false)
      }
    },
    [],
  )

  return { applyTo, isApplying, error }
}
