import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { NotificationsPopover } from "./notifications-popover"

describe("NotificationsPopover", () => {
  it("renders the header with unread count after the trigger is opened", async () => {
    const user = userEvent.setup()
    render(<NotificationsPopover trigger={<button>Open</button>} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /notifications/i }),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText(/unread/)).toBeInTheDocument()
  })

  it("fires onMarkAllRead", async () => {
    const user = userEvent.setup()
    const onMarkAllRead = vi.fn()
    render(
      <NotificationsPopover
        trigger={<button>Open</button>}
        onMarkAllRead={onMarkAllRead}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /mark all read/i }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: /mark all read/i }))
    expect(onMarkAllRead).toHaveBeenCalled()
  })

  it("filters by kind when chips are pressed", async () => {
    const user = userEvent.setup()
    render(<NotificationsPopover trigger={<button>Open</button>} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Replies" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Replies" }))
    // After clicking Replies, the agent-rows should be filtered out.
    expect(screen.queryByText(/Tailor forked résumé/)).not.toBeInTheDocument()
  })
})
