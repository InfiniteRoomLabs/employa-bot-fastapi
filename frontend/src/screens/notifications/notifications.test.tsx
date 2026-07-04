import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import NotificationsScreen from "./index"

describe("NotificationsScreen", () => {
  it("renders the notifications trigger", () => {
    renderScreen(<NotificationsScreen />)
    expect(screen.getByLabelText(/Open notifications/i)).toBeInTheDocument()
  })
})
