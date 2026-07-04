import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useMatchReport } from "./use-match-report"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useMatchReport", () => {
  it("loads the canonical match report", async () => {
    const { result } = renderHookWithProviders(() =>
      useMatchReport({ resumeId: "r1", jobId: "stripe" }),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.score).toBe(92)
    expect(result.current.data?.resumeId).toBe("r1")
    expect(result.current.data?.jobId).toBe("stripe")
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "match-report:rate_limited")
    const { result } = renderHookWithProviders(() =>
      useMatchReport({ resumeId: "r1", jobId: "stripe" }),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("rate_limited")
  })
})
