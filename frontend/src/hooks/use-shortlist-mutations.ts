/**
 * Shortlist mutation hook.
 *
 * Wraps `dismissFromShortlist` (the only shortlist mutation not already
 * covered by `useAddJobToShortlist`). Call `useShortlist().refetch()`
 * after dismissing to refresh the list.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import { MockApiError } from "../lib/mock-api-error"

export interface UseShortlistMutationsResult {
  /** Remove a shortlist entry by role name. */
  dismiss: (entryRole: string) => Promise<void>
  /** True while the request is in-flight. */
  isDismissing: boolean
  /** Last error, cleared on the next call. */
  error: MockApiError | undefined
}

export function useShortlistMutations(): UseShortlistMutationsResult {
  const [isDismissing, setIsDismissing] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const dismiss = useCallback(async (entryRole: string): Promise<void> => {
    setIsDismissing(true)
    setError(undefined)
    try {
      await api.dismissFromShortlist(entryRole)
    } catch (err) {
      const apiError =
        err instanceof MockApiError
          ? err
          : MockApiError.unknown("shortlist", err)
      setError(apiError)
      throw apiError
    } finally {
      setIsDismissing(false)
    }
  }, [])

  return { dismiss, isDismissing, error }
}
