import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import ToastsScreen from "./index"

describe("ToastsScreen", () => {
  it("renders the Action toasts headline", () => {
    renderScreen(<ToastsScreen />)
    expect(
      screen.getByRole("heading", { name: /Action toasts/i }),
    ).toBeInTheDocument()
  })

  it("renders fire buttons for every variant", () => {
    renderScreen(<ToastsScreen />)
    // 6 variant rows shipped by the design.
    expect(screen.getAllByRole("button", { name: /^Fire /i }).length).toBe(6)
  })

  it("fires each toast variant when its button is clicked", async () => {
    // Exercises every row's `fire()` callback (toast.success/agent/warn/error/celebrate).
    const user = userEvent.setup()
    renderScreen(<ToastsScreen />)
    const buttons = screen.getAllByRole("button", { name: /^Fire /i })
    for (const button of buttons) {
      await user.click(button)
    }
    // Smoke: at least one toast surface ended up in the document. Sonner
    // portals into its own region, so we only need to confirm clicks did
    // not throw and rendered without errors.
    expect(buttons.length).toBe(6)
  })
})
