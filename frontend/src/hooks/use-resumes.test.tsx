import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useResumes } from "./use-resumes"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useResumes", () => {
  it("loads the resume list", async () => {
    const { result } = renderHookWithProviders(() => useResumes())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.[0]?.tag).toBe("MASTER")
  })

  it("surfaces MockApiError on env failure injection", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "resumes:unknown")
    const { result } = renderHookWithProviders(() => useResumes())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("unknown")
  })
})
