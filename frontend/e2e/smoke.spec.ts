/**
 * Playwright smoke - iterates every route in `src/routes.ts` and asserts
 * the page renders without console errors and surfaces the AppFrame's
 * `data-screen-label` (the topbar title) for the resolved URL.
 * Runs against `pnpm preview` per Phase 10 of the spec.
 *
 * Skipped: auth, onboarding, `/dev/*` preview routes, and `mark-won`
 * (a stacked Dialog over `/applications/:id` — composed inline in
 * `src/App.tsx`, not a standalone screen with its own frame).
 *
 * Heading note: not every screen renders an `<h1>` — `Topbar` lays the
 * title out as a styled `<div>` and several screens (jobs, coach,
 * resume-editor) only render their `<h1>/<h2>` once the data hook
 * resolves. We assert the AppFrame mounted (`data-slot="app-frame"`)
 * + the topbar-title text is visible. That's stable across all
 * loading states and doesn't depend on a screen happening to use
 * `<PageHead>`.
 *
 * Dynamic-path routes substitute a known fixture id:
 *   - `/applications/:id`            -> `stripe`
 *   - `/applications/:id/won`        -> `stripe`
 *   - `/searches/:id` (and nested)   -> `SEARCH_ID_PLATFORM`
 *   - `/agents/:id`                  -> `stale`
 */

import { expect, test } from "@playwright/test"
import { SEARCH_ID_PLATFORM } from "../src/data/fixtures"
import { ROUTES, type Route } from "../src/routes"

const SKIP_GROUPS = new Set(["Onboarding & auth", "Dev"])

const FIXTURES = {
  app: "stripe",
  search: SEARCH_ID_PLATFORM,
  agent: "stale",
} as const

/** Substitute `:id` for a real fixture id based on the route's namespace. */
function resolvePath(route: Route): string {
  if (!route.path.includes(":")) {
    return route.path
  }
  if (route.path.startsWith("/applications/")) {
    return route.path.replace(/:[\w]+/g, FIXTURES.app)
  }
  if (route.path.startsWith("/searches/")) {
    return route.path.replace(/:[\w]+/g, FIXTURES.search)
  }
  if (route.path.startsWith("/agents/")) {
    return route.path.replace(/:[\w]+/g, FIXTURES.agent)
  }
  return route.path.replace(/:[\w]+/g, "1")
}

const SMOKE_ROUTES = ROUTES.filter(
  (r) => !SKIP_GROUPS.has(r.group ?? "") && r.id !== "mark-won",
)

test.describe("smoke: every route renders", () => {
  for (const route of SMOKE_ROUTES) {
    const resolved = resolvePath(route)
    test(`${route.id} (${resolved})`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text())
        }
      })
      page.on("pageerror", (err) => consoleErrors.push(err.message))

      const response = await page.goto(resolved)
      expect(response?.status(), `goto ${resolved}`).toBeLessThan(400)

      // AppFrame mount + topbar-title text. More stable than `<h1>`:
      // every smoke route flows through `AppFrame`, but content-area
      // headings only exist after the data hook resolves on a couple of
      // screens (jobs, coach, resume-editor).
      await expect(page.locator('[data-slot="app-frame"]')).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.locator(".app__topbar-title").first()).toBeVisible({
        timeout: 10_000,
      })

      expect(consoleErrors, `console errors at ${resolved}`).toEqual([])
    })
  }
})
