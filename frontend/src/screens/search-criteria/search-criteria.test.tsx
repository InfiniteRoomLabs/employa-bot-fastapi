/**
 * Tests for SearchCriteriaScreen -- dual-mode (create + edit).
 *
 * ADD-010: create mode (/searches/criteria, no :id)
 * ADD-006: edit mode (/searches/:id/criteria, :id present)
 * CUR-017: error/not-found rendering
 * ORI-014: toast feedback (mutation call verified via spy)
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as api from "@/data/api"
import { SEARCH_ID_BACKEND, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import { renderScreen } from "@/test/render-screen"

import SearchCriteriaScreen from "./index"

// ---------------------------------------------------------------------------
// Helper: render with a matched Route (so useParams returns :id correctly)
// ---------------------------------------------------------------------------

function renderWithRoute(path: string, url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={<SearchCriteriaScreen />} />
        {/* Stub for post-create navigation */}
        <Route path="/searches/:id" element={<div>Search detail stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  api.__resetForTests?.()
})

// ---------------------------------------------------------------------------
// CREATE MODE -- /searches/criteria (no :id in URL)
// ---------------------------------------------------------------------------

describe("SearchCriteriaScreen -- create mode", () => {
  it('renders "New search" heading', () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    // PageHead title -- h1
    expect(
      screen.getByRole("heading", { level: 1, name: /new search/i }),
    ).toBeInTheDocument()
  })

  it("renders the name field and criteria sections", () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    expect(screen.getByText("Search name")).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. Remote/i)).toBeInTheDocument()
    expect(screen.getByText("Titles")).toBeInTheDocument()
    expect(screen.getByText("Where")).toBeInTheDocument()
  })

  it("does NOT render pre-filled title chips in create mode", () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    // Pre-filled chips should not appear in create mode (blank form)
    expect(screen.queryByText("Principal Engineer")).not.toBeInTheDocument()
  })

  it("does NOT render the status sidebar card", () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    expect(screen.queryByText("Search status")).not.toBeInTheDocument()
  })

  it("renders Create search and Cancel buttons", () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    expect(
      screen.getByRole("button", { name: /create search/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })

  it("shows inline name-required error when Create is clicked with empty name", async () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    const createBtn = screen.getByRole("button", { name: /create search/i })
    fireEvent.click(createBtn)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /give your search a name/i,
      )
    })
  })

  it("clears the inline error when user types a name", async () => {
    renderScreen(<SearchCriteriaScreen />, {
      initialEntries: ["/searches/criteria"],
    })
    const createBtn = screen.getByRole("button", { name: /create search/i })
    fireEvent.click(createBtn)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText(/e\.g\. Remote/i)
    fireEvent.change(nameInput, { target: { value: "My new search" } })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("calls createSearch API when name is filled and Create is clicked", async () => {
    const createSpy = vi.spyOn(api, "createSearch")

    renderWithRoute("/searches/criteria", "/searches/criteria")

    const nameInput = screen.getByPlaceholderText(/e\.g\. Remote/i)
    fireEvent.change(nameInput, { target: { value: "Test Search Alpha" } })

    const createBtn = screen.getByRole("button", { name: /create search/i })
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledOnce()
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Test Search Alpha" }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// EDIT MODE -- /searches/:id/criteria (:id present)
// Uses renderWithRoute to ensure useParams receives the :id segment.
// ---------------------------------------------------------------------------

describe("SearchCriteriaScreen -- edit mode (ADD-006)", () => {
  it("loads the BACKEND search criteria when :id is SEARCH_ID_BACKEND", async () => {
    renderWithRoute(
      "/searches/:id/criteria",
      `/searches/${SEARCH_ID_BACKEND}/criteria`,
    )

    // Backend search includes "Staff Engineer" as a title chip
    await waitFor(() => {
      expect(screen.getByText("Staff Engineer")).toBeInTheDocument()
    })
  })

  it("renders the status sidebar with Search status heading in edit mode", async () => {
    renderWithRoute(
      "/searches/:id/criteria",
      `/searches/${SEARCH_ID_PLATFORM}/criteria`,
    )

    await waitFor(() => {
      expect(screen.getByText("Search status")).toBeInTheDocument()
    })
  })

  it("shows Save and Discard buttons after editing a field", async () => {
    renderWithRoute(
      "/searches/:id/criteria",
      `/searches/${SEARCH_ID_PLATFORM}/criteria`,
    )

    // Wait for data to load -- Staff Engineer chip appears
    await waitFor(() => {
      expect(screen.getByText("Staff Engineer")).toBeInTheDocument()
    })

    // Mutate a threshold field to make the form dirty
    const inputs = screen.getAllByRole("textbox")
    const baseFloorInput = inputs.find((el) =>
      (el as HTMLInputElement).value?.toString().includes("210"),
    )
    expect(baseFloorInput).toBeDefined()
    fireEvent.change(baseFloorInput!, { target: { value: "$215k" } })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /discard/i }),
      ).toBeInTheDocument()
    })
  })

  it("calls updateSearchCriteria API when Save is clicked", async () => {
    const updateSpy = vi.spyOn(api, "updateSearchCriteria")

    renderWithRoute(
      "/searches/:id/criteria",
      `/searches/${SEARCH_ID_PLATFORM}/criteria`,
    )

    await waitFor(() => {
      expect(screen.getByText("Staff Engineer")).toBeInTheDocument()
    })

    // Trigger dirty state
    const inputs = screen.getAllByRole("textbox")
    const baseFloorInput = inputs.find((el) =>
      (el as HTMLInputElement).value?.toString().includes("210"),
    )
    expect(baseFloorInput).toBeDefined()
    fireEvent.change(baseFloorInput!, { target: { value: "$215k" } })

    const saveBtn = await screen.findByRole("button", { name: /save/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledOnce()
    })
  })

  it("reverts working state when Discard is clicked", async () => {
    renderWithRoute(
      "/searches/:id/criteria",
      `/searches/${SEARCH_ID_PLATFORM}/criteria`,
    )

    await waitFor(() => {
      expect(screen.getByText("Staff Engineer")).toBeInTheDocument()
    })

    // Change a field to get dirty
    const inputs = screen.getAllByRole("textbox")
    const baseFloorInput = inputs.find((el) =>
      (el as HTMLInputElement).value?.toString().includes("210"),
    )
    expect(baseFloorInput).toBeDefined()
    fireEvent.change(baseFloorInput!, { target: { value: "$215k" } })

    const discardBtn = await screen.findByRole("button", { name: /discard/i })
    fireEvent.click(discardBtn)

    // After discard, Save button should disappear (form is clean again)
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^save$/i }),
      ).not.toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// CUR-017: error state
// ---------------------------------------------------------------------------

describe("SearchCriteriaScreen -- CUR-017 error handling", () => {
  it("renders ResourceError not-found panel for unknown :id", async () => {
    const fakeId = "does-not-exist-1111-2222-3333"

    renderWithRoute("/searches/:id/criteria", `/searches/${fakeId}/criteria`)

    // The ResourceError component renders a role="alert" when error occurs
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument()
    })

    // Should show not-found copy and Back link
    expect(
      screen.getByText(/does not exist or was removed/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /back to searches/i }),
    ).toBeInTheDocument()
  })
})
