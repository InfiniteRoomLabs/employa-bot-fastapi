import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CoachBlock } from "./coach-block"

describe("CoachBlock", () => {
  it("renders the default Coach kicker and body", () => {
    render(<CoachBlock>You waited 9 days. Try a short follow-up.</CoachBlock>)
    expect(screen.getByText("Coach")).toBeInTheDocument()
    expect(screen.getByText(/You waited 9 days/)).toBeInTheDocument()
  })

  it("renders a custom kicker", () => {
    render(<CoachBlock kicker="Coach · Stripe">Body</CoachBlock>)
    expect(screen.getByText("Coach · Stripe")).toBeInTheDocument()
  })
})
