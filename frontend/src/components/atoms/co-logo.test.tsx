import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CoLogo } from "./co-logo"

describe("CoLogo", () => {
  it("renders the first letter of the name uppercased", () => {
    render(<CoLogo name="acme" />)
    expect(screen.getByText("A")).toBeInTheDocument()
  })

  it("exposes the company name as accessible label", () => {
    render(<CoLogo name="Stripe" />)
    expect(screen.getByLabelText("Stripe")).toBeInTheDocument()
  })

  it("applies the sm class when size=sm", () => {
    const { container } = render(<CoLogo name="X" size="sm" />)
    expect(container.querySelector('[data-slot="co-logo"]')).toHaveClass(
      "co-logo--sm",
    )
  })

  it("applies the lg class when size=lg", () => {
    const { container } = render(<CoLogo name="X" size="lg" />)
    expect(container.querySelector('[data-slot="co-logo"]')).toHaveClass(
      "co-logo--lg",
    )
  })

  it("marks the accent variant via data attribute", () => {
    const { container } = render(<CoLogo name="X" accent />)
    expect(container.querySelector('[data-slot="co-logo"]')).toHaveAttribute(
      "data-accent",
      "true",
    )
  })
})
