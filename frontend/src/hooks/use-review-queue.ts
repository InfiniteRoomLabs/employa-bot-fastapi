/**
 * Review queue hook (AGT-021).
 *
 * Returns the list of agent actions awaiting human approval, plus
 * `approve` and `reject` mutation callbacks.
 *
 * Read state is backed by `useAsyncResource` (HookState<T>).
 * After approving or rejecting, call `refetch()` to reload the queue.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { ReviewQueueItem } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export interface UseReviewQueueResult
  extends HookState<readonly ReviewQueueItem[]> {
  /** Approve the queued action with the given ref. Refetches automatically. */
  approve: (ref: string) => Promise<void>
  /** Reject the queued action with the given ref. Refetches automatically. */
  reject: (ref: string) => Promise<void>
  /** True while an approve/reject mutation is in-flight. */
  isMutating: boolean
  /** Last error from approve/reject, cleared on next call. */
  mutationError: MockApiError | undefined
}

export function useReviewQueue(): UseReviewQueueResult {
  const base = useAsyncResource(() => api.getReviewQueue(), [])
  const [isMutating, setIsMutating] = useState(false)
  const [mutationError, setMutationError] = useState<MockApiError | undefined>(
    undefined,
  )

  const runMutation = useCallback(
    async (thunk: () => Promise<void>, path: string): Promise<void> => {
      setIsMutating(true)
      setMutationError(undefined)
      try {
        await thunk()
        base.refetch()
      } catch (err) {
        const apiError =
          err instanceof MockApiError ? err : MockApiError.unknown(path, err)
        setMutationError(apiError)
        throw apiError
      } finally {
        setIsMutating(false)
      }
    },
    [base],
  )

  const approve = useCallback(
    (ref: string) =>
      runMutation(
        () => api.approveAgentAction(ref),
        "agents/review-queue/:ref/approve",
      ),
    [runMutation],
  )

  const reject = useCallback(
    (ref: string) =>
      runMutation(
        () => api.rejectAgentAction(ref),
        "agents/review-queue/:ref/reject",
      ),
    [runMutation],
  )

  return {
    ...base,
    approve,
    reject,
    isMutating,
    mutationError,
  }
}
