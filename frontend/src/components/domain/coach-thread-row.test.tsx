import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CoachThread } from "@/data/types"

import { CoachThreadRow } from "./coach-thread-row"

const FIXTURE: CoachThread = {
  id: "stripe",
  title: "Stripe follow-up",
  scope: "application",
  when: "now",
}

describe("CoachThreadRow", () => {
  it("renders title, scope badge, when", () => {
    render(<CoachThreadRow thread={FIXTURE} />)
    expect(screen.getByText("Stripe follow-up")).toBeInTheDocument()
    expect(screen.getByText("application")).toBeInTheDocument()
    expect(screen.getByText("now")).toBeInTheDocument()
  })

  it("marks aria-current when active", () => {
    render(<CoachThreadRow thread={FIXTURE} active />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true")
  })

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<CoachThreadRow thread={FIXTURE} onClick={onClick} />)
    await user.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalled()
  })
})
