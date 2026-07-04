import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import JobsScreen from "./index"

describe("JobsScreen", () => {
  it("renders the filter chips and job rows when loaded", async () => {
    renderScreen(<JobsScreen />)
    // Manual capture toolbar: "Add a job" leads (no scraper trigger).
    expect(
      await screen.findByRole("button", { name: /Add a job/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getAllByRole("button").length).toBeGreaterThan(5),
    )
  })
})
