import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CoachActorBadge } from "./coach-actor-badge"

describe("CoachActorBadge", () => {
  it("attributes a Coach-on-behalf action", () => {
    render(<CoachActorBadge actor="coach-on-behalf" />)
    expect(screen.getByText(/coach \(on behalf of you\)/i)).toBeInTheDocument()
  })

  it("renders the user actor", () => {
    render(<CoachActorBadge actor="you" />)
    expect(screen.getByText(/^You$/)).toBeInTheDocument()
  })

  it("renders a named agent", () => {
    render(<CoachActorBadge actor="agent" agentName="Aria" />)
    expect(screen.getByText(/Aria/)).toBeInTheDocument()
  })
})
