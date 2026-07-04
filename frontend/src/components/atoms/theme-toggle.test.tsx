import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ThemeToggle } from "./theme-toggle"

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "light")
    try {
      localStorage.removeItem("eb-theme")
    } catch {
      // ignore — jsdom storage may throw in odd modes
    }
  })

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme")
  })

  it("renders an accessible toggle button", () => {
    render(<ThemeToggle />)
    expect(
      screen.getByRole("button", { name: /switch to dark theme/i }),
    ).toBeInTheDocument()
  })

  it("toggles the document theme on click", async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole("button"))
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
  })

  it("swaps the accessible label after toggling", async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole("button"))
    expect(
      screen.getByRole("button", { name: /switch to light theme/i }),
    ).toBeInTheDocument()
  })

  it("reflects current theme via aria-pressed", async () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole("button")
    expect(btn).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(btn)
    expect(btn).toHaveAttribute("aria-pressed", "true")
  })
})
