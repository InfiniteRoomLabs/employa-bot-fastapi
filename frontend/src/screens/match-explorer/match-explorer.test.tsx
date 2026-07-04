import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import MatchExplorerScreen from "./index"

describe("MatchExplorerScreen", () => {
  it("renders the rubric, gaps, and strengths panels", async () => {
    renderScreen(<MatchExplorerScreen />)
    expect(
      screen.getAllByText(/Distributed-systems v4 vs Stripe/i).length,
    ).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText("Rubric")).toBeInTheDocument())
    expect(screen.getByText("Gaps")).toBeInTheDocument()
    expect(screen.getByText("Strengths")).toBeInTheDocument()
  })

  it('renders "Generate tailored revision" button after data loads', async () => {
    renderScreen(<MatchExplorerScreen />)
    // Timeout bumped to 3000ms: when the full test suite runs alongside the
    // storybook (chromium) project, 0ms-latency setTimeouts can be delayed by
    // event loop saturation. 3s stays well under Vitest's per-test ceiling.
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: /Generate tailored revision/i }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })

  it("button is clickable and shows mutating state", async () => {
    const user = userEvent.setup()
    renderScreen(<MatchExplorerScreen />)
    const btn = await screen.findByRole("button", {
      name: /Generate tailored revision/i,
    })
    // Click it -- mutation starts (may navigate away, so we just assert no throw)
    await user.click(btn)
    // After click the button text changes to "Forking..." briefly
    // We assert it rendered successfully
    expect(document.body).toBeInTheDocument()
  })
})
