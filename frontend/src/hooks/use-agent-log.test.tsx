import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useAgentLog } from "./use-agent-log"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useAgentLog", () => {
  it("loads the full log without a filter", async () => {
    const { result } = renderHookWithProviders(() => useAgentLog())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.length).toBeGreaterThan(0)
  })

  it("applies an agentId filter", async () => {
    const filter = { agentId: "stale" as const }
    const { result } = renderHookWithProviders(() => useAgentLog(filter))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.every((e) => e.agentId === "stale")).toBe(true)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "agents/log:rate_limited")
    const { result } = renderHookWithProviders(() => useAgentLog())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("rate_limited")
  })
})
