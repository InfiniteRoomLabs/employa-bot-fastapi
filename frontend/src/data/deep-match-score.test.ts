import { describe, expect, it } from "vitest"

import { previewDeepMatchScore, runDeepMatchScore } from "./api"

// D8 / D8b / D9a -- the paid match-score "money path".
describe("deep match score", () => {
  it("previews an itemized cost line per resume, under cap", async () => {
    const preview = await previewDeepMatchScore("stripe-staff-engineer", [
      "Master A",
      "Master B",
    ])
    expect(preview.items).toHaveLength(2)
    expect(preview.totalUsd).toBeCloseTo(0.28, 2)
    expect(preview.capRemainingUsd).toBeGreaterThan(preview.totalUsd)
    expect(preview.overCap).toBe(false)
  })

  it("flags overCap when the total exceeds remaining headroom", async () => {
    // 200 resumes * $0.14 = $28 > the ~$16.58 remaining cap.
    const many = Array.from({ length: 200 }, (_, i) => `Master ${i}`)
    const preview = await previewDeepMatchScore("stripe-staff-engineer", many)
    expect(preview.overCap).toBe(true)
  })

  it("runs a deep score and reports a positive cost + deep kind", async () => {
    const result = await runDeepMatchScore("stripe-staff-engineer", "Master A")
    expect(result.kind).toBe("deep")
    expect(result.costUsd).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(0)
  })
})
