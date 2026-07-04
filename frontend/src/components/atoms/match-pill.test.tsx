import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { MatchPill } from "./match-pill"

const SUBS = [
  { label: "Skills fit", value: 90 },
  { label: "Seniority", value: 78 },
  { label: "Comp", value: 62 },
] as const

describe("MatchPill", () => {
  it("renders the score and qualitative word", () => {
    render(<MatchPill score={84} />)
    expect(screen.getByText("84")).toBeInTheDocument()
    expect(screen.getByText("Strong")).toBeInTheDocument()
  })

  it("classifies tier as high at 80+", () => {
    const { container } = render(<MatchPill score={80} />)
    expect(container.querySelector('[data-slot="match-pill"]')).toHaveAttribute(
      "data-tier",
      "high",
    )
  })

  it("classifies tier as mid in [60, 80)", () => {
    const { container } = render(<MatchPill score={60} />)
    expect(container.querySelector('[data-slot="match-pill"]')).toHaveAttribute(
      "data-tier",
      "mid",
    )
    expect(screen.getByText("Worth a look")).toBeInTheDocument()
  })

  it("classifies tier as low below 60", () => {
    const { container } = render(<MatchPill score={59} />)
    expect(container.querySelector('[data-slot="match-pill"]')).toHaveAttribute(
      "data-tier",
      "low",
    )
    expect(screen.getByText("Stretch")).toBeInTheDocument()
  })

  it("hides the qualitative word in compact mode", () => {
    render(<MatchPill score={84} compact />)
    expect(screen.queryByText("Strong")).not.toBeInTheDocument()
  })

  it('shows a "rough" label for the free-heuristic kind (D8)', () => {
    render(<MatchPill score={72} kind="rough" />)
    expect(screen.getByText("rough")).toBeInTheDocument()
    expect(screen.getByText("72")).toBeInTheDocument()
  })

  it('does not show "rough" for a deep score', () => {
    render(<MatchPill score={72} kind="deep" />)
    expect(screen.queryByText("rough")).not.toBeInTheDocument()
  })

  it("renders a static span when no subs are provided", () => {
    render(<MatchPill score={84} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("renders an expand button when subs are provided", () => {
    render(<MatchPill score={84} subs={SUBS} />)
    expect(
      screen.getByRole("button", { name: /match 84 of 100/i }),
    ).toBeInTheDocument()
  })

  it("expands the popover and shows sub-score rows", async () => {
    render(<MatchPill score={84} subs={SUBS} />)
    await userEvent.click(
      screen.getByRole("button", { name: /show breakdown/i }),
    )
    expect(await screen.findByText("Skills fit")).toBeInTheDocument()
    expect(screen.getByText("Seniority")).toBeInTheDocument()
    expect(screen.getByText("Comp")).toBeInTheDocument()
  })
})
