import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import SettingsScreen from "./index"

async function waitForLoaded() {
  // The Profile heading exists only after `useSettings()` resolves. Wide
  // timeout because the full-suite test run runs every project in parallel
  // and our `useSettings` resolution can take several seconds under load.
  await waitFor(
    () =>
      expect(
        screen.getByRole("heading", { name: /^Profile$/ }),
      ).toBeInTheDocument(),
    { timeout: 10_000 },
  )
}

describe("SettingsScreen", { timeout: 15_000 }, () => {
  it("renders the left nav with every section", async () => {
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    expect(
      within(nav).getByRole("button", { name: /Profile/i }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole("button", { name: /Integrations/i }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole("button", { name: /AI providers/i }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole("button", { name: /AI usage/i }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole("button", { name: /Privacy & data/i }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole("button", { name: /Billing/i }),
    ).toBeInTheDocument()
    expect(
      within(nav).getByRole("button", { name: /Danger zone/i }),
    ).toBeInTheDocument()
  })

  it("edits a profile field and reveals the save bar; discard reverts", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()

    const nameInput = screen.getByRole("textbox", {
      name: "Name",
    }) as HTMLInputElement
    const original = nameInput.value
    expect(original).not.toBe("")
    await user.clear(nameInput)
    await user.type(nameInput, "Edited Name")
    expect(nameInput.value).toBe("Edited Name")

    const saveBar = await screen.findByTestId("settings-save-bar")
    expect(saveBar).toBeInTheDocument()

    await user.click(within(saveBar).getByRole("button", { name: /Discard/i }))
    await waitFor(() =>
      expect(screen.queryByTestId("settings-save-bar")).not.toBeInTheDocument(),
    )
    expect(
      (screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement).value,
    ).toBe(original)
  })

  it("toggles an integration", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /Integrations/i }))

    const disconnectGmail = await screen.findByRole("button", {
      name: /Disconnect Gmail/i,
    })
    await user.click(disconnectGmail)
    expect(
      await screen.findByRole("button", { name: /Connect Gmail/i }),
    ).toBeInTheDocument()
    expect(await screen.findByTestId("settings-save-bar")).toBeInTheDocument()
  })

  it("edits an AI provider API key with show/hide toggle", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /AI providers/i }))

    const keyInput = (await screen.findByTestId(
      "provider-key-Anthropic",
    )) as HTMLInputElement
    expect(keyInput.type).toBe("password")
    await user.clear(keyInput)
    await user.type(keyInput, "sk-ant-test-1234")
    expect(keyInput.value).toBe("sk-ant-test-1234")

    await user.click(
      screen.getByRole("button", { name: /Show Anthropic key/i }),
    )
    expect(
      (screen.getByTestId("provider-key-Anthropic") as HTMLInputElement).type,
    ).toBe("text")
    expect(await screen.findByTestId("settings-save-bar")).toBeInTheDocument()
  })

  it("changes a routing model selection", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /AI providers/i }))

    const trigger = await screen.findByLabelText("Model for Coach chat")
    await user.click(trigger)
    // Pick a different model that exists in fixtures.
    const opt = await screen.findByRole("option", { name: /gemini-1.5-pro/ })
    await user.click(opt)
    expect(await screen.findByTestId("settings-save-bar")).toBeInTheDocument()
  })

  it("edits the monthly cap on the AI usage panel", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /AI usage/i }))

    const cap = (await screen.findByLabelText(
      "Monthly cap",
    )) as HTMLInputElement
    await user.clear(cap)
    await user.type(cap, "$50.00")
    expect(cap.value).toBe("$50.00")
    expect(await screen.findByTestId("settings-save-bar")).toBeInTheDocument()
  })

  it("toggles a privacy switch", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(
      within(nav).getByRole("button", { name: /Privacy & data/i }),
    )

    const sw = await screen.findByRole("switch", {
      name: /Use my résumés to fine-tune models/i,
    })
    expect(sw).toHaveAttribute("aria-checked", "false")
    await user.click(sw)
    expect(sw).toHaveAttribute("aria-checked", "true")
    expect(await screen.findByTestId("settings-save-bar")).toBeInTheDocument()
  })

  it("renders the billing panel with plan info", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /Billing/i }))
    expect(
      await screen.findByRole("heading", { name: /^Billing$/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /Invoices/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Unlimited applications/i)).toBeInTheDocument()
  })

  it("auto-formats the profile phone field as (NNN) NNN-NNNN", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const phone = (await screen.findByTestId(
      "profile-phone",
    )) as HTMLInputElement
    await user.clear(phone)
    await user.type(phone, "5105550142")
    expect(phone.value).toBe("(510) 555-0142")
  })

  it("shows an inline error for an invalid profile email on blur", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const email = (await screen.findByTestId(
      "profile-email",
    )) as HTMLInputElement
    await user.clear(email)
    await user.type(email, "not-an-email")
    // Error only appears after blur (`touched`).
    expect(screen.queryByTestId("profile-email-error")).not.toBeInTheDocument()
    await user.tab()
    expect(await screen.findByTestId("profile-email-error")).toBeInTheDocument()
  })

  it("changes the profile timezone via Select", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const tz = await screen.findByTestId("profile-timezone")
    await user.click(tz)
    const opt = await screen.findByRole("option", { name: /Asia \/ Tokyo/i })
    await user.click(opt)
    expect(await screen.findByTestId("settings-save-bar")).toBeInTheDocument()
  })

  it("opens the danger-action confirmation dialog", async () => {
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /Danger zone/i }))

    const deleteBtn = await screen.findByRole("button", {
      name: /^Delete account$/i,
    })
    await user.click(deleteBtn)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getAllByText(/Delete account/i).length).toBeGreaterThan(1)
  })

  it("confirms a danger action and closes the dialog", async () => {
    // Drives the `confirm()` happy path inside DangerPanel.
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /Danger zone/i }))

    const deleteBtn = await screen.findByRole("button", {
      name: /^Delete account$/i,
    })
    await user.click(deleteBtn)

    const dialog = await screen.findByRole("dialog")
    // Confirm the destructive action -- there are two "Delete account"
    // labelled buttons: the row trigger (already clicked) and the dialog
    // confirm button. Pick the one inside the dialog.
    const confirmButton = within(dialog).getByRole("button", {
      name: /^Delete account$/i,
    })
    await user.click(confirmButton)

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
  })

  it("cancels a danger action via the dialog Cancel button", async () => {
    // Drives the `DialogClose` branch where `setPending(null)` runs.
    const user = userEvent.setup()
    renderScreen(<SettingsScreen />)
    await waitForLoaded()
    const nav = screen.getByRole("navigation", { name: /Settings sections/i })
    await user.click(within(nav).getByRole("button", { name: /Danger zone/i }))

    const deleteBtn = await screen.findByRole("button", {
      name: /^Delete account$/i,
    })
    await user.click(deleteBtn)
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /Cancel/i }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    )
  })
})
