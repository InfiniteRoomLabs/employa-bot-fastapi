import { describe, expect, it } from "vitest"

import { formatRelativeTime, humanizeTimeLabel } from "./relative-time"

describe("formatRelativeTime", () => {
  // Fixed reference date so the absolute-fallback branch is deterministic.
  const now = new Date(2026, 2, 15) // Mar 15 2026

  it("spells out the recent-week phrases", () => {
    expect(formatRelativeTime(0, now)).toBe("Today")
    expect(formatRelativeTime(1, now)).toBe("Yesterday")
    expect(formatRelativeTime(3, now)).toBe("3 days ago")
    expect(formatRelativeTime(6, now)).toBe("6 days ago")
  })

  it("falls back to an absolute short date past a week", () => {
    expect(formatRelativeTime(7, now)).toBe("Mar 8")
    expect(formatRelativeTime(20, now)).toBe("Feb 23")
  })

  it("returns empty for invalid input", () => {
    expect(formatRelativeTime(-1, now)).toBe("")
    expect(formatRelativeTime(NaN, now)).toBe("")
  })
})

describe("humanizeTimeLabel", () => {
  it("normalizes legacy shorthand", () => {
    expect(humanizeTimeLabel("yday")).toBe("Yesterday")
    expect(humanizeTimeLabel("yday 18:43")).toBe("Yesterday 18:43")
    expect(humanizeTimeLabel("2d ago")).toBe("2 days ago")
    expect(humanizeTimeLabel("1d")).toBe("Yesterday")
  })

  it("leaves already-human or sub-day labels untouched", () => {
    expect(humanizeTimeLabel("just now")).toBe("just now")
    expect(humanizeTimeLabel("1h")).toBe("1h")
    expect(humanizeTimeLabel("Mar 1")).toBe("Mar 1")
  })
})
