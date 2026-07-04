/**
 * Account deletion hook (ACC-danger, SET-danger).
 *
 * Provides a `deleteAccount` callback. In the mockup this simulates a
 * 30-day grace period being opened; the page would redirect to a
 * confirmation screen in a real app.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import { MockApiError } from "../lib/mock-api-error"

export interface UseDeleteAccountResult {
  /**
   * Initiate account deletion. Resolves with the grace-period end date
   * (ISO-8601 date string, e.g. '2026-06-28').
   */
  deleteAccount: () => Promise<{ gracePeriodEndsAt: string }>
  /** True while the request is in-flight. */
  isDeleting: boolean
  /** Last error, cleared on the next call. */
  error: MockApiError | undefined
}

export function useDeleteAccount(): UseDeleteAccountResult {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const deleteAccount = useCallback(async (): Promise<{
    gracePeriodEndsAt: string
  }> => {
    setIsDeleting(true)
    setError(undefined)
    try {
      return await api.deleteAccount()
    } catch (err) {
      const apiError =
        err instanceof MockApiError
          ? err
          : MockApiError.unknown("account/delete", err)
      setError(apiError)
      throw apiError
    } finally {
      setIsDeleting(false)
    }
  }, [])

  return { deleteAccount, isDeleting, error }
}
