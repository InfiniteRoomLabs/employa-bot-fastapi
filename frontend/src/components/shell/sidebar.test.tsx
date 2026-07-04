import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { SEARCH_ID_BACKEND, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import { Sidebar } from "./sidebar"

// Phase 9 swapped navigation buttons for `react-router-dom` `<Link>`s.
// ORI-008 converted Wins + Passed-on from buttons to Links as well.
// ORI-010 wraps the user pod with UserMenuPopover (DropdownMenu).
// Every test must mount the component inside a Router.
function renderSidebar(ui: React.ReactNode, initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
  )
}

describe("Sidebar", () => {
  it("renders the brand mark and name", () => {
    renderSidebar(<Sidebar />)
    expect(screen.getByText("employa")).toBeInTheDocument()
    expect(screen.getByText("-bot")).toBeInTheDocument()
  })

  it("renders each top-level workspace item", () => {
    renderSidebar(<Sidebar />)
    expect(screen.getByRole("link", { name: /Dashboard/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /My searches/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Resumes/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Coach/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Agents/ })).toBeInTheDocument()
    // ORI-008: Wins and Passed-on are now Links, not buttons
    expect(screen.getByRole("link", { name: /Wins/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Passed on/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument()
  })

  // ORI-008: verify Wins/Passed-on navigate to /wins and /passed-on
  it("wires Wins link to /wins", () => {
    const { container } = renderSidebar(<Sidebar />)
    expect(container.querySelector('[data-nav-id="wins"]')).toHaveAttribute(
      "href",
      "/wins",
    )
  })

  it("wires Passed-on link to /passed-on", () => {
    const { container } = renderSidebar(<Sidebar />)
    expect(
      container.querySelector('[data-nav-id="passed-on"]'),
    ).toHaveAttribute("href", "/passed-on")
  })

  // Searches now come from useSearches() (async) so we await resolution.
  it("renders all three saved searches", async () => {
    renderSidebar(<Sidebar />)
    expect(
      await screen.findByText(/Staff \/ Principal - Platform/),
    ).toBeInTheDocument()
    expect(await screen.findByText(/Senior\+ Backend/)).toBeInTheDocument()
    expect(await screen.findByText(/AI infra \/ inference/)).toBeInTheDocument()
  })

  it('marks the dashboard nav item active when `active="dashboard"`', () => {
    const { container } = renderSidebar(<Sidebar active="dashboard" />)
    const dashboard = container.querySelector('[data-nav-id="dashboard"]')
    expect(dashboard).toHaveAttribute("aria-current", "page")
    expect(
      container.querySelector('[data-nav-id="searches"]'),
    ).not.toHaveAttribute("aria-current")
  })

  it("derives active state from `location.pathname` when no `active` prop is passed", () => {
    const { container } = renderSidebar(<Sidebar />, ["/agents/log"])
    // `/agents/log` -> id `agent-log`; the Agents top-level item should highlight.
    expect(container.querySelector('[data-nav-id="agents"]')).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  // Searches are async - wait for the platform link to appear before asserting children.
  it("expands the platform search children when in the searches branch", async () => {
    const { container } = renderSidebar(<Sidebar active="shortlist" />)
    await waitFor(() =>
      expect(
        container.querySelector(`[data-nav-id="${SEARCH_ID_PLATFORM}"]`),
      ).not.toBeNull(),
    )
    const platformLink = container.querySelector(
      `[data-nav-id="${SEARCH_ID_PLATFORM}"]`,
    )
    expect(platformLink).toHaveAttribute("aria-current", "page")
    expect(
      container.querySelector('[data-nav-id="shortlist"]'),
    ).toHaveAttribute("aria-current", "page")
    expect(container.querySelector('[data-nav-id="jobs"]')).toBeInTheDocument()
    expect(
      container.querySelector('[data-nav-id="applications"]'),
    ).toBeInTheDocument()
  })

  it("expands children when the active value is a saved-search UUID", async () => {
    const { container } = renderSidebar(<Sidebar active={SEARCH_ID_BACKEND} />)
    await waitFor(() =>
      expect(
        container.querySelector(`[data-nav-id="${SEARCH_ID_BACKEND}"]`),
      ).not.toBeNull(),
    )
    const remote = container.querySelector(
      `[data-nav-id="${SEARCH_ID_BACKEND}"]`,
    )
    expect(remote).toHaveAttribute("aria-current", "page")
    // children render under the active search id
    expect(
      container.querySelector('[data-nav-id="shortlist"]'),
    ).toBeInTheDocument()
  })

  it("marks the applications branch active for app-detail / add-app", async () => {
    const { container: cDetail } = renderSidebar(
      <Sidebar active="app-detail" />,
    )
    // Wait for searches to load (platform search is the ACTIVE_SEARCH_ID for app-detail branch)
    await waitFor(() =>
      expect(
        cDetail.querySelector(`[data-nav-id="${SEARCH_ID_PLATFORM}"]`),
      ).not.toBeNull(),
    )
    expect(
      cDetail.querySelector('[data-nav-id="applications"]'),
    ).toHaveAttribute("aria-current", "page")
    const { container: cAdd } = renderSidebar(<Sidebar active="add-app" />)
    await waitFor(() =>
      expect(
        cAdd.querySelector(`[data-nav-id="${SEARCH_ID_PLATFORM}"]`),
      ).not.toBeNull(),
    )
    expect(cAdd.querySelector('[data-nav-id="applications"]')).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  it("marks Resumes active for match-explorer + resume-editor", () => {
    const { container } = renderSidebar(<Sidebar active="match-explorer" />)
    expect(container.querySelector('[data-nav-id="resumes"]')).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  it("marks Agents active for agent-detail + agent-log", () => {
    const { container } = renderSidebar(<Sidebar active="agent-log" />)
    expect(container.querySelector('[data-nav-id="agents"]')).toHaveAttribute(
      "aria-current",
      "page",
    )
  })

  it("renders the budget readout and the user pod", () => {
    const { container } = renderSidebar(<Sidebar />)
    expect(
      container.querySelector('[data-slot="budget-bar"]'),
    ).toBeInTheDocument()
    expect(screen.getByText("Wes Gilleland")).toBeInTheDocument()
    expect(screen.getByText("Pro plan")).toBeInTheDocument()
  })

  it("does not expand sublist children when no search branch is active", () => {
    const { container } = renderSidebar(<Sidebar active="dashboard" />)
    expect(container.querySelector('[data-nav-id="shortlist"]')).toBeNull()
  })

  it('wires the Dashboard link to "/dashboard"', () => {
    const { container } = renderSidebar(<Sidebar />)
    const dashboard = container.querySelector('[data-nav-id="dashboard"]')
    expect(dashboard?.tagName).toBe("A")
    expect(dashboard).toHaveAttribute("href", "/dashboard")
  })

  // Searches are async - wait for them to appear.
  it("wires saved-search links to /searches/<uuid>", async () => {
    const { container } = renderSidebar(<Sidebar />)
    await waitFor(() =>
      expect(
        container.querySelector(`[data-nav-id="${SEARCH_ID_PLATFORM}"]`),
      ).not.toBeNull(),
    )
    expect(
      container.querySelector(`[data-nav-id="${SEARCH_ID_PLATFORM}"]`),
    ).toHaveAttribute("href", `/searches/${SEARCH_ID_PLATFORM}`)
    expect(
      container.querySelector(`[data-nav-id="${SEARCH_ID_BACKEND}"]`),
    ).toHaveAttribute("href", `/searches/${SEARCH_ID_BACKEND}`)
  })

  // CTX-105: BudgetBar is wrapped in a Link to /settings?tab=usage
  it("wraps the BudgetBar in a link to /settings?tab=usage", () => {
    const { container } = renderSidebar(<Sidebar />)
    const budgetLink = container.querySelector('a[href="/settings?tab=usage"]')
    expect(budgetLink).toBeInTheDocument()
    expect(
      budgetLink?.querySelector('[data-slot="budget-bar"]'),
    ).toBeInTheDocument()
  })

  // ORI-010: user pod is present as user-menu trigger
  it('renders the user pod with data-nav-id="user-menu"', () => {
    const { container } = renderSidebar(<Sidebar />)
    expect(
      container.querySelector('[data-nav-id="user-menu"]'),
    ).toBeInTheDocument()
  })

  it("renders the user pod with Wes Gilleland name visible", () => {
    renderSidebar(<Sidebar />)
    expect(screen.getByText("Wes Gilleland")).toBeInTheDocument()
    expect(screen.getByText("Pro plan")).toBeInTheDocument()
  })
})
