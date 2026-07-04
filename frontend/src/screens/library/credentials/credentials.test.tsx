import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import CredentialsScreen from "./index"

describe("CredentialsScreen", () => {
  it("renders the Credentials heading", () => {
    renderScreen(<CredentialsScreen />, {
      initialEntries: ["/library/credentials"],
    })
    expect(
      screen.getByRole("heading", { name: /^Credentials$/i, level: 1 }),
    ).toBeInTheDocument()
  })
})
