import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { renderScreen } from "@/test/render-screen"
import ContactsScreen from "./index"

describe("ContactsScreen", () => {
  it("renders the Contacts heading", () => {
    renderScreen(<ContactsScreen />, { initialEntries: ["/library/contacts"] })
    expect(
      screen.getByRole("heading", { name: /^Contacts$/i, level: 1 }),
    ).toBeInTheDocument()
  })

  it("opens the new-contact dialog", async () => {
    const user = userEvent.setup()
    renderScreen(<ContactsScreen />, { initialEntries: ["/library/contacts"] })
    await user.click(screen.getByRole("button", { name: /new contact/i }))
    await waitFor(() =>
      expect(
        screen.getByRole("dialog", { name: /new contact/i }),
      ).toBeInTheDocument(),
    )
  })
})
