import { describe, expect, it } from "vitest"

import { getResumeSnapshot } from "./api"

// D10 -- the immutable submitted-resume snapshot.
describe("getResumeSnapshot", () => {
  it("returns a locked snapshot for an applied application", async () => {
    const snap = await getResumeSnapshot("stripe") // seed stage = applied
    expect(snap.applicationId).toBe("stripe")
    expect(snap.name.length).toBeGreaterThan(0)
    expect(snap.templateVersion.length).toBeGreaterThan(0)
  })

  it("refuses (conflict) before the application reaches APPLIED", async () => {
    // seed 'modal' is in stage 'draft' -- no submitted copy exists yet.
    await expect(getResumeSnapshot("modal")).rejects.toMatchObject({
      kind: "conflict",
    })
  })

  it("404s for an unknown application", async () => {
    await expect(getResumeSnapshot("does-not-exist")).rejects.toMatchObject({
      kind: "not_found",
    })
  })
})
