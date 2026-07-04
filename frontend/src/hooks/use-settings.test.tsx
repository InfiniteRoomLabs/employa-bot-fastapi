import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useSettings } from "./use-settings"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useSettings", () => {
  it("loads the settings bundle", async () => {
    const { result } = renderHookWithProviders(() => useSettings())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.profile.name).toBe("Wes Gilleland")
    expect(result.current.data?.providers.length).toBeGreaterThan(0)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "settings:unauthorized")
    const { result } = renderHookWithProviders(() => useSettings())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("unauthorized")
  })
})
