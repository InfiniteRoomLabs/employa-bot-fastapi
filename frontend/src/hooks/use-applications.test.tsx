import { act, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useApplications } from "./use-applications"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useApplications", () => {
  it("loads the APPS list", async () => {
    const { result } = renderHookWithProviders(() => useApplications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(14)
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "applications:rate_limited")
    const { result } = renderHookWithProviders(() => useApplications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("rate_limited")
  })

  it("refetch() re-triggers the load", async () => {
    const { result } = renderHookWithProviders(() => useApplications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.refetch())
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toHaveLength(14)
  })
})
