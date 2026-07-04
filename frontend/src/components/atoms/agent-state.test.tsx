import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AgentState } from "./agent-state"

describe("AgentState", () => {
  it("renders provided label", () => {
    render(<AgentState state="running" label="Up" />)
    expect(screen.getByText("Up")).toBeInTheDocument()
  })

  it("falls back to the state name when no label is given", () => {
    render(<AgentState state="paused" />)
    expect(screen.getByText("paused")).toBeInTheDocument()
  })

  it("applies the state class", () => {
    const { container } = render(<AgentState state="error" />)
    expect(container.querySelector('[data-slot="agent-state"]')).toHaveClass(
      "agent-state--error",
    )
  })

  it("renders a live dot when live", () => {
    const { container } = render(<AgentState state="running" label="On" live />)
    const dot = container.querySelector('[data-slot="agent-state"] .dot--live')
    expect(dot).not.toBeNull()
  })

  it("omits the live dot by default", () => {
    const { container } = render(<AgentState state="demand" />)
    expect(
      container.querySelector('[data-slot="agent-state"] .dot--live'),
    ).toBeNull()
  })
})
