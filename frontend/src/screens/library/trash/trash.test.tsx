import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import TrashScreen from "./index"

describe("TrashScreen", () => {
  it("renders the empty trash state when nothing is soft-deleted", async () => {
    renderScreen(<TrashScreen />)
    await waitFor(() =>
      expect(screen.getByText("Trash is empty")).toBeInTheDocument(),
    )
  })
})
