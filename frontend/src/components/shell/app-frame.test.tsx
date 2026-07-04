import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { AppFrame } from "./app-frame"

// AppFrame mounts the Sidebar which calls useLocation; every test needs a
// router context. Wrap once here so each test reads cleanly.
function renderFrame(ui: React.ReactNode) {
  return render(<MemoryRouter initialEntries={["/"]}>{ui}</MemoryRouter>)
}

describe("AppFrame", () => {
  it("renders sidebar, topbar title, and children", () => {
    const { container } = renderFrame(
      <AppFrame title="Searches overview">
        <p>page body</p>
      </AppFrame>,
    )
    // Topbar carries the title in `.app__topbar-title`.
    expect(container.querySelector(".app__topbar-title")).toHaveTextContent(
      "Searches overview",
    )
    expect(screen.getByText("page body")).toBeInTheDocument()
    // Sidebar is in the tree (a nav item that only exists there).
    expect(
      screen.getByRole("button", { name: /My searches/ }),
    ).toBeInTheDocument()
  })

  it("renders the subtitle in the topbar when provided", () => {
    renderFrame(
      <AppFrame title="Searches" subtitle="3 active jobs">
        <p>body</p>
      </AppFrame>,
    )
    expect(screen.getByText("3 active jobs")).toBeInTheDocument()
  })

  it("forwards `active` to Sidebar", () => {
    const { container } = renderFrame(
      <AppFrame title="x" active="dashboard">
        <p>body</p>
      </AppFrame>,
    )
    expect(
      container.querySelector('[data-nav-id="dashboard"]'),
    ).toHaveAttribute("aria-current", "page")
  })

  it("applies `app__page--bleed` when `bleed` is set", () => {
    const { container } = renderFrame(
      <AppFrame title="x" bleed>
        <p>body</p>
      </AppFrame>,
    )
    const page = container.querySelector('[data-slot="app-frame-page"]')
    expect(page).toHaveClass("app__page--bleed")
    expect(page).toHaveAttribute("data-bleed", "true")
  })

  it("defaults to `app__page` (non-bleed)", () => {
    const { container } = renderFrame(
      <AppFrame title="x">
        <p>body</p>
      </AppFrame>,
    )
    const page = container.querySelector('[data-slot="app-frame-page"]')
    expect(page).toHaveClass("app__page")
    expect(page).not.toHaveClass("app__page--bleed")
    expect(page).not.toHaveAttribute("data-bleed")
  })

  it("mirrors a string title onto data-screen-label", () => {
    const { container } = renderFrame(
      <AppFrame title="Dashboard">
        <p>body</p>
      </AppFrame>,
    )
    expect(container.querySelector(".app__main")).toHaveAttribute(
      "data-screen-label",
      "Dashboard",
    )
  })

  it("omits data-screen-label when title is JSX", () => {
    const { container } = renderFrame(
      <AppFrame title={<span>complex</span>}>
        <p>body</p>
      </AppFrame>,
    )
    expect(container.querySelector(".app__main")).not.toHaveAttribute(
      "data-screen-label",
    )
  })

  it("renders topbarActions in the topbar", () => {
    renderFrame(
      <AppFrame title="x" topbarActions={<button>Export</button>}>
        <p>body</p>
      </AppFrame>,
    )
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument()
  })

  it("wires onOpenNotifications through to the bell button", async () => {
    const onOpenNotifications = vi.fn()
    renderFrame(
      <AppFrame title="x" onOpenNotifications={onOpenNotifications}>
        <p>body</p>
      </AppFrame>,
    )
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }))
    expect(onOpenNotifications).toHaveBeenCalledTimes(1)
  })
})
