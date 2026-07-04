import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useCurrentUser } from "./use-current-user"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useCurrentUser", () => {
  it("loads the REMY fixture", async () => {
    const { result } = renderHookWithProviders(() => useCurrentUser())
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.name).toBe("Wes Gilleland")
    expect(result.current.error).toBeUndefined()
  })

  it("surfaces MockApiError when injection is configured", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "user:unauthorized")
    const { result } = renderHookWithProviders(() => useCurrentUser())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("unauthorized")
  })
})
