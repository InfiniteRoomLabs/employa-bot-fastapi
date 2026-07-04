/**
 * D24: Library trash + soft-delete support.
 *  - useTrash() lists soft-deleted bounded entities.
 *  - useDeletionImpact(kind, id) reports dependents for the delete-confirm dialog
 *    (mount the consumer only when the dialog is open so the fetch is lazy).
 *  - useLibraryTrashMutations() restores or permanently purges.
 */

import { useCallback, useState } from "react"

import * as api from "../data/api"
import type { DeletionImpact, LibraryKind, TrashEntry } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export function useTrash(): HookState<readonly TrashEntry[]> {
  return useAsyncResource(() => api.getTrash(), [])
}

export function useDeletionImpact(
  kind: LibraryKind,
  id: string,
): HookState<DeletionImpact> {
  return useAsyncResource(() => api.getDeletionImpact(kind, id), [kind, id])
}

export interface UseLibraryTrashMutationsResult {
  restore: (kind: LibraryKind, id: string) => Promise<void>
  purge: (kind: LibraryKind, id: string) => Promise<void>
  isBusy: boolean
  error: MockApiError | undefined
}

export function useLibraryTrashMutations(): UseLibraryTrashMutationsResult {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const run = useCallback(
    async (path: string, op: () => Promise<void>): Promise<void> => {
      setIsBusy(true)
      setError(undefined)
      try {
        await op()
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

  const restore = useCallback(
    (kind: LibraryKind, id: string) =>
      run(`library/${kind}/${id}/restore`, () =>
        api.restoreLibraryItem(kind, id),
      ),
    [run],
  )
  const purge = useCallback(
    (kind: LibraryKind, id: string) =>
      run(`library/${kind}/${id}/purge`, () => api.purgeLibraryItem(kind, id)),
    [run],
  )

  return { restore, purge, isBusy, error }
}
