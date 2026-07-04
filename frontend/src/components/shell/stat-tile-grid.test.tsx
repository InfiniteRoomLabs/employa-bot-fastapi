import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatTileGrid } from "./stat-tile-grid"

describe("StatTileGrid", () => {
  it("renders all children", () => {
    render(
      <StatTileGrid>
        <div data-testid="t1">one</div>
        <div data-testid="t2">two</div>
        <div data-testid="t3">three</div>
      </StatTileGrid>,
    )
    expect(screen.getByTestId("t1")).toBeInTheDocument()
    expect(screen.getByTestId("t2")).toBeInTheDocument()
    expect(screen.getByTestId("t3")).toBeInTheDocument()
  })

  it("defaults to an auto-fit track when no columns are given", () => {
    const { container } = render(
      <StatTileGrid>
        <span>x</span>
      </StatTileGrid>,
    )
    const grid = container.querySelector(
      '[data-slot="stat-tile-grid"]',
    ) as HTMLElement
    expect(grid).toHaveAttribute("data-columns", "auto-fit")
    expect(grid.style.gridTemplateColumns).toContain("auto-fit")
  })

  it("honours a fixed column count", () => {
    const { container } = render(
      <StatTileGrid columns={5}>
        <span>x</span>
      </StatTileGrid>,
    )
    const grid = container.querySelector(
      '[data-slot="stat-tile-grid"]',
    ) as HTMLElement
    expect(grid).toHaveAttribute("data-columns", "5")
    expect(grid.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))")
  })

  it("forwards an extra className", () => {
    const { container } = render(
      <StatTileGrid className="custom-grid">
        <span>x</span>
      </StatTileGrid>,
    )
    expect(container.querySelector('[data-slot="stat-tile-grid"]')).toHaveClass(
      "custom-grid",
    )
  })
})
