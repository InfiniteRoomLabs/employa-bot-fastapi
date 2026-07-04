/**
 * Resume-lifecycle mutations (RES-034/035/037, TPL-002): create projections,
 * assign templates, render + regenerate exports. Same shape as useResumeMutations.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { Resume, ResumeExport } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseResumeLifecycleMutationsResult {
  createProjection: (input: {
    name: string
    targetRole?: string
    itemIds: readonly string[]
    templateId?: string
    sourceUploadId?: string
  }) => Promise<Resume>
  assignTemplate: (projectionId: string, templateId: string) => Promise<Resume>
  renderExport: (projectionId: string) => Promise<ResumeExport>
  regenerateExport: (exportId: string) => Promise<ResumeExport>
  isMutating: boolean
  error: MockApiError | undefined
}

export function useResumeLifecycleMutations(): UseResumeLifecycleMutationsResult {
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<MockApiError | undefined>(undefined)

  const run = useCallback(
    async <T>(thunk: () => Promise<T>, path: string): Promise<T> => {
      setIsMutating(true)
      setError(undefined)
      try {
        return await thunk()
      } catch (err) {
        const apiError =
          err instanceof MockApiError ? err : MockApiError.unknown(path, err)
        setError(apiError)
        throw apiError
      } finally {
        setIsMutating(false)
      }
    },
    [],
  )

  return {
    createProjection: useCallback(
      (input) => run(() => api.createProjection(input), "projections/create"),
      [run],
    ),
    assignTemplate: useCallback(
      (projectionId, templateId) =>
        run(
          () => api.assignTemplate(projectionId, templateId),
          "projections/:id/template",
        ),
      [run],
    ),
    renderExport: useCallback(
      (projectionId) => run(() => api.renderExport(projectionId), "exports"),
      [run],
    ),
    regenerateExport: useCallback(
      (exportId) =>
        run(() => api.regenerateExport(exportId), "exports/:id/regenerate"),
      [run],
    ),
    isMutating,
    error,
  }
}
