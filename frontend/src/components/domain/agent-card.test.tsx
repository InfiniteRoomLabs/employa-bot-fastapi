import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Agent } from "@/data/types"

import { AgentCard } from "./agent-card"

const FIXTURE: Agent = {
  id: "scout",
  name: "Scout",
  icon: "compass",
  state: "running",
  stateLabel: "running",
  lastActivity: "5m ago",
  actions: 142,
  cost: "$0.84",
  description:
    "Watches job boards and scores new postings against your criteria.",
  live: true,
}

describe("AgentCard", () => {
  it("renders agent name, description, last run, actions, cost", () => {
    render(<AgentCard agent={FIXTURE} />)
    expect(screen.getByText("Scout")).toBeInTheDocument()
    expect(screen.getByText(/Watches job boards/)).toBeInTheDocument()
    expect(screen.getByText("5m ago")).toBeInTheDocument()
    expect(screen.getByText("142")).toBeInTheDocument()
    // Cost appears in both the stat row and the CostChip
    expect(screen.getAllByText("$0.84").length).toBeGreaterThan(0)
  })

  it("renders agent state chip with the label", () => {
    render(<AgentCard agent={FIXTURE} />)
    expect(screen.getByText("running")).toBeInTheDocument()
  })

  it('renders "paused" cost chip when cost is —', () => {
    render(<AgentCard agent={{ ...FIXTURE, state: "paused", cost: "—" }} />)
    expect(screen.getByText("paused")).toBeInTheDocument()
  })

  it("calls onSelect when clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { container } = render(
      <AgentCard agent={FIXTURE} onSelect={onSelect} />,
    )
    const root = container.querySelector('[data-slot="agent-card"]')!
    await user.click(root)
    expect(onSelect).toHaveBeenCalledWith("scout")
  })
})
