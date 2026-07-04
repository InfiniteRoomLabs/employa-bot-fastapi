import { waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { SEARCH_ID_PLATFORM } from "@/data/fixtures"
import { renderHookWithProviders } from "../test/render-hook-helpers"
import { useSearch } from "./use-search"

describe("useSearch", () => {
  it("loads by id", async () => {
    const { result } = renderHookWithProviders(() =>
      useSearch(SEARCH_ID_PLATFORM),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.name).toBe(
      "Staff / Principal - Platform - remote",
    )
  })

  it("surfaces notFound for unknown id", async () => {
    const { result } = renderHookWithProviders(() =>
      useSearch("not-a-real-uuid"),
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.kind).toBe("not_found")
  })
})
