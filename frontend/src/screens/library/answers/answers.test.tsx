import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import AnswersScreen from "./index"

describe("AnswersScreen", () => {
  it("renders the Answers heading", () => {
    renderScreen(<AnswersScreen />, { initialEntries: ["/library/answers"] })
    expect(
      screen.getByRole("heading", { name: /^Answers$/i, level: 1 }),
    ).toBeInTheDocument()
  })
})
