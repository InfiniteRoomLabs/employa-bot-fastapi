import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import DashboardScreen from "./index"

describe("DashboardScreen", () => {
  it("renders the dashboard PageHead title", async () => {
    renderScreen(<DashboardScreen />)
    await waitFor(() => expect(screen.getByText(/three/i)).toBeInTheDocument())
    expect(screen.getByText(/Needs your attention/i)).toBeInTheDocument()
  })
})
