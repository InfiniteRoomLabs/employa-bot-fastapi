import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { MatchRubricRow as MatchRubricRowType } from "@/data/types"

import { MatchRubricRow } from "./match-rubric-row"

const FIXTURE: MatchRubricRowType = {
  label: "Skills fit",
  score: 90,
  note: "8 of 9 required skills present",
}

describe("MatchRubricRow", () => {
  it("renders criterion label, score, and note", () => {
    render(<MatchRubricRow row={FIXTURE} />)
    expect(screen.getByText("Skills fit")).toBeInTheDocument()
    expect(screen.getByText("90")).toBeInTheDocument()
    expect(
      screen.getByText("8 of 9 required skills present"),
    ).toBeInTheDocument()
  })

  it("omits the note when compact", () => {
    render(<MatchRubricRow row={FIXTURE} compact />)
    expect(
      screen.queryByText("8 of 9 required skills present"),
    ).not.toBeInTheDocument()
  })

  it("sets bar width to the score percentage", () => {
    const { container } = render(<MatchRubricRow row={FIXTURE} />)
    const bar = container.querySelector(
      '[data-slot="match-rubric-row-bar"]',
    ) as HTMLElement
    expect(bar.style.width).toBe("90%")
  })

  it("uses accent fill for high scores (>= 80)", () => {
    const { container } = render(<MatchRubricRow row={FIXTURE} />)
    const bar = container.querySelector(
      '[data-slot="match-rubric-row-bar"]',
    ) as HTMLElement
    expect(bar.style.background).toContain("--accent")
  })

  it("uses amber fill for mid scores (>= 65)", () => {
    const { container } = render(
      <MatchRubricRow row={{ ...FIXTURE, score: 70 }} />,
    )
    const bar = container.querySelector(
      '[data-slot="match-rubric-row-bar"]',
    ) as HTMLElement
    expect(bar.style.background).toContain("--amber-400")
  })

  it("uses red fill for low scores (< 65)", () => {
    const { container } = render(
      <MatchRubricRow row={{ ...FIXTURE, score: 50 }} />,
    )
    const bar = container.querySelector(
      '[data-slot="match-rubric-row-bar"]',
    ) as HTMLElement
    expect(bar.style.background).toContain("--red-400")
  })
})
