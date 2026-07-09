/**
 * Adapter integration test -- runs the REAL HTTP adapter against the running
 * mock API backend. Gated: only executes when RUN_ADAPTER_IT=1 and the
 * backend is up on :8000 (from backend/: `uv run uvicorn app.main:app --port 8000`).
 *
 *   RUN_ADAPTER_IT=1 bun run test src/data/adapter.integration.test.ts
 *
 * This replaces the wire-level coverage of the retired mock-data-layer tests
 * (see the exclusion block in vitest.config.ts).
 */
import { beforeAll, describe, expect, it, vi } from "vitest"

import { MockApiError } from "@/lib/mock-api-error"

const BACKEND = process.env.ADAPTER_IT_URL ?? "http://localhost:8000"
const RUN = process.env.RUN_ADAPTER_IT === "1"

const SEARCH_ID_PLATFORM = "7c0b1f3a-2d4e-4a8c-9b21-1f8c5e3a0d12"
const SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"
const SEARCH_ID_AI_INFRA = "ad9e6c14-5b80-4f17-a3d2-7e6f9c1b0a55"

type Api = typeof import("./api")

describe.skipIf(!RUN)("HTTP adapter against live mock API backend", () => {
  let api: Api

  beforeAll(async () => {
    // API_ROOT is resolved at module load, so stub the env BEFORE importing.
    vi.stubEnv("VITE_API_URL", BACKEND)
    api = await import("./api")
    // Pristine store for deterministic assertions if the backend exposes no
    // reset endpoint: assume a freshly started backend (documented above).
  })

  it("getSearches returns the three seeded well-known searches", async () => {
    const searches = await api.getSearches()
    const ids = searches.map((s) => s.id)
    expect(ids).toContain(SEARCH_ID_PLATFORM)
    expect(ids).toContain(SEARCH_ID_BACKEND)
    expect(ids).toContain(SEARCH_ID_AI_INFRA)
    expect(searches.length).toBe(3)
  })

  it("getApplications returns joined views with job data", async () => {
    const apps = await api.getApplications()
    expect(apps.length).toBeGreaterThan(0)
    const first = apps[0]
    expect(first.job).toBeTruthy()
    expect(typeof first.company).toBe("string")
    expect(first.company.length).toBeGreaterThan(0)
    expect(typeof first.stage).toBe("string")
  })

  it("transitionApplication round-trips and bumps the version", async () => {
    const apps = await api.getApplications()
    const drafting = apps.find((a) => a.stage === "draft")
    expect(drafting, "need a seeded application in stage 'draft'").toBeTruthy()
    const id = (drafting as (typeof apps)[number]).id

    const wireBefore = (await (
      await fetch(`${BACKEND}/api/v1/applications/${id}`)
    ).json()) as { version: number }

    // drafting -> applied also exercises the resumeId-required rule and the
    // resume-snapshot side effect.
    const result = await api.transitionApplication(id, {
      targetStage: "applied",
      expectedVersion: wireBefore.version,
      source: "user",
      resumeId: "c1a7e2b0-4d31-4f86-9a52-0b6d3e7f1c84",
    })
    expect(result.application.stage).toBe("applied")
    expect(result.transition.toStage).toBe("applied")

    const wireAfter = (await (
      await fetch(`${BACKEND}/api/v1/applications/${id}`)
    ).json()) as { version: number }
    expect(wireAfter.version).toBe(wireBefore.version + 1)
  })

  it("translates a backend 404 into MockApiError not_found", async () => {
    const missing = "00000000-0000-4000-8000-000000000000"
    await expect(api.getApplication(missing)).rejects.toSatisfy(
      (e: unknown) => {
        expect(e).toBeInstanceOf(MockApiError)
        expect((e as MockApiError).kind).toBe("not_found")
        return true
      },
    )
  })
})
