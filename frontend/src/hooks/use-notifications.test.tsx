import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useNotifications } from "./use-notifications"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useNotifications", () => {
  it("loads the notifications list", async () => {
    const { result } = renderHookWithProviders(() => useNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.length).toBeGreaterThan(0)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "notifications:network")
    const { result } = renderHookWithProviders(() => useNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("network")
  })
})
