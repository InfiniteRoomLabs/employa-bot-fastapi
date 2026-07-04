import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import UserMenuScreen from "./index"

describe("UserMenuScreen", () => {
  it("renders the user menu trigger", () => {
    renderScreen(<UserMenuScreen />)
    expect(screen.getByLabelText(/Open user menu/i)).toBeInTheDocument()
  })
})
