import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StageBadge } from "./stage-badge"

describe("StageBadge", () => {
  it("renders provided label", () => {
    render(<StageBadge stage="interview" label="In interview" />)
    expect(screen.getByText("In interview")).toBeInTheDocument()
  })

  it("falls back to the stage name when no label is given", () => {
    render(<StageBadge stage="applied" />)
    expect(screen.getByText("applied")).toBeInTheDocument()
  })

  it("forwards stage data attribute on the badge", () => {
    const { container } = render(<StageBadge stage="offer" />)
    const badge = container.querySelector('[data-slot="stage-badge"]')
    expect(badge).toHaveAttribute("data-stage", "offer")
  })

  it("renders a child stage dot with matching stage", () => {
    const { container } = render(<StageBadge stage="rejected" />)
    expect(container.querySelector('[data-slot="stage-dot"]')).toHaveAttribute(
      "data-stage",
      "rejected",
    )
  })

  it("passes live through to the inner dot", () => {
    const { container } = render(<StageBadge stage="screen" live />)
    expect(container.querySelector('[data-slot="stage-dot"]')).toHaveClass(
      "dot--live",
    )
  })
})
