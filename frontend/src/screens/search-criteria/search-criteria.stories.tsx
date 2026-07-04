/**
 * Stories for SearchCriteriaScreen -- dual-mode (create + edit).
 *
 * NOTE: Storybook's preview.tsx wraps every story in MemoryRouter at '/'.
 * Stories that need a specific URL use a decorator that replaces the outer
 * MemoryRouter via a Routes wrapper -- following the same pattern used by
 * resume-preview.stories.tsx and resume-editor.stories.tsx in this codebase.
 *
 * CreateMode: /searches/criteria (no :id) -- blank form
 * EditMode:   /searches/:id/criteria -- pre-filled from SEARCH_ID_BACKEND
 */

import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { SEARCH_ID_BACKEND, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import SearchCriteriaScreen from "./index"

// ---------------------------------------------------------------------------
// Base meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Screens/SearchCriteria",
  component: SearchCriteriaScreen,
  parameters: { layout: "fullscreen", router: { disable: true } },
} satisfies Meta<typeof SearchCriteriaScreen>

export default meta
type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// CREATE MODE -- /searches/criteria
// ---------------------------------------------------------------------------

/**
 * Create mode: blank form, name field visible, no status sidebar.
 * Reached when the sidebar "New search" link is clicked.
 */
export const CreateMode: Story = {
  decorators: [
    () => (
      <MemoryRouter initialEntries={["/searches/criteria"]}>
        <Routes>
          <Route path="/searches/criteria" element={<SearchCriteriaScreen />} />
          <Route
            path="/searches/:id"
            element={<div>Search detail (stub)</div>}
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

// ---------------------------------------------------------------------------
// EDIT MODE -- /searches/:id/criteria (SEARCH_ID_BACKEND)
// ---------------------------------------------------------------------------

/**
 * Edit mode: pre-filled from the backend (fintech) search.
 * Chips include "Staff Engineer", "Senior Staff Engineer", etc.
 * Status sidebar visible. Dirty Save/Discard affordance appears after editing.
 */
export const EditMode: Story = {
  decorators: [
    () => (
      <MemoryRouter
        initialEntries={[`/searches/${SEARCH_ID_BACKEND}/criteria`]}
      >
        <Routes>
          <Route
            path="/searches/:id/criteria"
            element={<SearchCriteriaScreen />}
          />
          <Route
            path="/searches/:id"
            element={<div>Search detail (stub)</div>}
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/**
 * Edit mode: primary Platform search (default persona).
 */
export const EditModePlatform: Story = {
  decorators: [
    () => (
      <MemoryRouter
        initialEntries={[`/searches/${SEARCH_ID_PLATFORM}/criteria`]}
      >
        <Routes>
          <Route
            path="/searches/:id/criteria"
            element={<SearchCriteriaScreen />}
          />
          <Route
            path="/searches/:id"
            element={<div>Search detail (stub)</div>}
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/**
 * Not-found state: :id that does not exist in the fixture store.
 * Should render the ResourceError not-found panel with a "Back to searches" link.
 */
export const NotFound: Story = {
  decorators: [
    () => (
      <MemoryRouter initialEntries={["/searches/does-not-exist-1111/criteria"]}>
        <Routes>
          <Route
            path="/searches/:id/criteria"
            element={<SearchCriteriaScreen />}
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

// ---------------------------------------------------------------------------
// Legacy alias
// ---------------------------------------------------------------------------

/** @deprecated Use CreateMode instead. */
export const Default: Story = {
  ...CreateMode,
}
