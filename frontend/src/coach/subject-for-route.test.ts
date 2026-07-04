import { describe, expect, it } from "vitest"
import { subjectForRoute } from "./subject-for-route"

describe("subjectForRoute", () => {
  it("maps a resume route to the résumé scope", () => {
    expect(subjectForRoute("/resumes").scope).toBe("résumé")
  })

  it("maps an application detail route (with :id) to the application scope", () => {
    expect(subjectForRoute("/applications/some-id").scope).toBe("application")
  })

  it("maps library artifact routes to their subject scope", () => {
    expect(subjectForRoute("/library/contacts").scope).toBe("contact")
    expect(subjectForRoute("/library/answers").scope).toBe("answer")
    expect(subjectForRoute("/library/projects").scope).toBe("project")
  })

  it("falls back to general for unknown routes", () => {
    expect(subjectForRoute("/totally/unknown/path").scope).toBe("general")
  })
})
