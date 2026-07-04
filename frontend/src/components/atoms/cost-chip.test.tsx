import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CostChip } from "./cost-chip"

describe("CostChip", () => {
  it("renders the amount in bold", () => {
    const { container } = render(<CostChip amount="$1.42" />)
    const bold = container.querySelector('[data-slot="cost-chip"] b')
    expect(bold).not.toBeNull()
    expect(bold?.textContent).toBe("$1.42")
  })

  it("uses the default label when none is provided", () => {
    render(<CostChip amount="$0.10" />)
    expect(screen.getByText(/cost/)).toBeInTheDocument()
  })

  it("renders the provided label", () => {
    render(<CostChip amount="$9.99" label="today" />)
    expect(screen.getByText(/today/)).toBeInTheDocument()
  })

  it("honors caller className over base styles", () => {
    const { container } = render(
      <CostChip amount="$1.00" className="custom-test-class" />,
    )
    expect(container.querySelector('[data-slot="cost-chip"]')).toHaveClass(
      "custom-test-class",
    )
  })
})
