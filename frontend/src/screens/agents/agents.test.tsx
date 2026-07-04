import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import AgentsScreen from "./index"

describe("AgentsScreen", () => {
  it("renders headline and at least one agent card when loaded", async () => {
    renderScreen(<AgentsScreen />)
    expect(screen.getByText(/A few small agents/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getAllByText(/Configure|configure/i).length,
      ).toBeGreaterThan(0),
    )
  })
})
