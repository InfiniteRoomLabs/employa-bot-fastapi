import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import MarkWonScreen from "./index"

describe("MarkWonScreen", () => {
  it("renders the celebration dialog content", () => {
    renderScreen(<MarkWonScreen />)
    expect(screen.getByText(/Congrats on the new role/i)).toBeInTheDocument()
    expect(screen.getByText(/What worked/i)).toBeInTheDocument()
  })
})
