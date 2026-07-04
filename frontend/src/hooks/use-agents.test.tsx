import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useAgents } from "./use-agents"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useAgents", () => {
  it("loads the agents list", async () => {
    const { result } = renderHookWithProviders(() => useAgents())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(3)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "agents:network")
    const { result } = renderHookWithProviders(() => useAgents())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("network")
  })
})
