import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { CoachMessage as CoachMessageType } from "@/data/types"

import { CoachMessage } from "./coach-message"

const BOT_MSG: CoachMessageType = {
  id: "1",
  author: "bot",
  text: "Here's a message for you",
}
const USER_MSG: CoachMessageType = {
  id: "2",
  author: "user",
  text: "yes please, under 4 sentences",
}
const BOT_MSG_WITH_DRAFT: CoachMessageType = {
  id: "3",
  author: "bot",
  text: "Here's a follow-up:",
  draft:
    "Hi Maya -- circling back on the Staff Engineer, Payments core role. -- Wes",
}

describe("CoachMessage", () => {
  it("renders user message right-aligned without feedback buttons", () => {
    render(<CoachMessage message={USER_MSG} />)
    expect(screen.getByText(/yes please/)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /thumbs/i }),
    ).not.toBeInTheDocument()
  })

  it("renders bot message with thumbs feedback buttons", () => {
    render(<CoachMessage message={BOT_MSG} />)
    expect(screen.getByText(/Here's a message/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /thumbs up/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /thumbs down/i }),
    ).toBeInTheDocument()
  })

  it("fires onFeedback when thumbs up is clicked", async () => {
    const user = userEvent.setup()
    const onFeedback = vi.fn()
    render(<CoachMessage message={BOT_MSG} onFeedback={onFeedback} />)
    await user.click(screen.getByRole("button", { name: /thumbs up/i }))
    expect(onFeedback).toHaveBeenCalledWith("up")
  })

  it("marks the pressed feedback after selection", async () => {
    const user = userEvent.setup()
    render(<CoachMessage message={BOT_MSG} />)
    const down = screen.getByRole("button", { name: /thumbs down/i })
    await user.click(down)
    expect(down).toHaveAttribute("aria-pressed", "true")
  })

  // COA-018: Draft block tests
  it("renders a DraftBlock when message.draft is present", () => {
    render(<CoachMessage message={BOT_MSG_WITH_DRAFT} />)
    expect(screen.getByText(/Hi Maya/)).toBeInTheDocument()
    // Draft slot rendered
    expect(
      document.querySelector('[data-slot="draft-block"]'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Copy draft to clipboard/i }),
    ).toBeInTheDocument()
  })

  it("does NOT render a DraftBlock when message.draft is absent", () => {
    render(<CoachMessage message={BOT_MSG} />)
    // No draft-block slot
    expect(
      document.querySelector('[data-slot="draft-block"]'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Copy draft to clipboard/i }),
    ).not.toBeInTheDocument()
  })

  it("renders draft text in the DraftBlock", () => {
    render(<CoachMessage message={BOT_MSG_WITH_DRAFT} />)
    expect(
      screen.getByText(
        /circling back on the Staff Engineer, Payments core role/,
      ),
    ).toBeInTheDocument()
  })
})
