import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { Search, UpdateSearchCriteriaInput } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseUpdateSearchCriteriaResult {
  updateCriteria: (input: UpdateSearchCriteriaInput) => Promise<Search>
  isSaving: boolean
  error: MockApiError | undefined
}

export function useUpdateSearchCriteria(): UseUpdateSearchCriteriaResult {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const updateCriteria = useCallback(
    async (input: UpdateSearchCriteriaInput): Promise<Search> => {
      setIsSaving(true)
      setError(undefined)
      try {
        const result = await api.updateSearchCriteria(input)
        return result
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown(`searches/${input.id}`, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsSaving(false)
      }
    },
    [],
  )

  return { updateCriteria, isSaving, error }
}
