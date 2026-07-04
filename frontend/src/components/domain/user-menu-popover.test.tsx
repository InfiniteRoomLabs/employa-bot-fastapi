import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { UserMenuPopover } from "./user-menu-popover"

describe("UserMenuPopover", () => {
  it("renders user name and email after open", async () => {
    const user = userEvent.setup()
    render(<UserMenuPopover trigger={<button>Open</button>} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() =>
      expect(screen.getByText(/Wes Gilleland/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/@/)).toBeInTheDocument()
  })

  it("renders the static menu rows", async () => {
    const user = userEvent.setup()
    render(<UserMenuPopover trigger={<button>Open</button>} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() =>
      expect(screen.getByText("Settings")).toBeInTheDocument(),
    )
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument()
    expect(screen.getByText("What's new")).toBeInTheDocument()
    expect(screen.getByText("Help & support")).toBeInTheDocument()
  })

  it("fires onSignOut when Log out is selected", async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(
      <UserMenuPopover trigger={<button>Open</button>} onSignOut={onSignOut} />,
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: /log out/i }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("menuitem", { name: /log out/i }))
    expect(onSignOut).toHaveBeenCalled()
  })
})
