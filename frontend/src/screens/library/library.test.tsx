import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import LibraryScreen from "./index"

describe("LibraryScreen", () => {
  it("renders the library overview heading", () => {
    renderScreen(<LibraryScreen />, { initialEntries: ["/library"] })
    expect(
      screen.getByRole("heading", { name: /your library/i, level: 1 }),
    ).toBeInTheDocument()
  })

  it("lists artifact-type tiles", () => {
    renderScreen(<LibraryScreen />, { initialEntries: ["/library"] })
    // Assert via the tile blurbs, which are unique to the Overview (the labels
    // themselves also appear in the sidebar nav).
    expect(
      screen.getByText(/recruiters, hiring managers, and references/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/reusable quantified wins and star stories/i),
    ).toBeInTheDocument()
  })
})
