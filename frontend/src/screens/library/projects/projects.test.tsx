import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import ProjectsScreen from "./index"

describe("ProjectsScreen", () => {
  it("renders the Projects heading", () => {
    renderScreen(<ProjectsScreen />, { initialEntries: ["/library/projects"] })
    expect(
      screen.getByRole("heading", { name: /^Projects$/i, level: 1 }),
    ).toBeInTheDocument()
  })
})
