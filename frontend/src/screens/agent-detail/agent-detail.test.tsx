import { screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import AgentDetailScreen from "./index"

describe("AgentDetailScreen", () => {
  it("renders the agent detail PageHead", async () => {
    renderScreen(<AgentDetailScreen />)
    await waitFor(() =>
      expect(screen.getByText("Configuration")).toBeInTheDocument(),
    )
  })
})
