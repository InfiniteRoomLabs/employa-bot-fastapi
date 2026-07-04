import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AccountIdPanel } from "./account-id-panel"

describe("AccountIdPanel", () => {
  it("surfaces a read-only Account ID with a copy affordance", () => {
    render(<AccountIdPanel />)
    expect(
      screen.getByRole("heading", { name: /^Account$/ }),
    ).toBeInTheDocument()
    const input = screen.getByRole("textbox", {
      name: "Account ID",
    }) as HTMLInputElement
    expect(input).toHaveAttribute("readonly")
    expect(input.value).toMatch(/^acct_/)
    expect(
      screen.getByRole("button", { name: /copy account id/i }),
    ).toBeInTheDocument()
  })
})
