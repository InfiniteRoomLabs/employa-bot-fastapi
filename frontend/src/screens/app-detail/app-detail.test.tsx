import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import AppDetailScreen from "./index"

describe("AppDetailScreen", () => {
  it("renders the application detail when loaded", async () => {
    renderScreen(<AppDetailScreen />)
    await waitFor(() =>
      expect(screen.getByText(/Event timeline/i)).toBeInTheDocument(),
    )
    expect(screen.getByText(/Stage - click to change/i)).toBeInTheDocument()
  })
})
