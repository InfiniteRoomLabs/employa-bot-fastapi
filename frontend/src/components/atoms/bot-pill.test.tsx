import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BotPill } from "./bot-pill"

describe("BotPill", () => {
  it("renders its children as the label", () => {
    render(<BotPill>Ava drafted this</BotPill>)
    expect(screen.getByText("Ava drafted this")).toBeInTheDocument()
  })

  it("applies the live class when live", () => {
    const { container } = render(<BotPill live>streaming</BotPill>)
    expect(container.querySelector('[data-slot="bot-pill"]')).toHaveClass(
      "bot-pill--live",
    )
  })

  it("applies the muted class when muted", () => {
    const { container } = render(<BotPill muted>quiet</BotPill>)
    expect(container.querySelector('[data-slot="bot-pill"]')).toHaveClass(
      "bot-pill--muted",
    )
  })

  it("renders the leading dot", () => {
    const { container } = render(<BotPill>x</BotPill>)
    expect(
      container.querySelector('[data-slot="bot-pill"] .dot'),
    ).not.toBeNull()
  })

  it("honors caller className over base styles", () => {
    const { container } = render(
      <BotPill className="custom-test-class">x</BotPill>,
    )
    expect(container.querySelector('[data-slot="bot-pill"]')).toHaveClass(
      "custom-test-class",
    )
  })
})
