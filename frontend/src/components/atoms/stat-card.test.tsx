import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatCard } from "./stat-card"

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard label="Applied this week" value={12} />)
    expect(screen.getByText("Applied this week")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
  })

  it("renders an up-toned delta", () => {
    const { container } = render(
      <StatCard label="Replies" value="4" delta="+1 vs last" tone="up" />,
    )
    const delta = container.querySelector('[data-slot="stat-card-delta"]')
    expect(delta).toHaveClass("stat__delta--up")
    expect(delta).toHaveAttribute("data-tone", "up")
  })

  it("renders a down-toned delta", () => {
    const { container } = render(
      <StatCard label="Cost" value="$1.20" delta="-3% vs last" tone="down" />,
    )
    expect(
      container.querySelector('[data-slot="stat-card-delta"]'),
    ).toHaveClass("stat__delta--down")
  })

  it("renders a neutral delta when no tone is given", () => {
    const { container } = render(
      <StatCard label="Pending" value="2" delta="held over" />,
    )
    const delta = container.querySelector('[data-slot="stat-card-delta"]')
    expect(delta).toHaveClass("stat__delta")
    expect(delta).not.toHaveClass("stat__delta--up", "stat__delta--down")
  })

  it("renders a hint when supplied", () => {
    render(<StatCard label="x" value="1" hint="caveat copy" />)
    expect(screen.getByText("caveat copy")).toBeInTheDocument()
  })

  it("omits the delta + hint nodes when neither is provided", () => {
    const { container } = render(<StatCard label="x" value="1" />)
    expect(container.querySelector('[data-slot="stat-card-delta"]')).toBeNull()
    expect(container.querySelector('[data-slot="stat-card-hint"]')).toBeNull()
  })
})
