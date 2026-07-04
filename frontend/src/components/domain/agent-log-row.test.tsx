import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { AgentLogEntry } from "@/data/types"

import { AgentLogRow } from "./agent-log-row"

const FIXTURE: AgentLogEntry = {
  time: "14:32",
  agentId: "coach",
  kind: "await",
  message: "Drafted follow-up for Supabase",
  ref: "Supabase - Principal Engineer",
}

describe("AgentLogRow", () => {
  it("renders time, agent name, message, ref", () => {
    render(<AgentLogRow entry={FIXTURE} agentName="Coach" />)
    expect(screen.getByText("14:32")).toBeInTheDocument()
    expect(screen.getByText("Coach")).toBeInTheDocument()
    expect(screen.getByText(/Drafted follow-up/)).toBeInTheDocument()
    expect(
      screen.getByText("Supabase - Principal Engineer"),
    ).toBeInTheDocument()
  })

  it("renders Review button for await rows", async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
    render(<AgentLogRow entry={FIXTURE} onReview={onReview} />)
    await user.click(screen.getByRole("button", { name: /review/i }))
    expect(onReview).toHaveBeenCalledWith(FIXTURE)
  })

  it("renders auto badge for auto kind", () => {
    render(<AgentLogRow entry={{ ...FIXTURE, kind: "auto" }} />)
    expect(screen.getByText("auto")).toBeInTheDocument()
  })

  it("renders done badge for success kind", () => {
    render(<AgentLogRow entry={{ ...FIXTURE, kind: "success" }} />)
    expect(screen.getByText("done")).toBeInTheDocument()
  })

  it("renders skipped badge for skipped kind", () => {
    render(<AgentLogRow entry={{ ...FIXTURE, kind: "skipped" }} />)
    expect(screen.getByText("skipped")).toBeInTheDocument()
  })

  it("falls back to entry.a when agentName is not provided", () => {
    render(<AgentLogRow entry={FIXTURE} />)
    expect(screen.getByText("coach")).toBeInTheDocument()
  })
})
