import { describe, expect, it } from "vitest"
import { MockApiError } from "./mock-api-error"

describe("MockApiError", () => {
  it('exposes name = "MockApiError" for readable stack traces', () => {
    const err = MockApiError.notFound("applications/123")
    expect(err.name).toBe("MockApiError")
  })

  it("is an instance of both MockApiError and Error", () => {
    const err = MockApiError.notFound("applications/123")
    expect(err).toBeInstanceOf(MockApiError)
    expect(err).toBeInstanceOf(Error)
  })

  it("notFound() builds a not_found error with the path retained", () => {
    const err = MockApiError.notFound("applications/missing")
    expect(err.kind).toBe("not_found")
    expect(err.path).toBe("applications/missing")
  })

  it("unauthorized() builds an unauthorized error", () => {
    const err = MockApiError.unauthorized("settings")
    expect(err.kind).toBe("unauthorized")
    expect(err.path).toBe("settings")
  })

  it("rateLimited() builds a rate_limited error", () => {
    const err = MockApiError.rateLimited("applications")
    expect(err.kind).toBe("rate_limited")
    expect(err.path).toBe("applications")
  })

  it("network() builds a network error", () => {
    const err = MockApiError.network("agents")
    expect(err.kind).toBe("network")
    expect(err.path).toBe("agents")
  })

  it("unknown() builds an unknown error and threads the cause through", () => {
    const cause = new Error("underlying boom")
    const err = MockApiError.unknown("resumes", cause)
    expect(err.kind).toBe("unknown")
    expect(err.path).toBe("resumes")
    expect(err.cause).toBe(cause)
  })
})
