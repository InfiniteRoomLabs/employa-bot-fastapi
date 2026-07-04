import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import ExtensionScreen from "./index"

describe("ExtensionScreen", () => {
  it("renders all three popup states", async () => {
    renderScreen(<ExtensionScreen />)
    expect(
      screen.getByRole("heading", { name: /Browser extension/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/On a recognized job posting/i)).toBeInTheDocument()
    expect(screen.getByText(/fallback/i)).toBeInTheDocument()
    expect(screen.getByText(/not signed in/i)).toBeInTheDocument()
    // Recently captured loads from the async hook.
    await waitFor(() =>
      expect(screen.getByText(/Recently captured/i)).toBeInTheDocument(),
    )
  })
})
