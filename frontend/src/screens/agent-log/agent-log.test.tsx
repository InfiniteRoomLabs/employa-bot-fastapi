import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import AgentLogScreen from "./index"

describe("AgentLogScreen", () => {
  it("renders the log heading and filter chips", async () => {
    renderScreen(<AgentLogScreen />)
    expect(screen.getByText(/Agent action log/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^All$/i })).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryAllByText(/auto|success|await/i).length,
      ).toBeGreaterThan(0),
    )
  })

  it("flips chip pressed state when filter chips are clicked", async () => {
    // Drives the `setKind` setState across every chip branch.
    const user = userEvent.setup()
    renderScreen(<AgentLogScreen />)
    const autoChip = screen.getByRole("button", { name: /^Auto$/i })
    await user.click(autoChip)
    expect(autoChip).toHaveAttribute("aria-pressed", "true")

    const awaitChip = screen.getByRole("button", { name: /Awaiting you/i })
    await user.click(awaitChip)
    expect(awaitChip).toHaveAttribute("aria-pressed", "true")

    const successChip = screen.getByRole("button", { name: /^Success$/i })
    await user.click(successChip)
    expect(successChip).toHaveAttribute("aria-pressed", "true")
  })
})
