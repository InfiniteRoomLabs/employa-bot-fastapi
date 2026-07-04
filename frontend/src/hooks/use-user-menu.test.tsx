import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useUserMenu } from "./use-user-menu"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useUserMenu", () => {
  it("loads the user menu rows", async () => {
    const { result } = renderHookWithProviders(() => useUserMenu())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.length).toBeGreaterThan(0)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "user-menu:network")
    const { result } = renderHookWithProviders(() => useUserMenu())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("network")
  })
})
