/**
 * Data export hook (ACC-export).
 *
 * Provides a single `requestExport` callback. The mock returns a fake
 * signed download URL. Callers show the URL or auto-click a download link.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { DataExportRequest } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseDataExportResult {
  /** Trigger a data export request. Resolves with the download URL. */
  requestExport: () => Promise<DataExportRequest>
  /** True while the request is in-flight. */
  isRequesting: boolean
  /** Last error, cleared on the next call. */
  error: MockApiError | undefined
}

export function useDataExport(): UseDataExportResult {
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const requestExport = useCallback(async (): Promise<DataExportRequest> => {
    setIsRequesting(true)
    setError(undefined)
    try {
      return await api.requestDataExport()
    } catch (err) {
      const apiError =
        err instanceof MockApiError
          ? err
          : MockApiError.unknown("account/data-export", err)
      setError(apiError)
      throw apiError
    } finally {
      setIsRequesting(false)
    }
  }, [])

  return { requestExport, isRequesting, error }
}
