import { describe, expect, it } from "vitest"

import { idForPath, pathFor, ROUTES, routeFor } from "./routes"

// The picker IDs that must each map to a route. Sourced from
// `/tmp/employa-design/src/app.jsx` SCREENS list — the canonical
// design contract. Update here if the design ever adds a screen.
const REQUIRED_PICKER_IDS = [
  "onboarding",
  "register",
  "login",
  "dashboard",
  "applications",
  "app-detail",
  "add-app",
  "shortlist",
  "jobs",
  "search-criteria",
  "search-detail",
  "resumes",
  "match-explorer",
  "resume-editor",
  "coach",
  "agents",
  "agent-log",
  "agent-detail",
  "settings",
  "mark-won",
  "notifications",
  "user-menu",
  "extension",
  "toasts",
] as const

describe("ROUTES table", () => {
  it("covers every picker ID from the design", () => {
    const ids = new Set(ROUTES.map((r) => r.id))
    for (const required of REQUIRED_PICKER_IDS) {
      expect(ids, `missing route for picker id "${required}"`).toContain(
        required,
      )
    }
  })

  it("has unique picker IDs", () => {
    const ids = ROUTES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has unique paths", () => {
    const paths = ROUTES.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it("declares /applications/new before /applications/:id (static beats dynamic)", () => {
    const newIdx = ROUTES.findIndex((r) => r.path === "/applications/new")
    const detailIdx = ROUTES.findIndex((r) => r.path === "/applications/:id")
    expect(newIdx).toBeGreaterThanOrEqual(0)
    expect(detailIdx).toBeGreaterThanOrEqual(0)
    expect(newIdx).toBeLessThan(detailIdx)
  })

  it('every route paths starts with "/"', () => {
    for (const r of ROUTES) {
      expect(
        r.path.startsWith("/"),
        `route ${r.id} path "${r.path}" must start with /`,
      ).toBe(true)
    }
  })
})

describe("routeFor", () => {
  it("returns the matching route by ID", () => {
    expect(routeFor("dashboard").path).toBe("/dashboard")
    expect(routeFor("app-detail").path).toBe("/applications/:id")
  })

  it("throws for an unknown ID", () => {
    expect(() => routeFor("nope")).toThrow(/unknown route id/)
  })
})

describe("pathFor", () => {
  it("returns the path for a picker ID", () => {
    expect(pathFor("dashboard")).toBe("/dashboard")
    expect(pathFor("applications")).toBe("/applications")
    expect(pathFor("add-app")).toBe("/applications/new")
    expect(pathFor("agent-log")).toBe("/agents/log")
  })
})

describe("idForPath", () => {
  it("returns the ID for a static path", () => {
    expect(idForPath("/dashboard")).toBe("dashboard")
    expect(idForPath("/applications")).toBe("applications")
    expect(idForPath("/applications/new")).toBe("add-app")
    expect(idForPath("/agents/log")).toBe("agent-log")
  })

  it("returns the ID for a dynamic path", () => {
    expect(idForPath("/applications/stripe")).toBe("app-detail")
    expect(idForPath("/applications/stripe/won")).toBe("mark-won")
    expect(idForPath("/searches/platform")).toBe("search-detail")
    expect(idForPath("/agents/stale")).toBe("agent-detail")
  })

  it("prefers static segments over dynamic when both match", () => {
    // `/applications/new` must beat `/applications/:id`.
    expect(idForPath("/applications/new")).toBe("add-app")
    // `/agents/log` must beat `/agents/:id`.
    expect(idForPath("/agents/log")).toBe("agent-log")
  })

  it("returns undefined for unknown paths", () => {
    expect(idForPath("/does-not-exist")).toBeUndefined()
    expect(idForPath("/applications/stripe/extra/segments")).toBeUndefined()
  })
})
