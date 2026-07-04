import { afterEach, describe, expect, it } from "vitest"

import { __resetForTests, getInterviewRounds, patchInterviewRound } from "./api"

afterEach(() => __resetForTests())

// D3 / TRK-127 -- interview records editable across an allowlist.
describe("patchInterviewRound", () => {
  it("updates allowlisted fields and persists", async () => {
    const updated = await patchInterviewRound("stripe", "ir-stripe-1", {
      status: "cancelled",
      format: "video",
    })
    expect(updated.status).toBe("cancelled")
    expect(updated.format).toBe("video")

    const rounds = await getInterviewRounds("stripe")
    expect(rounds.find((round) => round.id === "ir-stripe-1")?.status).toBe(
      "cancelled",
    )
  })

  it("404s for an unknown round", async () => {
    await expect(
      patchInterviewRound("stripe", "no-such-round", { status: "completed" }),
    ).rejects.toMatchObject({ kind: "not_found" })
  })
})
