import { afterEach, describe, expect, it, vi } from "vitest"
import { getLatencyRange, simulateLatency } from "./latency"

describe("getLatencyRange", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("defaults to 100ms–400ms when no env override is set", () => {
    vi.stubEnv("VITE_MOCK_LATENCY_MIN", "")
    vi.stubEnv("VITE_MOCK_LATENCY_MAX", "")
    expect(getLatencyRange()).toEqual([100, 400])
  })

  it("honors VITE_MOCK_LATENCY_MIN / VITE_MOCK_LATENCY_MAX overrides", () => {
    vi.stubEnv("VITE_MOCK_LATENCY_MIN", "10")
    vi.stubEnv("VITE_MOCK_LATENCY_MAX", "20")
    expect(getLatencyRange()).toEqual([10, 20])
  })

  it("ignores non-numeric overrides and falls back to the defaults", () => {
    vi.stubEnv("VITE_MOCK_LATENCY_MIN", "fast")
    vi.stubEnv("VITE_MOCK_LATENCY_MAX", "slow")
    expect(getLatencyRange()).toEqual([100, 400])
  })

  it("ignores negative overrides", () => {
    vi.stubEnv("VITE_MOCK_LATENCY_MIN", "-50")
    vi.stubEnv("VITE_MOCK_LATENCY_MAX", "-10")
    expect(getLatencyRange()).toEqual([100, 400])
  })

  it("clamps a max-below-min override to a degenerate [min, min] range", () => {
    vi.stubEnv("VITE_MOCK_LATENCY_MIN", "200")
    vi.stubEnv("VITE_MOCK_LATENCY_MAX", "50")
    expect(getLatencyRange()).toEqual([200, 200])
  })
})

describe("simulateLatency", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("never resolves before min and never after max + 50ms", async () => {
    vi.stubEnv("VITE_MOCK_LATENCY_MIN", "20")
    vi.stubEnv("VITE_MOCK_LATENCY_MAX", "40")
    const t0 = performance.now()
    await simulateLatency()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(20)
    expect(elapsed).toBeLessThanOrEqual(40 + 50)
  })
})
