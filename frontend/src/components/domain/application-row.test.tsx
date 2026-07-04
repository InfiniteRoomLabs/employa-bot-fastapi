import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { mockApplicationView } from "@/test/mock-application"

import { ApplicationRow } from "./application-row"

const FIXTURE = mockApplicationView({ flag: "stale" })

describe("ApplicationRow", () => {
  it("renders company, role, and match score", () => {
    render(<ApplicationRow application={FIXTURE} />)
    expect(screen.getByText("Stripe")).toBeInTheDocument()
    expect(
      screen.getByText("Staff Engineer, Payments core"),
    ).toBeInTheDocument()
    expect(screen.getByText("92")).toBeInTheDocument()
  })

  it("renders stale flag when present", () => {
    render(<ApplicationRow application={FIXTURE} />)
    expect(screen.getByText("stale")).toBeInTheDocument()
  })

  it("calls onSelect with the application id when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ApplicationRow application={FIXTURE} onSelect={onSelect} />)
    await user.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledWith("stripe")
  })

  it("marks aria-current when active", () => {
    render(<ApplicationRow application={FIXTURE} active />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true")
  })
})
