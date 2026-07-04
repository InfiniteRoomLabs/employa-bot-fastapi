import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useExtensionState } from "./use-extension-state"

describe("useExtensionState", () => {
  it("loads the detected state", async () => {
    const { result } = renderHookWithProviders(() =>
      useExtensionState("detected"),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.state).toBe("detected")
  })

  it("loads the empty state with recent captures", async () => {
    const { result } = renderHookWithProviders(() => useExtensionState("empty"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.recentCaptures.length).toBeGreaterThan(0)
  })
})
