import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

// ORI-011: Mock the CommandPalette to avoid jsdom ResizeObserver issues from cmdk.
// The real component is tested by its own story in Storybook browser mode.
vi.mock("./command-palette", () => ({
  CommandPalette: ({
    open,
    onOpenChange,
  }: {
    open: boolean
    onOpenChange: (v: boolean) => void
  }) =>
    open ? (
      <div role="dialog" aria-label="Navigate" data-testid="command-palette">
        <button onClick={() => onOpenChange(false)}>Close palette</button>
      </div>
    ) : null,
}))

import { Topbar } from "./topbar"

// Topbar uses useNotifications (async) and CommandPalette (react-router
// useNavigate), so it needs a Router context.
function renderTopbar(props: React.ComponentProps<typeof Topbar>) {
  return render(
    <MemoryRouter>
      <Topbar {...props} />
    </MemoryRouter>,
  )
}

describe("Topbar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the title and subtitle", () => {
    renderTopbar({ title: "My searches", subtitle: "3 active jobs" })
    expect(screen.getByText("My searches")).toBeInTheDocument()
    expect(screen.getByText("3 active jobs")).toBeInTheDocument()
  })

  it("omits the subtitle node when not supplied", () => {
    const { container } = renderTopbar({ title: "Dashboard" })
    expect(container.querySelector(".app__topbar-sub")).toBeNull()
  })

  it("renders the global search input with placeholder + cmd-K hint", () => {
    renderTopbar({ title: "Dashboard" })
    const input = screen.getByRole("searchbox", { name: "Global search" })
    expect(input).toHaveAttribute(
      "placeholder",
      expect.stringContaining("Search"),
    )
    expect(screen.getByText("⌘K")).toBeInTheDocument()
  })

  it("renders the BotPill with the static agent-status string", () => {
    renderTopbar({ title: "Dashboard" })
    expect(screen.getByText(/agents · watching your apps/)).toBeInTheDocument()
  })

  it("invokes onOpenNotifications when the bell button is clicked", async () => {
    const onOpenNotifications = vi.fn()
    renderTopbar({ title: "Dashboard", onOpenNotifications })
    const bell = screen.getByRole("button", { name: /Notifications/ })
    await userEvent.click(bell)
    expect(onOpenNotifications).toHaveBeenCalledTimes(1)
  })

  it("renders the theme toggle button", () => {
    renderTopbar({ title: "Dashboard" })
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) theme/ }),
    ).toBeInTheDocument()
  })

  it("renders the optional actions slot", () => {
    renderTopbar({ title: "Dashboard", actions: <button>Export</button> })
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
  })

  // ORI-011: Command palette controlled state
  it("opens the command palette when paletteOpen=true", () => {
    renderTopbar({
      title: "Dashboard",
      paletteOpen: true,
      onPaletteOpenChange: vi.fn(),
    })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("does not show the palette dialog when paletteOpen=false", () => {
    renderTopbar({
      title: "Dashboard",
      paletteOpen: false,
      onPaletteOpenChange: vi.fn(),
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("calls onPaletteOpenChange(true) when the search area is clicked", async () => {
    const onPaletteOpenChange = vi.fn()
    renderTopbar({
      title: "Dashboard",
      paletteOpen: false,
      onPaletteOpenChange,
    })
    const searchArea = screen.getByRole("button", {
      name: "Open command palette",
    })
    await userEvent.click(searchArea)
    expect(onPaletteOpenChange).toHaveBeenCalledWith(true)
  })

  it("opens the palette on Cmd-K keydown", async () => {
    const onPaletteOpenChange = vi.fn()
    renderTopbar({
      title: "Dashboard",
      paletteOpen: false,
      onPaletteOpenChange,
    })
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        }),
      )
    })
    expect(onPaletteOpenChange).toHaveBeenCalledWith(true)
  })

  it("opens the palette on Ctrl-K keydown", async () => {
    const onPaletteOpenChange = vi.fn()
    renderTopbar({
      title: "Dashboard",
      paletteOpen: false,
      onPaletteOpenChange,
    })
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
        }),
      )
    })
    expect(onPaletteOpenChange).toHaveBeenCalledWith(true)
  })

  // ORI-011: Search area has the correct accessible role
  it("renders the search area as a button for keyboard access", () => {
    renderTopbar({ title: "Dashboard" })
    expect(
      screen.getByRole("button", { name: "Open command palette" }),
    ).toBeInTheDocument()
  })

  // ORI-012: bell unread dot and accessible label
  it("renders the bell button with accessible label", () => {
    renderTopbar({ title: "Dashboard" })
    const bell = screen.getByRole("button", { name: /Notifications/ })
    expect(bell).toBeInTheDocument()
  })
})
