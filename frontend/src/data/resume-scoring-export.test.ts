import { afterEach, describe, expect, it } from "vitest"

import {
  __resetForTests,
  getResumeExports,
  getResumes,
  patchResumeScoring,
  regenerateExport,
} from "./api"

afterEach(() => __resetForTests())

describe("D21 per-master scoring", () => {
  it("toggles scoringEnabled on a resume", async () => {
    const resumes = await getResumes()
    const master = resumes.find((r) => r.tag === "MASTER") ?? resumes[0]
    const updated = await patchResumeScoring(master.id, false)
    expect(updated.scoringEnabled).toBe(false)
  })
})

describe("D17 export provenance", () => {
  it("regenerate creates a NEW export and preserves the original", async () => {
    const before = await getResumeExports()
    // Capture as primitives -- getResumeExports returns the live array reference.
    const beforeLen = before.length
    const originalId = before[0].id

    const created = await regenerateExport(originalId)
    expect(created.id).not.toBe(originalId)
    expect(created.templateVersion).toBe("v2")

    const after = await getResumeExports()
    expect(after.length).toBe(beforeLen + 1)
    // The original export keeps its own version -- never silently restyled.
    expect(after.find((e) => e.id === originalId)?.templateVersion).toBe("v1")
  })
})
