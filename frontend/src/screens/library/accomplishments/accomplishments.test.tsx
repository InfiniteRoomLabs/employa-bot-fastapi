import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import AccomplishmentsScreen from "./index"

describe("AccomplishmentsScreen", () => {
  it("renders the Accomplishments heading", () => {
    renderScreen(<AccomplishmentsScreen />, {
      initialEntries: ["/library/accomplishments"],
    })
    expect(
      screen.getByRole("heading", { name: /^Accomplishments$/i, level: 1 }),
    ).toBeInTheDocument()
  })
})
