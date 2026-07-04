import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useCoachThread } from "./use-coach-thread"

describe("useCoachThread", () => {
  it("loads the active thread bundle", async () => {
    const { result } = renderHookWithProviders(() =>
      useCoachThread("stripe-followup"),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.thread.id).toBe("stripe-followup")
    expect(result.current.data?.messages.length).toBeGreaterThan(0)
  })

  it("returns notFound for an unknown id", async () => {
    const { result } = renderHookWithProviders(() => useCoachThread("mystery"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("not_found")
  })
})
