import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import CoachScreen from "./index"

describe("CoachScreen", () => {
  it("renders the three-column shell", async () => {
    renderScreen(<CoachScreen />)
    expect(screen.getByPlaceholderText(/Search threads/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask the coach/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(/Context/i)).toBeInTheDocument(),
    )
  })

  it("renders thread list with scope badges", async () => {
    renderScreen(<CoachScreen />)
    // Stripe follow-up thread should be visible
    await waitFor(() =>
      expect(screen.getByText(/Stripe follow-up/i)).toBeInTheDocument(),
    )
    // application scope badge should appear
    await waitFor(() =>
      expect(screen.getAllByText(/application/i).length).toBeGreaterThan(0),
    )
  })

  it("first thread is active by default", async () => {
    renderScreen(<CoachScreen />)
    await waitFor(() =>
      expect(screen.getByText(/Stripe follow-up/i)).toBeInTheDocument(),
    )
    // Stripe follow-up messages should load (first thread auto-selected)
    await waitFor(() =>
      expect(screen.getByText(/9 days is past Stripe/i)).toBeInTheDocument(),
    )
  })

  it("shows empty-conversation state when switching to a thread with no messages", async () => {
    const user = userEvent.setup()
    renderScreen(<CoachScreen />)
    // Wait for threads to load
    await waitFor(() =>
      expect(screen.getByText(/Prep for Linear/i)).toBeInTheDocument(),
    )
    // Click on 'Prep for Linear screen' thread
    await user.click(screen.getByText(/Prep for Linear/i))
    // Should show empty-conversation state (CUR-024)
    await waitFor(() =>
      expect(screen.getByText(/No messages yet/i)).toBeInTheDocument(),
    )
  })

  it("shows per-thread context cards (COA-021)", async () => {
    renderScreen(<CoachScreen />)
    // Stripe thread context cards should show
    await waitFor(() =>
      expect(
        screen.getByText(/Staff Engineer, Payments core/i),
      ).toBeInTheDocument(),
    )
  })

  it("renders draft block when a bot message has a draft (COA-018)", async () => {
    renderScreen(<CoachScreen />)
    // m3 fixture has a draft field, so the DraftBlock should appear (data-slot="draft-block")
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="draft-block"]'),
      ).toBeInTheDocument(),
    )
    // The copy button should be present
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Copy draft to clipboard/i }),
      ).toBeInTheDocument(),
    )
  })
})
