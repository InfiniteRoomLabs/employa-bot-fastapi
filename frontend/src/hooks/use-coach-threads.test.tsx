import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useCoachThreads } from "./use-coach-threads"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useCoachThreads", () => {
  it("loads the threads list", async () => {
    const { result } = renderHookWithProviders(() => useCoachThreads())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(5)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "coach/threads:unauthorized")
    const { result } = renderHookWithProviders(() => useCoachThreads())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("unauthorized")
  })
})
