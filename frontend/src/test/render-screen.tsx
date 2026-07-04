/**
 * Wrapper around `@testing-library/react`'s `render` used by every screen
 * test. Mounts the UI inside `<MemoryRouter>` so screens that call
 * `useParams`, `useLocation`, or render `<Link>` work without each test
 * spinning up its own router.
 *
 * Pass `initialEntries` (and optionally `initialIndex`) to drive a screen
 * with a specific URL - useful for `:id`-bound screens (app-detail,
 * search-detail, agent-detail). Defaults to `['/']`.
 *
 * Screens consume async hooks, so prefer `findByX` over `getByX` in tests.
 * `vitest.config.ts` pins `VITE_MOCK_LATENCY_MIN/MAX=0` so the wait window
 * is bounded by react-state-update rather than a real timer.
 */

import { type RenderOptions, render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom"

export interface RenderScreenOptions extends RenderOptions {
  /**
   * URL history stack for `MemoryRouter`. Drives `useParams`/`useLocation`
   * results inside the screen. Defaults to `['/']`.
   */
  initialEntries?: MemoryRouterProps["initialEntries"]
  initialIndex?: MemoryRouterProps["initialIndex"]
}

export function renderScreen(
  ui: ReactElement,
  options: RenderScreenOptions = {},
) {
  const { initialEntries = ["/"], initialIndex, ...rest } = options
  return render(ui, {
    ...rest,
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
        {children}
      </MemoryRouter>
    ),
  })
}
