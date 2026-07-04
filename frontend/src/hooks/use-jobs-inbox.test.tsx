import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useJobsInbox } from "./use-jobs-inbox"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useJobsInbox", () => {
  it("loads the inbox", async () => {
    const { result } = renderHookWithProviders(() => useJobsInbox())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(7)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "jobs/inbox:unauthorized")
    const { result } = renderHookWithProviders(() => useJobsInbox())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("unauthorized")
  })
})
