import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import TemplatesScreen from "./index"

describe("TemplatesScreen", () => {
  it("renders the Templates heading", () => {
    renderScreen(<TemplatesScreen />, {
      initialEntries: ["/library/templates"],
    })
    expect(
      screen.getByRole("heading", { name: /^Templates$/i, level: 1 }),
    ).toBeInTheDocument()
  })
})
