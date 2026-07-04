import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import AddAppScreen from "./index"

describe("AddAppScreen", () => {
  it("renders step 1 by default", () => {
    renderScreen(<AddAppScreen />)
    expect(
      screen.getByText(/How would you like to add this job/i),
    ).toBeInTheDocument()
  })

  it("advances to step 2 on Fetch", async () => {
    const user = userEvent.setup()
    renderScreen(<AddAppScreen />)
    await user.click(screen.getByRole("button", { name: /^Fetch/i }))
    expect(
      screen.getByText(/Staff Engineer, Payments core/i),
    ).toBeInTheDocument()
  })
})
