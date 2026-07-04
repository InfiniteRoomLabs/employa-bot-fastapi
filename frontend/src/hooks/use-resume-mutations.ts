/**
 * Resume CRUD mutations (RES-019, RES-020, CUR-020).
 *
 * Returns one stable callback per operation. Each callback:
 *   - sets its own busy flag
 *   - surfaces errors via `error` state
 *   - throws so callers can await + show toasts
 *
 * The read side (list, detail) stays in `useResumes` / `useResumeById`.
 * Call `useResumes().refetch()` after any mutation to refresh the list.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { Resume } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseResumeMutationsResult {
  /** Create a new blank DRAFT resume. */
  createResume: () => Promise<Resume>
  /** Rename a resume by its stable id. */
  renameResume: (id: string, name: string) => Promise<Resume>
  /** Persist a resume's edited body (serialized HTML) -- RES-022. */
  saveResumeBody: (id: string, body: string) => Promise<Resume>
  /** Duplicate a resume; returns the new copy. */
  duplicateResume: (id: string) => Promise<Resume>
  /** Set a resume as the DEFAULT; returns the updated full list. */
  setDefaultResume: (id: string) => Promise<readonly Resume[]>
  /**
   * Delete a resume. Throws MockApiError (kind='unknown', message='locked')
   * when the resume is TAILORED / MASTER / DEFAULT or has usedIn > 0.
   */
  deleteResume: (id: string) => Promise<void>
  /**
   * Fork a resume as a tailored DRAFT for a specific job (CUR-020).
   * Returns the new forked Resume.
   */
  forkResumeAsDraft: (basisId: string, jobId: string) => Promise<Resume>
  /** True while any mutation is in-flight. */
  isMutating: boolean
  /** Last error from any mutation, cleared on the next call. */
  error: MockApiError | undefined
}

export function useResumeMutations(): UseResumeMutationsResult {
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

  const createResume = useCallback(
    () => run(() => api.createResume(), "resumes/create"),
    [run],
  )

  const renameResume = useCallback(
    (id: string, name: string) =>
      run(() => api.renameResume(id, name), "resumes/:id/rename"),
    [run],
  )

  const saveResumeBody = useCallback(
    (id: string, body: string) =>
      run(() => api.saveResumeBody(id, body), "resumes/:id/save"),
    [run],
  )

  const duplicateResume = useCallback(
    (id: string) => run(() => api.duplicateResume(id), "resumes/:id/duplicate"),
    [run],
  )

  const setDefaultResume = useCallback(
    (id: string) =>
      run(() => api.setDefaultResume(id), "resumes/:id/set-default"),
    [run],
  )

  const deleteResume = useCallback(
    (id: string) => run(() => api.deleteResume(id), "resumes/:id/delete"),
    [run],
  )

  const forkResumeAsDraft = useCallback(
    (basisId: string, jobId: string) =>
      run(() => api.forkResumeAsDraft(basisId, jobId), "resumes/:id/fork"),
    [run],
  )

  return {
    createResume,
    renameResume,
    saveResumeBody,
    duplicateResume,
    setDefaultResume,
    deleteResume,
    forkResumeAsDraft,
    isMutating,
    error,
  }
}
