import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import ReviewChangelogScreen from "./index"

describe("ReviewChangelogScreen", () => {
  it("renders the Review Changelog heading", () => {
    renderScreen(<ReviewChangelogScreen />, {
      initialEntries: ["/agents/review-changelog"],
    })
    expect(
      screen.getByRole("heading", { name: /review changelog/i, level: 1 }),
    ).toBeInTheDocument()
  })
})
