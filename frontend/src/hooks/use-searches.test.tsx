import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useSearches } from "./use-searches"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useSearches", () => {
  it("loads the saved-searches list (3 sidebar entries)", async () => {
    const { result } = renderHookWithProviders(() => useSearches())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(3)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "searches:rate_limited")
    const { result } = renderHookWithProviders(() => useSearches())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("rate_limited")
  })
})
