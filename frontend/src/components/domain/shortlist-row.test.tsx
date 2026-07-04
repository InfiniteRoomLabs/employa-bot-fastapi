import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ShortlistEntry } from "@/data/types"

import { ShortlistRow } from "./shortlist-row"

const FIXTURE: ShortlistEntry = {
  company: "Stripe",
  role: "Staff Engineer - Payments core",
  location: "Remote - US",
  compensation: "$255-305k",
  match: 88,
  saved: "3d",
  source: "you",
  why: "Platform-team posting, async-first, matches your ingest-pipeline work.",
}

describe("ShortlistRow", () => {
  it("renders company, role, compensation, match, and the saved-by-you badge", () => {
    render(<ShortlistRow entry={FIXTURE} />)
    expect(screen.getByText("Stripe")).toBeInTheDocument()
    expect(
      screen.getByText("Staff Engineer - Payments core"),
    ).toBeInTheDocument()
    expect(screen.getByText(/Remote - US/)).toBeInTheDocument()
    expect(screen.getByText("Saved by you")).toBeInTheDocument()
    expect(screen.getByText("88")).toBeInTheDocument()
  })

  it("renders the why annotation when present", () => {
    render(<ShortlistRow entry={FIXTURE} />)
    expect(screen.getByText(/Platform-team posting/)).toBeInTheDocument()
  })

  it("renders the going-stale badge when stale", () => {
    render(<ShortlistRow entry={{ ...FIXTURE, stale: true }} />)
    expect(screen.getByText("going stale")).toBeInTheDocument()
  })

  it("omits the why block when not provided", () => {
    const { why: _why, ...rest } = FIXTURE
    void _why
    render(<ShortlistRow entry={rest as ShortlistEntry} />)
    expect(screen.queryByText(/Platform-team posting/)).not.toBeInTheDocument()
  })

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(
      <ShortlistRow entry={FIXTURE} onSelect={onSelect} />,
    )
    const root = container.querySelector('[data-slot="shortlist-row"]')!
    await user.click(root)
    expect(onSelect).toHaveBeenCalledWith(FIXTURE)
  })
})
