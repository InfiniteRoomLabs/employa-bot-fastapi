import { waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useApplication } from "./use-application"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("useApplication", () => {
  it("loads by id", async () => {
    const { result } = renderHookWithProviders(() => useApplication("vercel"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.company).toBe("Vercel")
  })

  it("surfaces notFound for unknown id", async () => {
    const { result } = renderHookWithProviders(() => useApplication("mystery"))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("not_found")
  })

  it("refetches when id changes", async () => {
    const { result, rerender } = renderHookWithProviders(
      ({ id }: { id: string }) => useApplication(id),
      { initialProps: { id: "stripe" } },
    )
    await waitFor(() => expect(result.current.data?.company).toBe("Stripe"))
    rerender({ id: "linear" })
    await waitFor(() => expect(result.current.data?.company).toBe("Linear"))
  })
})
