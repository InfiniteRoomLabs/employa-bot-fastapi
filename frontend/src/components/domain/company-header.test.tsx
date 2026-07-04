import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CompanyHeader } from "./company-header"

describe("CompanyHeader", () => {
  it("renders the name as a heading", () => {
    render(<CompanyHeader name="Stripe" />)
    expect(screen.getByRole("heading", { name: "Stripe" })).toBeInTheDocument()
  })

  it("renders role, location, and salary", () => {
    render(
      <CompanyHeader
        name="Stripe"
        role="Staff Engineer, Payments core"
        loc="Remote - US"
        salary="$255-305k"
      />,
    )
    expect(
      screen.getByText(/Staff Engineer, Payments core/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Remote - US/)).toBeInTheDocument()
    expect(screen.getByText("$255-305k")).toBeInTheDocument()
  })

  it("renders a MatchPill when match is provided", () => {
    render(<CompanyHeader name="Stripe" match={92} />)
    expect(screen.getByText("92")).toBeInTheDocument()
  })

  it("omits the MatchPill when match is undefined", () => {
    render(<CompanyHeader name="Stripe" />)
    expect(screen.queryByText("92")).not.toBeInTheDocument()
  })

  it("renders the actions slot", () => {
    render(<CompanyHeader name="Stripe" actions={<button>History</button>} />)
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument()
  })
})
