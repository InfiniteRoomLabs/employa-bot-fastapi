import { useCallback, useState } from "react"
import * as api from "../data/api"
import type { Notification } from "../data/types"
import { MockApiError } from "../lib/mock-api-error"
import { type HookState, useAsyncResource } from "./_use-async-resource"

export interface UseNotificationsResult
  extends HookState<readonly Notification[]> {
  markAllRead: () => Promise<void>
  markRead: (id: string) => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const base = useAsyncResource(() => api.getNotifications(), [])
  const [localData, setLocalData] = useState<
    readonly Notification[] | undefined
  >(undefined)

  // Resolved data is either the local optimistic state (after a mutation) or
  // the fetched data. We shadow the hook's data with localData when present.
  const effectiveData = localData ?? base.data

  const markAllRead = useCallback(async () => {
    try {
      const updated = await api.markAllNotificationsRead()
      setLocalData(updated)
    } catch (err) {
      // Surface to caller -- they handle toast
      if (err instanceof MockApiError) {
        throw err
      }
      throw MockApiError.unknown("notifications/mark-all-read", err)
    }
  }, [])

  const markRead = useCallback(
    async (id: string) => {
      try {
        const updated = await api.markNotificationRead(id)
        setLocalData((prev) => {
          const source = prev ?? base.data ?? []
          return source.map((notification) =>
            notification.id === id ? updated : notification,
          )
        })
      } catch (err) {
        if (err instanceof MockApiError) {
          throw err
        }
        throw MockApiError.unknown(`notifications/${id}/read`, err)
      }
    },
    [base.data],
  )

  return {
    data: effectiveData,
    error: base.error,
    isLoading: base.isLoading,
    refetch: () => {
      setLocalData(undefined)
      base.refetch()
    },
    markAllRead,
    markRead,
  }
}
