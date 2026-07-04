import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { CreateSearchInput, Search } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseCreateSearchResult {
  createSearch: (input: CreateSearchInput) => Promise<Search>
  isCreating: boolean
  error: MockApiError | undefined
}

export function useCreateSearch(): UseCreateSearchResult {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const createSearch = useCallback(
    async (input: CreateSearchInput): Promise<Search> => {
      setIsCreating(true)
      setError(undefined)
      try {
        const result = await api.createSearch(input)
        return result
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown("searches/create", err)
        setError(apiError)
        throw apiError
      } finally {
        setIsCreating(false)
      }
    },
    [],
  )

  return { createSearch, isCreating, error }
}
