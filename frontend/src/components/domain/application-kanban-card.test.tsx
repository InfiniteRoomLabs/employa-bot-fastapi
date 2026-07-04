import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { mockApplicationView } from "@/test/mock-application"

import { ApplicationKanbanCard } from "./application-kanban-card"

const FIXTURE = mockApplicationView({
  id: "supabase",
  company: "Supabase",
  role: "Principal Engineer, Realtime",
  stage: "screen",
  stageLabel: "Screen",
  location: "Remote - US",
  salary: { min: 290000, max: 350000, extra: [] },
  match: 82,
  days: 4,
  source: "greenhouse",
})

describe("ApplicationKanbanCard", () => {
  it("renders company, role, match, and days", () => {
    render(<ApplicationKanbanCard application={FIXTURE} />)
    expect(screen.getByText("Supabase")).toBeInTheDocument()
    expect(screen.getByText("Principal Engineer, Realtime")).toBeInTheDocument()
    expect(screen.getByText("82%")).toBeInTheDocument()
    expect(screen.getByText("· 4 days ago")).toBeInTheDocument()
  })

  it("renders stale badge when flagged", () => {
    render(
      <ApplicationKanbanCard application={{ ...FIXTURE, flag: "stale" }} />,
    )
    expect(screen.getByText("stale")).toBeInTheDocument()
  })

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ApplicationKanbanCard application={FIXTURE} onSelect={onSelect} />)
    await user.click(screen.getByRole("button"))
    expect(onSelect).toHaveBeenCalledWith("supabase")
  })
})
