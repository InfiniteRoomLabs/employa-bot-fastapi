import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import ResumesScreen from "./index"

describe("ResumesScreen (segmented lifecycle)", () => {
  it("renders the Resumes heading", () => {
    renderScreen(<ResumesScreen />)
    expect(
      screen.getByRole("heading", { name: /^Resumes$/i, level: 1 }),
    ).toBeInTheDocument()
  })

  it("renders the three lifecycle segments", async () => {
    renderScreen(<ResumesScreen />)
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /^Uploads$/i }),
      ).toBeInTheDocument(),
    )
    expect(
      screen.getByRole("heading", { name: /masters & variants/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /^Exports$/i }),
    ).toBeInTheDocument()
  })

  it("shows provenance on an export (rendered from projection + template)", async () => {
    renderScreen(<ResumesScreen />)
    await waitFor(() =>
      expect(screen.getByText(/^from .+ \+ .+/i)).toBeInTheDocument(),
    )
  })

  it("opens the new-master builder dialog", async () => {
    const user = userEvent.setup()
    renderScreen(<ResumesScreen />)
    await user.click(screen.getByRole("button", { name: /new master/i }))
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: /new master/i }),
      ).toBeInTheDocument(),
    )
    // Builder lets the user pick which career-history items to include.
    expect(screen.getByText(/include from career history/i)).toBeInTheDocument()
  })
})
