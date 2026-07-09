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
 *   - `/applications/:id` (+ /won)   -> first seeded application (API fetch)
 *   - `/searches/:id` (and nested)   -> `SEARCH_ID_PLATFORM`
 *   - `/agents/:id`                  -> first seeded agent (API fetch)
 *   - `/jobs/:id`                    -> `JOB_ID_STRIPE`
 */

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"
import { JOB_ID_STRIPE, SEARCH_ID_PLATFORM } from "../src/data/fixtures"
import { ROUTES, type Route } from "../src/routes"

const SKIP_GROUPS = new Set(["Onboarding & auth", "Dev"])

// ---------------------------------------------------------------------------
// Auth: the app redirects unauthenticated visitors to /login (the data seam
// clears the token and bounces on 401), so every smoke route needs a real
// JWT in localStorage before first paint. Log in once via the API as the
// seeded FIRST_SUPERUSER and inject the token via addInitScript.
// ---------------------------------------------------------------------------

const API_ROOT = process.env.VITE_API_URL ?? "http://localhost:8000"

function envVal(key: string): string {
  const fromProcess = process.env[key]
  if (fromProcess) {
    return fromProcess
  }
  const specDir = dirname(fileURLToPath(import.meta.url))
  const env = readFileSync(resolve(specDir, "../../.env"), "utf-8")
  const line = env.split("\n").find((l) => l.startsWith(`${key}=`))
  if (!line) {
    throw new Error(`${key} not set and not found in ../.env`)
  }
  return line.slice(key.length + 1).trim()
}

let tokenPromise: Promise<string> | undefined
function getAccessToken(): Promise<string> {
  tokenPromise ??= (async () => {
    const res = await fetch(`${API_ROOT}/api/v1/login/access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: envVal("FIRST_SUPERUSER"),
        password: envVal("FIRST_SUPERUSER_PASSWORD"),
      }).toString(),
    })
    if (!res.ok) {
      throw new Error(`smoke-suite login failed: ${res.status}`)
    }
    const body = (await res.json()) as { access_token: string }
    return body.access_token
  })()
  return tokenPromise
}

test.beforeEach(async ({ page }) => {
  const token = await getAccessToken()
  await page.addInitScript((t) => {
    localStorage.setItem("access_token", t)
  }, token)
})

// ---------------------------------------------------------------------------
// Fixture ids: the mock backend's id-addressed routes take UUIDs (FastAPI
// 422s on anything else), and application/agent seed UUIDs live server-side
// only. Fetch the first seeded id per resource once, like the real app does.
// Job/search ids are frontend fixture constants already.
// ---------------------------------------------------------------------------

let fixtureIdsPromise: Promise<{ app: string; agent: string }> | undefined
function getFixtureIds(): Promise<{ app: string; agent: string }> {
  fixtureIdsPromise ??= (async () => {
    const [apps, agents] = await Promise.all([
      fetch(`${API_ROOT}/api/v1/applications`).then(
        (r) => r.json() as Promise<{ id: string }[]>,
      ),
      fetch(`${API_ROOT}/api/v1/agents`).then(
        (r) => r.json() as Promise<{ id: string }[]>,
      ),
    ])
    const app = apps[0]?.id
    const agent = agents[0]?.id
    if (!app || !agent) {
      throw new Error("smoke-suite fixture fetch returned no seeded rows")
    }
    return { app, agent }
  })()
  return fixtureIdsPromise
}

/** Substitute `:id` for a real fixture id based on the route's namespace. */
async function resolvePath(route: Route): Promise<string> {
  if (!route.path.includes(":")) {
    return route.path
  }
  if (route.path.startsWith("/applications/")) {
    return route.path.replace(/:[\w]+/g, (await getFixtureIds()).app)
  }
  if (route.path.startsWith("/searches/")) {
    return route.path.replace(/:[\w]+/g, SEARCH_ID_PLATFORM)
  }
  if (route.path.startsWith("/agents/")) {
    return route.path.replace(/:[\w]+/g, (await getFixtureIds()).agent)
  }
  if (route.path.startsWith("/jobs/")) {
    return route.path.replace(/:[\w]+/g, JOB_ID_STRIPE)
  }
  return route.path.replace(/:[\w]+/g, "1")
}

const SMOKE_ROUTES = ROUTES.filter(
  (r) => !SKIP_GROUPS.has(r.group ?? "") && r.id !== "mark-won",
)

test.describe("smoke: every route renders", () => {
  for (const route of SMOKE_ROUTES) {
    test(`${route.id} (${route.path})`, async ({ page }) => {
      const resolved = await resolvePath(route)
      const consoleErrors: string[] = []
      page.on("console", (msg) => {
        // ERR_NETWORK_CHANGED is local interface-flap noise (docker/VPN),
        // not an application error -- filter it, keep everything else.
        if (
          msg.type() === "error" &&
          !msg.text().includes("ERR_NETWORK_CHANGED")
        ) {
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
