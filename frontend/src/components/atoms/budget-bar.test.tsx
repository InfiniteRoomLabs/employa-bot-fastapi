import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BudgetBar } from "./budget-bar"

describe("BudgetBar", () => {
  it("renders label and readout", () => {
    render(<BudgetBar label="Budget" used={3} total={10} />)
    expect(screen.getByText("Budget")).toBeInTheDocument()
    expect(screen.getByText("3 / 10")).toBeInTheDocument()
  })

  it("marks the ok stage by default", () => {
    const { container } = render(<BudgetBar used={3} total={10} />)
    expect(container.querySelector('[data-slot="budget-bar"]')).toHaveAttribute(
      "data-stage",
      "ok",
    )
  })

  it("switches to warn at >=70%", () => {
    const { container } = render(<BudgetBar used={7} total={10} />)
    expect(container.querySelector('[data-slot="budget-bar"]')).toHaveAttribute(
      "data-stage",
      "warn",
    )
    expect(container.querySelector(".budget__bar > i")).toHaveClass("warn")
  })

  it("switches to over at >=100%", () => {
    const { container } = render(<BudgetBar used={10} total={10} />)
    expect(container.querySelector('[data-slot="budget-bar"]')).toHaveAttribute(
      "data-stage",
      "over",
    )
    expect(container.querySelector(".budget__bar > i")).toHaveClass("over")
  })

  it("clamps the bar fill at 100% when over budget", () => {
    const { container } = render(<BudgetBar used={50} total={10} />)
    const indicator = container.querySelector(
      ".budget__bar > i",
    ) as HTMLElement | null
    expect(indicator).not.toBeNull()
    expect(indicator!.style.width).toBe("100%")
  })

  it("formats the readout via the format prop", () => {
    render(
      <BudgetBar
        used={150}
        total={1000}
        format={(n) => `$${(n / 100).toFixed(2)}`}
      />,
    )
    expect(screen.getByText("$1.50 / $10.00")).toBeInTheDocument()
  })
})
