import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useAgent } from "./use-agent"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useAgent", () => {
  it("loads by id", async () => {
    const { result } = renderHookWithProviders(() => useAgent("stale"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.name).toBe("Stale-detector")
  })

  it("surfaces notFound for unknown id", async () => {
    const { result } = renderHookWithProviders(() => useAgent("mystery"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("not_found")
  })
})
