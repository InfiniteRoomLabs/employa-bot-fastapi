import { afterEach, describe, expect, it } from "vitest"

import {
  __resetForTests,
  dismissApplication,
  getArchive,
  markWon,
  reactivateApplication,
  undoMarkWon,
} from "./api"

afterEach(() => __resetForTests())

// D12 / D18 / D19 -- application lifecycle transitions.
describe("application lifecycle", () => {
  it("marks won and undoes within the grace window", async () => {
    const result = await markWon("stripe", { whatWorked: "Inbound referral" })
    expect(result.application.outcome).toBe("won")
    expect(result.undoToken).toBeTruthy()
    expect(result.undoWindowSeconds).toBeGreaterThan(0)

    const restored = await undoMarkWon("stripe", result.undoToken)
    expect(restored.outcome).toBeUndefined()
  })

  it("dismiss removes a pre-applied app but withdraws a post-applied one", async () => {
    // 'modal' is DRAFT -> removed outright (posting-level dismiss).
    const draft = await dismissApplication("modal")
    expect(draft.outcome).toBe("removed")

    // 'stripe' is APPLIED -> WITHDREW with a reason, lands in the archive.
    const applied = await dismissApplication("stripe", ["Compensation too low"])
    expect(applied.outcome).toBe("withdrew")

    const passed = await getArchive("passed")
    expect(
      passed.some((app) => app.outcomeReason === "Compensation too low"),
    ).toBe(true)
  })

  it("reactivates a closed application back to APPLIED", async () => {
    await dismissApplication("stripe", ["Changed my mind"]) // -> archive (withdrew)
    const revived = await reactivateApplication("stripe")
    expect(revived.outcome).toBeUndefined()
    expect(revived.stage).toBe("applied")
    expect(revived.resurrected).toBe(true)
  })
})
