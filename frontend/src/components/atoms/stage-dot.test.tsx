import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StageDot } from "./stage-dot"

describe("StageDot", () => {
  it("renders with the stage class", () => {
    const { container } = render(<StageDot stage="applied" />)
    const dot = container.querySelector('[data-slot="stage-dot"]')
    expect(dot).not.toBeNull()
    expect(dot).toHaveClass("dot", "dot--applied")
  })

  it("applies the live pulse class when live", () => {
    const { container } = render(<StageDot stage="screen" live />)
    expect(container.querySelector('[data-slot="stage-dot"]')).toHaveClass(
      "dot--live",
    )
  })

  it("omits live class by default", () => {
    const { container } = render(<StageDot stage="offer" />)
    expect(container.querySelector('[data-slot="stage-dot"]')).not.toHaveClass(
      "dot--live",
    )
  })

  it("supports stage-adjacent variants", () => {
    const { container } = render(<StageDot stage="stale" />)
    expect(container.querySelector('[data-slot="stage-dot"]')).toHaveClass(
      "dot--stale",
    )
  })

  it("honors caller className over base styles", () => {
    const { container } = render(
      <StageDot stage="draft" className="custom-test-class" />,
    )
    expect(container.querySelector('[data-slot="stage-dot"]')).toHaveClass(
      "custom-test-class",
    )
  })
})
