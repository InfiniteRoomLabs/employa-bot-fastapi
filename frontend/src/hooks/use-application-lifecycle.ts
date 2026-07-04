/**
 * Application lifecycle transitions (D12 / D18 / D19): mark-won (+ time-boxed
 * undo), reactivate a closed app, and dismiss (which branches to removed vs
 * withdrew on the server). One shared busy/error surface.
 */

import { useCallback, useState } from "react"
import type { DismissResult, MarkWonInput, MarkWonResult } from "../data/api"
import * as api from "../data/api"
import type { ApplicationView } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseApplicationLifecycleResult {
  markWon: (appId: string, input: MarkWonInput) => Promise<MarkWonResult>
  undoMarkWon: (appId: string, undoToken: string) => Promise<ApplicationView>
  reactivate: (appId: string) => Promise<ApplicationView>
  dismiss: (
    appId: string,
    reasons?: readonly string[],
  ) => Promise<DismissResult>
  isBusy: boolean
  error: MockApiError | undefined
}

export function useApplicationLifecycle(): UseApplicationLifecycleResult {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const call = useCallback(
    async <T>(path: string, op: () => Promise<T>): Promise<T> => {
      setIsBusy(true)
      setError(undefined)
      try {
        return await op()
      } catch (err) {
        const apiError =
          err instanceof MockApiError ? err : MockApiError.unknown(path, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsBusy(false)
      }
    },
    [],
  )

  const markWon = useCallback(
    (appId: string, input: MarkWonInput) =>
      call(`applications/${appId}/mark-won`, () => api.markWon(appId, input)),
    [call],
  )
  const undoMarkWon = useCallback(
    (appId: string, undoToken: string) =>
      call(`applications/${appId}/undo-mark-won`, () =>
        api.undoMarkWon(appId, undoToken),
      ),
    [call],
  )
  const reactivate = useCallback(
    (appId: string) =>
      call(`applications/${appId}/reactivate`, () =>
        api.reactivateApplication(appId),
      ),
    [call],
  )
  const dismiss = useCallback(
    (appId: string, reasons?: readonly string[]) =>
      call(`applications/${appId}/dismiss`, () =>
        api.dismissApplication(appId, reasons),
      ),
    [call],
  )

  return { markWon, undoMarkWon, reactivate, dismiss, isBusy, error }
}
