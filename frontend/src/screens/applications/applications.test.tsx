import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { renderScreen } from "@/test/render-screen"

import ApplicationsScreen from "./index"

describe("ApplicationsScreen", () => {
  it("renders the page head and view toggle", async () => {
    renderScreen(<ApplicationsScreen />)
    await waitFor(() =>
      expect(screen.getAllByText("Applications").length).toBeGreaterThan(0),
    )
    expect(screen.getByText(/List \+ detail/i)).toBeInTheDocument()
  })

  it("switches to the table view when the Table toggle is pressed", async () => {
    // Drives the `view === 'table'` branch -> renders <TableView />.
    const user = userEvent.setup()
    renderScreen(<ApplicationsScreen />)
    await waitFor(() =>
      expect(screen.getAllByText("Applications").length).toBeGreaterThan(0),
    )
    await user.click(screen.getByRole("radio", { name: /^Table$/i }))
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument())
  })

  it("switches to the kanban view and renders every stage column", async () => {
    // Drives the `view === 'kanban'` branch -> renders <KanbanView />.
    const user = userEvent.setup()
    renderScreen(<ApplicationsScreen />)
    await waitFor(() =>
      expect(screen.getAllByText("Applications").length).toBeGreaterThan(0),
    )
    await user.click(screen.getByRole("radio", { name: /^Kanban$/i }))
    // Stage column headers are part of the kanban shell.
    await waitFor(() =>
      expect(screen.getByText("Drafting")).toBeInTheDocument(),
    )
    expect(screen.getByText("Screen")).toBeInTheDocument()
    expect(screen.getByText("Offer")).toBeInTheDocument()
  })

  it("selects a different application when its list item is clicked", async () => {
    // Drives the `setActiveId` setState in <ListView />.
    const user = userEvent.setup()
    renderScreen(<ApplicationsScreen />)
    await waitFor(() =>
      expect(screen.getAllByText("Applications").length).toBeGreaterThan(0),
    )
    const cards = await screen.findAllByRole("button", { name: /\d+%/ })
    // Click the second card; the previous one was the default-selected item.
    await user.click(cards[1])
    expect(cards[1]).toHaveAttribute("aria-current", "true")
  })

  it("flips a stage filter chip when clicked", async () => {
    // Drives the `setStage` setState across FILTERS.
    const user = userEvent.setup()
    renderScreen(<ApplicationsScreen />)
    await waitFor(() =>
      expect(screen.getAllByText("Applications").length).toBeGreaterThan(0),
    )
    const offersChip = screen.getByRole("button", { name: /Offers/i })
    await user.click(offersChip)
    expect(offersChip).toHaveAttribute("aria-pressed", "true")
  })
})
