import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useResume } from "./use-resume"

describe("useResume", () => {
  it("loads by name", async () => {
    const { result } = renderHookWithProviders(() =>
      useResume("Distributed-systems"),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.tag).toBe("DEFAULT")
  })

  it("loads by index", async () => {
    const { result } = renderHookWithProviders(() => useResume(0))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.name).toBe("Master")
  })

  it("surfaces notFound for unknown name", async () => {
    const { result } = renderHookWithProviders(() => useResume("unknown"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("not_found")
  })
})
