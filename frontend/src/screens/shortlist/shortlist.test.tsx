import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import ShortlistScreen from "./index"

describe("ShortlistScreen", () => {
  it("renders the headline and at least one row when loaded", async () => {
    renderScreen(<ShortlistScreen />)
    expect(
      screen.getByText(/roles you'd like to apply to/i),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getAllByText(/saved/i).length).toBeGreaterThan(0),
    )
  })

  it('shows a single "All saved" scope with no auto-shortlist split', () => {
    // Post-descope: every entry is user-saved, so the Auto-shortlisted / You
    // saved filter chips are gone -- only the "All saved" scope chip remains.
    renderScreen(<ShortlistScreen />)
    expect(
      screen.getByRole("button", { name: /All saved/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Auto-shortlisted/i }),
    ).not.toBeInTheDocument()
  })
})
