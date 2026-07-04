import { afterEach, describe, expect, it, vi } from "vitest"

// Mock latency so api calls don't pay the 100-400ms cost during tests.
vi.mock("@/lib/latency", () => ({
  simulateLatency: () => Promise.resolve(),
  getLatencyRange: () => [0, 0] as const,
}))

import { MockApiError } from "../lib/mock-api-error"
import {
  getAgent,
  getAgentLog,
  getAgents,
  getApplication,
  getApplications,
  getCoachThread,
  getCoachThreads,
  getCurrentUser,
  getExtensionState,
  getJobsInbox,
  getMatchReport,
  getNotifications,
  getResume,
  getResumes,
  getSearch,
  getSearches,
  getSettings,
  getShortlist,
  getUserMenu,
  saveResumeBody,
} from "./api"
import { RESUME_ID_DISTRIBUTED } from "./fixtures"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("mock api · success paths", () => {
  it("getCurrentUser returns the REMY fixture", async () => {
    const user = await getCurrentUser()
    expect(user.name).toBe("Wes Gilleland")
    expect(user.target_titles).toContain("Staff Engineer")
  })

  it("getApplications returns the APPS list (joined view)", async () => {
    const apps = await getApplications()
    expect(apps).toHaveLength(14)
    // ADR-006 stage 3: ids are UUIDs; the joined view exposes the posting fields.
    expect(apps[0]?.company).toBe("Stripe")
    expect(apps[0]?.id).not.toBe("stripe")
    expect(apps[0]?.jobId).toBeTruthy()
  })

  it("getApplication(id) finds by id", async () => {
    const app = await getApplication("vercel")
    expect(app.company).toBe("Vercel")
  })

  it("getShortlist returns SHORTLIST_DATA", async () => {
    const list = await getShortlist()
    expect(list[0]?.company).toBe("Stripe")
  })

  it("getShortlist accepts an optional searchId (currently ignored)", async () => {
    const list = await getShortlist("any-search-id")
    expect(list).toHaveLength(6)
  })

  it("getJobsInbox returns JOBS_INBOX", async () => {
    const inbox = await getJobsInbox()
    expect(inbox).toHaveLength(7)
    expect(inbox[0]?.company).toBe("Stripe")
    expect(inbox[0]?.source).toBe("greenhouse")
  })

  it("getAgents returns AGENTS_DATA", async () => {
    const agents = await getAgents()
    expect(agents).toHaveLength(3)
  })

  it("getAgent(id) finds by id", async () => {
    const agent = await getAgent("stale")
    expect(agent.name).toBe("Stale-detector")
  })

  it("getAgentLog returns all entries when no filter is provided", async () => {
    const log = await getAgentLog()
    expect(log).toHaveLength(6)
  })

  it("getAgentLog filters by agentId", async () => {
    const log = await getAgentLog({ agentId: "stale" })
    expect(log.every((e) => e.agentId === "stale")).toBe(true)
    expect(log.length).toBeGreaterThan(0)
  })

  it("getAgentLog filters by kind", async () => {
    const log = await getAgentLog({ kind: "await" })
    expect(log.every((e) => e.kind === "await")).toBe(true)
  })

  it("getAgentLog can stack agentId + kind", async () => {
    const log = await getAgentLog({ agentId: "coach", kind: "await" })
    expect(log).toHaveLength(1)
  })

  it("getResumes returns RESUMES", async () => {
    const resumes = await getResumes()
    expect(resumes[0]?.tag).toBe("MASTER")
  })

  it("getResume by name", async () => {
    const r = await getResume("Distributed-systems")
    expect(r.tag).toBe("DEFAULT")
  })

  it("getResume by index", async () => {
    const r = await getResume(0)
    expect(r.name).toBe("Master")
  })

  it("saveResumeBody persists the edited HTML body (RES-022)", async () => {
    const before = await getResume(RESUME_ID_DISTRIBUTED)
    const html = "<p>Edited <strong>summary</strong> with a list.</p>"
    const saved = await saveResumeBody(before.id, html)
    expect(saved.body).toBe(html)
    // Round-trips: a fresh read returns the persisted body within the session.
    const after = await getResume(before.id)
    expect(after.body).toBe(html)
  })

  it("saveResumeBody throws notFound for an unknown id", async () => {
    await expect(saveResumeBody("nope-404", "<p>x</p>")).rejects.toMatchObject({
      kind: "not_found",
    })
  })

  it("getMatchReport returns the canonical fixture, threading args through", async () => {
    const report = await getMatchReport({ resumeId: "r1", jobId: "stripe" })
    expect(report.score).toBe(92)
    expect(report.resumeId).toBe("r1")
    expect(report.jobId).toBe("stripe")
    expect(report.rubric.length).toBeGreaterThan(0)
    expect(report.gaps.length).toBeGreaterThan(0)
    expect(report.strengths.length).toBeGreaterThan(0)
  })

  it("getCoachThreads returns the thread list", async () => {
    const threads = await getCoachThreads()
    expect(threads).toHaveLength(5)
  })

  it("getCoachThread returns thread + messages + context for the active thread", async () => {
    const data = await getCoachThread("stripe-followup")
    expect(data.thread.id).toBe("stripe-followup")
    expect(data.messages.length).toBeGreaterThan(0)
    expect(data.context.length).toBeGreaterThan(0)
  })

  it("getCoachThread returns empty messages for non-active threads", async () => {
    const data = await getCoachThread("general")
    expect(data.messages).toHaveLength(0)
    expect(data.context.length).toBeGreaterThan(0)
  })

  it("getNotifications returns the notification list", async () => {
    const list = await getNotifications()
    expect(list[0]?.kind).toBe("reply")
  })

  it("getUserMenu returns the static menu-row config", async () => {
    const rows = await getUserMenu()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map((r) => r.label)).toContain("Settings")
  })

  it("getSearches returns the saved-search list (3 entries)", async () => {
    const searches = await getSearches()
    expect(searches).toHaveLength(3)
    // UUID-shaped ids per Phase 9 fix; assert shape not values.
    expect(searches.every((s) => /^[0-9a-f-]{36}$/i.test(s.id))).toBe(true)
  })

  it("getSearch finds by id", async () => {
    const list = await getSearches()
    const search = await getSearch(list[0].id)
    expect(search.name).toBe("Staff / Principal - Platform - remote")
  })

  it("getSettings returns a full settings bundle", async () => {
    const settings = await getSettings()
    expect(settings.profile.name).toBe("Wes Gilleland")
    expect(settings.integrations.length).toBeGreaterThan(0)
    expect(settings.providers.length).toBeGreaterThan(0)
    expect(settings.routing.length).toBeGreaterThan(0)
    expect(settings.usage.length).toBeGreaterThan(0)
    expect(settings.privacy.length).toBeGreaterThan(0)
    expect(settings.invoices.length).toBeGreaterThan(0)
    expect(settings.danger.length).toBeGreaterThan(0)
  })

  it("getExtensionState returns the matching popup state", async () => {
    const detected = await getExtensionState("detected")
    expect(detected.state).toBe("detected")
    expect(detected.recentCaptures).toHaveLength(0)

    const empty = await getExtensionState("empty")
    expect(empty.recentCaptures.length).toBeGreaterThan(0)
  })
})

describe("mock api · not-found errors", () => {
  it("getApplication throws notFound for unknown id", async () => {
    await expect(getApplication("does-not-exist")).rejects.toMatchObject({
      name: "MockApiError",
      kind: "not_found",
    })
  })

  it("getAgent throws notFound for unknown id", async () => {
    await expect(getAgent("mystery")).rejects.toBeInstanceOf(MockApiError)
  })

  it("getResume throws notFound for unknown name", async () => {
    await expect(getResume("Unknown Résumé")).rejects.toMatchObject({
      kind: "not_found",
    })
  })

  it("getResume throws notFound for out-of-range index", async () => {
    await expect(getResume(999)).rejects.toMatchObject({ kind: "not_found" })
  })

  it("getCoachThread throws notFound for unknown id", async () => {
    await expect(getCoachThread("not-a-thread")).rejects.toMatchObject({
      kind: "not_found",
    })
  })

  it("getSearch throws notFound for unknown id", async () => {
    await expect(getSearch("search:unknown")).rejects.toMatchObject({
      kind: "not_found",
    })
  })

  it("getExtensionState throws notFound for unknown state", async () => {
    // @ts-expect-error — exercising the runtime guard, not the type
    await expect(getExtensionState("exploded")).rejects.toMatchObject({
      kind: "not_found",
    })
  })
})

describe("mock api · env failure injection (VITE_MOCK_FAIL)", () => {
  it("applications:rate_limited surfaces a rate_limited MockApiError", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "applications:rate_limited")
    await expect(getApplications()).rejects.toMatchObject({
      name: "MockApiError",
      kind: "rate_limited",
      path: "applications",
    })
  })

  it("agents:unauthorized surfaces an unauthorized error", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "agents:unauthorized")
    await expect(getAgents()).rejects.toMatchObject({ kind: "unauthorized" })
  })

  it("coach/threads:network surfaces a network error", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "coach/threads:network")
    await expect(getCoachThreads()).rejects.toMatchObject({ kind: "network" })
  })

  it("multiple failures can be configured at once", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "applications:rate_limited,agents:network")
    await expect(getApplications()).rejects.toMatchObject({
      kind: "rate_limited",
    })
    await expect(getAgents()).rejects.toMatchObject({ kind: "network" })
  })

  it("does not fire for paths that do not match", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "applications:rate_limited")
    await expect(getResumes()).resolves.toBeDefined()
  })

  it("ignores entries with unknown kinds", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "applications:teapot")
    await expect(getApplications()).resolves.toBeDefined()
  })

  it("settings:unknown surfaces an unknown error", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "settings:unknown")
    await expect(getSettings()).rejects.toMatchObject({ kind: "unknown" })
  })

  it("notifications:not_found surfaces a not_found error", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "notifications:not_found")
    await expect(getNotifications()).rejects.toMatchObject({
      kind: "not_found",
    })
  })

  it("ignores malformed entries (no colon)", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", "applications,settings:unknown")
    await expect(getApplications()).resolves.toBeDefined()
    await expect(getSettings()).rejects.toMatchObject({ kind: "unknown" })
  })

  it("ignores empty / whitespace entries", async () => {
    vi.stubEnv("VITE_MOCK_FAIL", " , ,applications:rate_limited")
    await expect(getApplications()).rejects.toMatchObject({
      kind: "rate_limited",
    })
  })
})
