import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { JobInboxItem } from "@/data/types"

import { JobInboxRow } from "./job-inbox-row"

const FIXTURE: JobInboxItem = {
  company: "Stripe",
  role: "Staff Engineer - Payments core",
  location: "Remote - US",
  compensation: "$255-305k",
  match: 92,
  source: "greenhouse",
  isNew: true,
  posted: "2d ago",
}

describe("JobInboxRow", () => {
  it("renders company, role, location/comp/src, match", () => {
    render(<JobInboxRow job={FIXTURE} />)
    expect(screen.getByText("Stripe")).toBeInTheDocument()
    expect(
      screen.getByText("Staff Engineer - Payments core"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Remote - US/)).toBeInTheDocument()
    expect(screen.getByText("92")).toBeInTheDocument()
  })

  it("renders the NEW badge when isNew is set", () => {
    render(<JobInboxRow job={FIXTURE} />)
    expect(screen.getByText("NEW")).toBeInTheDocument()
  })

  it("hides the NEW badge when isNew is unset", () => {
    render(<JobInboxRow job={{ ...FIXTURE, isNew: false }} />)
    expect(screen.queryByText("NEW")).not.toBeInTheDocument()
  })

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<JobInboxRow job={FIXTURE} onSelect={onSelect} />)
    await user.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledWith(FIXTURE)
  })
})
