/**
 * Internal — the uniform async-resource hook every public hook in `src/hooks/`
 * delegates to. Not exported from `src/hooks/index.ts`; consumers must use the
 * per-resource hooks (`useApplications`, `useAgent`, ...) so the swap-seam
 * surface stays small.
 */

import { useCallback, useEffect, useState } from "react"
import { MockApiError } from "../lib/mock-api-error"

export interface HookState<T> {
  data: T | undefined
  error: MockApiError | undefined
  isLoading: boolean
  refetch: () => void
}

/**
 * Drives a `() => Promise<T>` thunk and exposes the uniform `HookState<T>`.
 * Stale results from a previous `deps` are dropped via a `mounted` ref flag
 * (there's no real fetch to abort — this is a mock).
 *
 * `deps` controls when a new fetch is kicked off, the same way React's own
 * dependency arrays do. Callers passing mutable filter objects should
 * memoize them upstream.
 *
 * `enabled` (default true) gates the fetch: a disabled hook still obeys the
 * rules of hooks (always called) but never fires its thunk, so a screen that
 * picks between two data sources can call both hooks and only pay for the one
 * it uses. A disabled hook reports `isLoading: false` with no data/error.
 *
 * Implementation notes:
 *   - `setIsLoading(true)` at the top of the effect is deliberate — when a
 *     dep changes we want consumers to observe loading immediately. The
 *     react-hooks/set-state-in-effect rule is suppressed for that one call
 *     because resetting fetch state on dep change is the entire job of this
 *     helper.
 */
export function useAsyncResource<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  enabled = true,
): HookState<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<MockApiError | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(enabled)
  const [refetchTick, setRefetchTick] = useState(0)

  const refetch = useCallback(() => {
    setRefetchTick((tick) => tick + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false)
      return
    }
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    setError(undefined)
    load().then(
      (value) => {
        if (!mounted) {
          return
        }
        setData(value)
        setIsLoading(false)
      },
      (raw: unknown) => {
        if (!mounted) {
          return
        }
        const err =
          raw instanceof MockApiError ? raw : MockApiError.unknown("hook", raw)
        setError(err)
        setIsLoading(false)
      },
    )
    return () => {
      mounted = false
    }
    // `load` is captured every render — we re-run only when deps change. The
    // rule cannot see through the variadic deps spread, so it's disabled
    // here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchTick, enabled])

  return { data, error, isLoading, refetch }
}
