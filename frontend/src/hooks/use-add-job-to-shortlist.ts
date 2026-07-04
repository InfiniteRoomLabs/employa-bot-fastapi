import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { ShortlistEntry } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseAddJobToShortlistResult {
  addToShortlist: (
    entry: Pick<
      ShortlistEntry,
      "company" | "role" | "location" | "compensation" | "match"
    > &
      Partial<Pick<ShortlistEntry, "jobId">>,
  ) => Promise<ShortlistEntry>
  isSaving: boolean
  error: MockApiError | undefined
}

export function useAddJobToShortlist(): UseAddJobToShortlistResult {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const addToShortlist = useCallback(
    async (
      entry: Pick<
        ShortlistEntry,
        "company" | "role" | "location" | "compensation" | "match"
      > &
        Partial<Pick<ShortlistEntry, "jobId">>,
    ): Promise<ShortlistEntry> => {
      setIsSaving(true)
      setError(undefined)
      try {
        const result = await api.addToShortlist(entry)
        return result
      } catch (err) {
        const apiError =
          err instanceof MockApiError
            ? err
            : MockApiError.unknown("shortlist", err)
        setError(apiError)
        throw apiError
      } finally {
        setIsSaving(false)
      }
    },
    [],
  )

  return { addToShortlist, isSaving, error }
}
