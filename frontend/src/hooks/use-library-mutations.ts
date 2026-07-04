/**
 * CRUD mutations for the bounded Library artifacts (Contacts, Accomplishments,
 * Answers, Projects). Mirrors `useResumeMutations`: one stable callback per op,
 * a shared busy flag + error state, throws so callers can await + toast.
 * Call the matching read hook's `refetch()` after a mutation to refresh the list.
 */

import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { Accomplishment, Answer, Contact, Project } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"

export interface UseLibraryMutationsResult {
  createContact: (draft: api.ContactDraft) => Promise<Contact>
  updateContact: (
    id: string,
    patch: Partial<api.ContactDraft>,
  ) => Promise<Contact>
  deleteContact: (id: string) => Promise<void>
  createAccomplishment: (
    draft: api.AccomplishmentDraft,
  ) => Promise<Accomplishment>
  updateAccomplishment: (
    id: string,
    patch: Partial<api.AccomplishmentDraft>,
  ) => Promise<Accomplishment>
  deleteAccomplishment: (id: string) => Promise<void>
  deriveAccomplishmentFromProject: (
    projectId: string,
  ) => Promise<Accomplishment>
  createAnswer: (draft: api.AnswerDraft) => Promise<Answer>
  updateAnswer: (id: string, patch: Partial<api.AnswerDraft>) => Promise<Answer>
  deleteAnswer: (id: string) => Promise<void>
  createProject: (draft: api.ProjectDraft) => Promise<Project>
  updateProject: (
    id: string,
    patch: Partial<api.ProjectDraft>,
  ) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  isMutating: boolean
  error: MockApiError | undefined
}

export function useLibraryMutations(): UseLibraryMutationsResult {
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
    createContact: useCallback(
      (d) => run(() => api.createContact(d), "contacts/create"),
      [run],
    ),
    updateContact: useCallback(
      (id, p) => run(() => api.updateContact(id, p), "contacts/:id/update"),
      [run],
    ),
    deleteContact: useCallback(
      (id) => run(() => api.deleteContact(id), "contacts/:id/delete"),
      [run],
    ),
    createAccomplishment: useCallback(
      (d) => run(() => api.createAccomplishment(d), "accomplishments/create"),
      [run],
    ),
    updateAccomplishment: useCallback(
      (id, p) =>
        run(
          () => api.updateAccomplishment(id, p),
          "accomplishments/:id/update",
        ),
      [run],
    ),
    deleteAccomplishment: useCallback(
      (id) =>
        run(() => api.deleteAccomplishment(id), "accomplishments/:id/delete"),
      [run],
    ),
    deriveAccomplishmentFromProject: useCallback(
      (projectId) =>
        run(
          () => api.deriveAccomplishmentFromProject(projectId),
          "accomplishments/derive-from-project",
        ),
      [run],
    ),
    createAnswer: useCallback(
      (d) => run(() => api.createAnswer(d), "answers/create"),
      [run],
    ),
    updateAnswer: useCallback(
      (id, p) => run(() => api.updateAnswer(id, p), "answers/:id/update"),
      [run],
    ),
    deleteAnswer: useCallback(
      (id) => run(() => api.deleteAnswer(id), "answers/:id/delete"),
      [run],
    ),
    createProject: useCallback(
      (d) => run(() => api.createProject(d), "projects/create"),
      [run],
    ),
    updateProject: useCallback(
      (id, p) => run(() => api.updateProject(id, p), "projects/:id/update"),
      [run],
    ),
    deleteProject: useCallback(
      (id) => run(() => api.deleteProject(id), "projects/:id/delete"),
      [run],
    ),
    isMutating,
    error,
  }
}
