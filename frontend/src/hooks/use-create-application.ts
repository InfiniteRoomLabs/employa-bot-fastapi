import { useCallback, useState } from "react"
import type { CreateApplicationInput } from "../data/api"
import * as api from "../data/api"
import type { ApplicationView } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseCreateApplicationResult {
  createApplication: (draft: CreateApplicationInput) => Promise<ApplicationView>
  isCreating: boolean
  error: MockApiError | undefined
}

/**
 * Wraps `api.createApplication` so screens (add-app capture flow) never touch
 * the swap-seam directly. Mock-only: appends a new Application to the in-memory
 * store at stage `draft` and returns it.
 */
export function useCreateApplication(): UseCreateApplicationResult {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const createApplication = useCallback(
    async (draft: CreateApplicationInput): Promise<ApplicationView> => {
      setIsCreating(true)
      setError(undefined)
      try {
        return await api.createApplication(draft)
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown("applications/create", err)
        setError(apiError)
        throw apiError
      } finally {
        setIsCreating(false)
      }
    },
    [],
  )

  return { createApplication, isCreating, error }
}
