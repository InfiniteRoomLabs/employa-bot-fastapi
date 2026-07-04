import { act, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderHookWithProviders } from "../test/render-hook-helpers"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { MockApiError } from "../lib/mock-api-error"
import { useAsyncResource } from "./_use-async-resource"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useAsyncResource", () => {
  it("starts in loading, resolves to data, and clears error", async () => {
    const load = vi.fn(() => Promise.resolve(42))
    const { result } = renderHookWithProviders(() => useAsyncResource(load, []))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(result.current.error).toBeUndefined()
  })

  it("surfaces MockApiError on rejection", async () => {
    const load = vi.fn(() => Promise.reject(MockApiError.rateLimited("foo")))
    const { result } = renderHookWithProviders(() => useAsyncResource(load, []))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeInstanceOf(MockApiError)
    expect(result.current.error?.kind).toBe("rate_limited")
  })

  it("wraps non-MockApiError rejections as unknown", async () => {
    const load = vi.fn(() => Promise.reject(new Error("boom")))
    const { result } = renderHookWithProviders(() => useAsyncResource(load, []))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("unknown")
  })

  it("refetch() re-invokes the loader", async () => {
    let counter = 0
    const load = vi.fn(() => Promise.resolve(++counter))
    const { result } = renderHookWithProviders(() => useAsyncResource(load, []))
    await waitFor(() => expect(result.current.data).toBe(1))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.data).toBe(2))
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("re-loads when a dep changes", async () => {
    const load = vi.fn((id: string) => Promise.resolve(id))
    const { result, rerender } = renderHookWithProviders(
      ({ id }: { id: string }) => useAsyncResource(() => load(id), [id]),
      { initialProps: { id: "a" } },
    )
    await waitFor(() => expect(result.current.data).toBe("a"))
    rerender({ id: "b" })
    await waitFor(() => expect(result.current.data).toBe("b"))
    expect(load).toHaveBeenCalledTimes(2)
  })
})
