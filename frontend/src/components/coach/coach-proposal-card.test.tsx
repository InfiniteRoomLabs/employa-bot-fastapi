import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CoachProposal } from "@/data/types"
import { CoachProposalCard } from "./coach-proposal-card"

const base: CoachProposal = {
  id: "p1",
  subject: { scope: "résumé", label: "this resume" },
  summary: "Tightened the bullet.",
  diff: [{ field: "Bullet", before: "old text", after: "new text" }],
  status: "pending",
}

describe("CoachProposalCard", () => {
  it("shows the before/after diff and accept/reject when pending", async () => {
    const onAccept = vi.fn()
    const user = userEvent.setup()
    render(
      <CoachProposalCard
        proposal={base}
        onAccept={onAccept}
        onReject={() => {}}
        onSave={() => {}}
      />,
    )
    expect(screen.getByText("old text")).toBeInTheDocument()
    expect(screen.getByText("new text")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /accept/i }))
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it("offers Save once accepted (gate 2)", () => {
    render(
      <CoachProposalCard
        proposal={{ ...base, status: "accepted" }}
        onAccept={() => {}}
        onReject={() => {}}
        onSave={() => {}}
      />,
    )
    expect(
      screen.getByRole("button", { name: /save change/i }),
    ).toBeInTheDocument()
  })
})
