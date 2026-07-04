import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "@/components/ui/button-eb"

import { AttnRow } from "./attn-row"

describe("AttnRow", () => {
  it("renders the tag label, title, and meta", () => {
    render(
      <AttnRow
        tag="stale"
        title="Stripe — 9 days, no response"
        meta="Avg reply is 6d"
      />,
    )
    expect(screen.getByText("Stale")).toBeInTheDocument()
    expect(screen.getByText("Stripe — 9 days, no response")).toBeInTheDocument()
    expect(screen.getByText("Avg reply is 6d")).toBeInTheDocument()
  })

  it("applies the variant class via tag", () => {
    const { container } = render(<AttnRow tag="reply" title="t" meta="m" />)
    const root = container.querySelector('[data-slot="attn-row"]')
    expect(root).toHaveAttribute("data-tag", "reply")
  })

  it("renders the cta slot", () => {
    render(
      <AttnRow tag="offer" title="t" meta="m" cta={<Button>Review</Button>} />,
    )
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument()
  })

  it("renders an overflow button when onOverflow is provided", async () => {
    const user = userEvent.setup()
    const onOverflow = vi.fn()
    render(<AttnRow tag="prep" title="t" meta="m" onOverflow={onOverflow} />)
    await user.click(screen.getByRole("button", { name: /more options/i }))
    expect(onOverflow).toHaveBeenCalled()
  })

  it("omits the overflow button when onOverflow is undefined", () => {
    render(<AttnRow tag="prep" title="t" meta="m" />)
    expect(
      screen.queryByRole("button", { name: /more options/i }),
    ).not.toBeInTheDocument()
  })
})
