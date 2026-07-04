/**
 * Tests for SearchDetailScreen.
 *
 * ADD-006: Edit criteria link is wired to /searches/:id/criteria
 * CUR-017: error/not-found panel renders when hook returns error
 */

import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { SEARCH_ID_BACKEND, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import { renderScreen } from "@/test/render-screen"

import SearchDetailScreen from "./index"

// ---------------------------------------------------------------------------
// Helper: render with a matched Route (so useParams returns :id correctly)
// ---------------------------------------------------------------------------

function renderWithRoute(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/searches/:id" element={<SearchDetailScreen />} />
        <Route
          path="/searches/:id/criteria"
          element={<div>Criteria stub</div>}
        />
        <Route path="/searches/:id/inbox" element={<div>Inbox stub</div>} />
        <Route
          path="/searches/:id/shortlist"
          element={<div>Shortlist stub</div>}
        />
        <Route
          path="/searches/:id/applications"
          element={<div>Applications stub</div>}
        />
        <Route path="/dashboard" element={<div>Dashboard stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SearchDetailScreen", () => {
  it("renders the pipeline section and stat tiles", async () => {
    // renderScreen without route -- falls back to SEARCH_ID_PLATFORM via params.id ?? SEARCH_ID_PLATFORM
    renderScreen(<SearchDetailScreen />)
    expect(
      await screen.findByRole("heading", { name: /Your pipeline/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Jobs in inbox")).toBeInTheDocument()
  })

  it("shows the correct search name for SEARCH_ID_BACKEND", async () => {
    renderWithRoute(`/searches/${SEARCH_ID_BACKEND}`)
    // The name appears in both the sidebar (nav-subitem__label) and the page
    // heading now that the sidebar uses useSearches(). Use findByRole to scope
    // to the h1 heading which is the canonical rendered location.
    expect(
      await screen.findByRole("heading", {
        name: /Senior\+ Backend/i,
        level: 1,
      }),
    ).toBeInTheDocument()
  })

  it("renders the Edit criteria link pointing to /searches/:id/criteria (ADD-006)", async () => {
    renderWithRoute(`/searches/${SEARCH_ID_PLATFORM}`)

    const link = await screen.findByRole("link", { name: /edit criteria/i })
    expect(link).toHaveAttribute(
      "href",
      `/searches/${SEARCH_ID_PLATFORM}/criteria`,
    )
  })

  it("renders not-found ResourceError panel for unknown :id (CUR-017)", async () => {
    renderWithRoute("/searches/does-not-exist-9999")

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    expect(
      screen.getByText(/does not exist or was removed/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /back to dashboard/i }),
    ).toBeInTheDocument()
  })

  it("renders quick link buttons as navigation links", async () => {
    renderWithRoute(`/searches/${SEARCH_ID_PLATFORM}`)

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /open jobs inbox/i }),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole("link", { name: /open shortlist/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /open applications/i }),
    ).toBeInTheDocument()
  })
})
