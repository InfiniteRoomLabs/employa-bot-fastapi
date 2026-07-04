/**
 * Stories for SearchDetailScreen.
 *
 * NOTE: Storybook's preview.tsx wraps every story in MemoryRouter at '/'.
 * Stories that need specific URLs override via decorators that wrap in their
 * own MemoryRouter (same pattern as resume-preview.stories.tsx).
 *
 * Default: primary Platform search (sidebar fallback)
 * RemoteSearch: SEARCH_ID_BACKEND
 * NotFound: unresolvable :id -> ResourceError not-found panel
 */

import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { SEARCH_ID_BACKEND, SEARCH_ID_PLATFORM } from "@/data/fixtures"
import SearchDetailScreen from "./index"

const meta = {
  title: "Screens/SearchDetail",
  component: SearchDetailScreen,
  parameters: { layout: "fullscreen", router: { disable: true } },
} satisfies Meta<typeof SearchDetailScreen>

export default meta
type Story = StoryObj<typeof meta>

/** Default primary Platform search. */
export const Default: Story = {
  decorators: [
    () => (
      <MemoryRouter initialEntries={[`/searches/${SEARCH_ID_PLATFORM}`]}>
        <Routes>
          <Route path="/searches/:id" element={<SearchDetailScreen />} />
          <Route
            path="/searches/:id/criteria"
            element={<div>Criteria (stub)</div>}
          />
          <Route path="/searches/:id/inbox" element={<div>Inbox (stub)</div>} />
          <Route
            path="/searches/:id/shortlist"
            element={<div>Shortlist (stub)</div>}
          />
          <Route
            path="/searches/:id/applications"
            element={<div>Applications (stub)</div>}
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/** Backend (fintech) search -- exercises a different dataset. */
export const RemoteSearch: Story = {
  decorators: [
    () => (
      <MemoryRouter initialEntries={[`/searches/${SEARCH_ID_BACKEND}`]}>
        <Routes>
          <Route path="/searches/:id" element={<SearchDetailScreen />} />
          <Route
            path="/searches/:id/criteria"
            element={<div>Criteria (stub)</div>}
          />
          <Route path="/searches/:id/inbox" element={<div>Inbox (stub)</div>} />
          <Route
            path="/searches/:id/shortlist"
            element={<div>Shortlist (stub)</div>}
          />
          <Route
            path="/searches/:id/applications"
            element={<div>Applications (stub)</div>}
          />
        </Routes>
      </MemoryRouter>
    ),
  ],
}

/** Not-found state: ResourceError panel with back link. */
export const NotFound: Story = {
  decorators: [
    () => (
      <MemoryRouter initialEntries={["/searches/does-not-exist-9999"]}>
        <Routes>
          <Route path="/searches/:id" element={<SearchDetailScreen />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
}
