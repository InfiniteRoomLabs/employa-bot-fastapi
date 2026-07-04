import { describe, expect, it } from "vitest"
import { isAboveTier, tierRank, tiersAbove } from "./trust-tier"

describe("trust-tier ordering", () => {
  it("ranks tiers low to high", () => {
    expect(tierRank("observe")).toBeLessThan(tierRank("suggest"))
    expect(tierRank("suggest")).toBeLessThan(tierRank("act-with-approval"))
    expect(tierRank("act-with-approval")).toBeLessThan(tierRank("autonomous"))
  })

  it("detects above-tier grants and ignores in-tier/below-tier", () => {
    expect(isAboveTier("autonomous", "suggest")).toBe(true) // above -> soft-gate
    expect(isAboveTier("observe", "suggest")).toBe(false) // below
    expect(isAboveTier("suggest", "suggest")).toBe(false) // in-tier
  })

  it("lists only the tiers above the current one", () => {
    expect(tiersAbove("act-with-approval")).toEqual(["autonomous"])
    expect(tiersAbove("autonomous")).toEqual([])
    expect(tiersAbove("observe")).toEqual([
      "suggest",
      "act-with-approval",
      "autonomous",
    ])
  })
})
