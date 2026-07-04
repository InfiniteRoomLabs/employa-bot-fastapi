import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useShortlist } from "./use-shortlist"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useShortlist", () => {
  it("loads the shortlist (without a searchId)", async () => {
    const { result } = renderHookWithProviders(() => useShortlist())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.length).toBeGreaterThan(0)
  })

  it("accepts a searchId and currently returns the same canonical list", async () => {
    const { result } = renderHookWithProviders(() =>
      useShortlist("any-search-id"),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.length).toBeGreaterThan(0)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "shortlist:network")
    const { result } = renderHookWithProviders(() => useShortlist())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("network")
  })
})
