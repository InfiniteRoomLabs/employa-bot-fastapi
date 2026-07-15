/**
 * The cumulative founder journey (sprint-02 AC-04/AC-05, extended every
 * implementation sprint; Gate 0.1 verifies it, never discovers it).
 *
 * Sprint-02 segment: LOGIN through the real form -> manually capture a job
 * with per-run unique content -> the job appears in the /jobs default list
 * (network-asserted to be served by DB-backed GET /api/v1/jobs, PIN-8) ->
 * survives a reload -> its detail page renders via DB-backed getJob.
 *
 * Sprint-04 3c segment (AC-09, conjunct 7): the capture step's created
 * application (drafting) -> lists on the DB-backed applications tracker ->
 * legal transition to APPLIED (resumeId required, locks the seeded DEFAULT
 * "Distributed-systems" resume) -> one illegal transition rejected
 * (invalid_transition) -> the locked resume refuses delete (conflict,
 * AC-07a) -> the materialized submitted-resume snapshot is visible via the
 * API and the application-detail UI. The in-screen "move stage" quick
 * actions (ApplicationsScreen.handleMoveNext/AppDetailScreen's stage
 * tracker) are local-only mock state -- neither calls POST /transitions --
 * so the persisted lifecycle is driven directly via `page.request` carrying
 * the same Authorization bearer the real login form stored in
 * localStorage (data/api.ts TOKEN_KEY), and the UI is asserted via
 * reload/navigation after each mutation.
 *
 * Runs serially in one worker: the steps are one story, and the second
 * login of the run (global-setup did the first) stays under the per-account
 * throttle only if we don't multiply it per worker.
 */

import { expect, type Page, test } from "@playwright/test"
import { API_ROOT, envVal } from "./auth"

test.describe.configure({ mode: "serial" })

// Unique per run -- discriminates the created job from every seeded fixture
// (the seed ships Stripe/Linear/Sentry etc.; nothing ships this string).
const RUN_TAG = `${Date.now()}`
const COMPANY = `E2E Journey Co ${RUN_TAG}`
const ROLE = `Journey Engineer ${RUN_TAG}`

const JOBS_API = /\/api\/v1\/jobs$/
const APPLICATIONS_API = /\/api\/v1\/applications$/

async function gotoJobsAndWaitForApi(page: Page): Promise<void> {
  const jobsResponse = page.waitForResponse(
    (r) => JOBS_API.test(r.url()) && r.request().method() === "GET",
  )
  await page.goto("/jobs")
  expect((await jobsResponse).status()).toBe(200)
}

async function gotoApplicationsAndWaitForApi(page: Page): Promise<void> {
  const appsResponse = page.waitForResponse(
    (r) => APPLICATIONS_API.test(r.url()) && r.request().method() === "GET",
  )
  await page.goto("/applications")
  expect((await appsResponse).status()).toBe(200)
}

/**
 * The bearer token the real login form stored (data/api.ts TOKEN_KEY),
 * reused so `page.request` calls hit the DB-backed API as the same demo
 * tenant the UI is authenticated as.
 */
async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  if (!token) {
    throw new Error(
      "access_token missing from localStorage -- login must run first",
    )
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
}

test("login -> create job -> lists + persists -> shortlist -> shortlist lists", async ({
  page,
}) => {
  // The sprint-04 3c extension added a dozen-plus sequential page.request
  // round-trips and page navigations to this one cumulative journey; under
  // the full suite's parallel load (4 workers sharing this machine) that
  // comfortably outran Playwright's 30s default per-test timeout even
  // though the test finishes in ~17-19s solo. Budget generously rather than
  // race the default.
  test.setTimeout(90_000)

  // --- Login through the real form (no token injection). The DEMO user
  // (same tenant the smoke suite authenticates as, owns the seeded jobs);
  // creds carry fallbacks so the run never depends on a repo-root .env that
  // the CI Playwright container does not have. ----------------------------
  await page.goto("/login")
  await page
    .locator('input[type="email"]')
    .fill(envVal("SEED_DEMO_EMAIL", "wes.gilleland@gmail.com"))
  await page
    .locator('input[type="password"]')
    .fill(envVal("SEED_DEMO_PASSWORD", "employa-demo-1"))
  await page.getByRole("button", { name: /log in/i }).click()
  await page.waitForURL("**/dashboard")

  // --- The unique job does not exist yet (fresh-seed discriminator). ------
  await gotoJobsAndWaitForApi(page)
  await expect(page.getByText(COMPANY)).toHaveCount(0)

  // --- Manual capture: wizard -> editable review -> save. -----------------
  await page
    .getByRole("button", { name: /add a job/i })
    .first()
    .click()
  await page.waitForURL("**/applications/new")
  await page.getByRole("button", { name: /^fetch/i }).click()
  await page.locator('input[name="company"]').fill(COMPANY)
  await page.locator('input[name="role"]').fill(ROLE)

  const createResponse = page.waitForResponse(
    (r) =>
      /\/api\/v1\/applications$/.test(r.url()) &&
      r.request().method() === "POST",
  )
  await page.getByRole("button", { name: /save & open/i }).click()
  const created = await createResponse
  expect(created.status()).toBe(201)
  const createdBody = (await created.json()) as {
    id: string
    jobId: string
    company: string
  }
  expect(createdBody.company).toBe(COMPANY)
  await page.waitForURL("**/applications/*")

  // --- The created job lists on the getJobs-backed default view. ----------
  await gotoJobsAndWaitForApi(page)
  await expect(page.getByText(COMPANY).first()).toBeVisible()

  // --- And persists across a reload (served from the database). -----------
  const reloadResponse = page.waitForResponse(
    (r) => JOBS_API.test(r.url()) && r.request().method() === "GET",
  )
  await page.reload()
  expect((await reloadResponse).status()).toBe(200)
  await expect(page.getByText(COMPANY).first()).toBeVisible()

  // --- Detail page renders the row via DB-backed getJob. ------------------
  await page.goto(`/jobs/${createdBody.jobId}`)
  await expect(page.getByText(ROLE).first()).toBeVisible()

  // --- Sprint-03: add the created job to the shortlist and assert it lists.
  // Select the created job's row (makes it the active detail pane), then
  // shortlist it. The POST must carry the created jobId so the shortlist
  // entry composite-FKs the job (PIN-5). ----------------------------------
  await gotoJobsAndWaitForApi(page)
  await page.getByText(COMPANY).first().click()
  const shortlistPost = page.waitForResponse(
    (r) =>
      /\/api\/v1\/shortlist$/.test(r.url()) && r.request().method() === "POST",
  )
  await page.getByRole("button", { name: /\+ shortlist/i }).click()
  const slResp = await shortlistPost
  expect(slResp.status()).toBe(201)
  const slBody = (await slResp.json()) as { jobId: string }
  expect(slBody.jobId).toBe(createdBody.jobId)

  // --- The shortlisted job lists on the DB-backed /shortlist view. --------
  const shortlistGet = page.waitForResponse(
    (r) =>
      /\/api\/v1\/shortlist(\?|$)/.test(r.url()) &&
      r.request().method() === "GET",
  )
  await page.goto("/shortlist")
  expect((await shortlistGet).status()).toBe(200)
  await expect(page.getByText(COMPANY).first()).toBeVisible()

  // ===========================================================================
  // Sprint-04 3c: applications/tracker extension (AC-09, conjunct 7)
  // ===========================================================================

  const APP_ID = createdBody.id
  const headers = await authHeaders(page)

  // --- The created application (drafting) lists on the DB-backed tracker. --
  await gotoApplicationsAndWaitForApi(page)
  await expect(page.getByText(COMPANY).first()).toBeVisible()

  // --- APPLIED requires a resumeId; use the seeded DEFAULT resume every
  // fixture application's applied-hop locks (PIN-15, "Distributed-systems").
  const resumesResp = await page.request.get(`${API_ROOT}/api/v1/resumes`, {
    headers,
  })
  expect(resumesResp.status()).toBe(200)
  const resumes = (await resumesResp.json()) as {
    id: string
    name: string
    tag: string
  }[]
  const defaultResume = resumes.find((r) => r.tag === "DEFAULT")
  if (!defaultResume) {
    throw new Error("seed fixture missing: no DEFAULT-tagged resume")
  }

  // --- Legal transition: drafting -> applied (version 1 -> 2). -------------
  const appliedResp = await page.request.post(
    `${API_ROOT}/api/v1/applications/${APP_ID}/transitions`,
    {
      headers,
      data: {
        targetStage: "applied",
        expectedVersion: 1,
        source: "user",
        resumeId: defaultResume.id,
      },
    },
  )
  expect(appliedResp.status()).toBe(200)
  const appliedBody = (await appliedResp.json()) as {
    application: {
      stage: string
      version: number
      submittedSnapshotId: string | null
    }
    transition: { fromStage: string | null; toStage: string }
  }
  expect(appliedBody.application.stage).toBe("applied")
  expect(appliedBody.application.submittedSnapshotId).toBeTruthy()
  expect(appliedBody.transition.fromStage).toBe("drafting")
  const SUBMITTED_SNAPSHOT_ID = appliedBody.application
    .submittedSnapshotId as string
  const appVersion = appliedBody.application.version // 2 after the applied hop

  // --- The UI reflects the persisted transition after navigating fresh: the
  // detail screen's résumé fact card flips to "locked (applied)". -----------
  const detailGet = page.waitForResponse(
    (r) =>
      new RegExp(`/api/v1/applications/${APP_ID}$`).test(r.url()) &&
      r.request().method() === "GET",
  )
  await page.goto(`/applications/${APP_ID}`)
  expect((await detailGet).status()).toBe(200)
  await expect(page.getByText("locked (applied)")).toBeVisible()

  // --- ONE illegal transition rejected: applied -> offer skips screening/
  // interview (LEGAL_TRANSITIONS, applications.py) -> 422 invalid_transition.
  const illegalResp = await page.request.post(
    `${API_ROOT}/api/v1/applications/${APP_ID}/transitions`,
    {
      headers,
      data: {
        targetStage: "offer",
        expectedVersion: appVersion,
        source: "user",
      },
    },
  )
  expect(illegalResp.status()).toBe(422)
  const illegalBody = (await illegalResp.json()) as { kind: string }
  expect(illegalBody.kind).toBe("invalid_transition")

  // --- Still applied via a fresh GET (the rejected attempt did not mutate).
  const freshGet = await page.request.get(
    `${API_ROOT}/api/v1/applications/${APP_ID}`,
    { headers },
  )
  expect(freshGet.status()).toBe(200)
  const freshBody = (await freshGet.json()) as {
    stage: string
    version: number
  }
  expect(freshBody.stage).toBe("applied")
  expect(freshBody.version).toBe(appVersion)

  // --- Resume locked (AC-07a): DELETE the DEFAULT resume it just locked. ---
  const deleteResp = await page.request.delete(
    `${API_ROOT}/api/v1/resumes/${defaultResume.id}`,
    { headers },
  )
  expect(deleteResp.status()).toBe(409)
  const deleteBody = (await deleteResp.json()) as { kind: string }
  expect(deleteBody.kind).toBe("conflict")

  // --- Best-effort UI lock indication: the Resumes screen's own Delete
  // button hits the same 409 and the resume is never removed from view. -----
  const resumesDeleteResp = page.waitForResponse(
    (r) =>
      new RegExp(`/api/v1/resumes/${defaultResume.id}$`).test(r.url()) &&
      r.request().method() === "DELETE",
  )
  await page.goto("/resumes")
  await expect(page.getByText("Distributed-systems").first()).toBeVisible()
  await page
    .getByRole("button", { name: `Delete ${defaultResume.name}` })
    .click()
  expect((await resumesDeleteResp).status()).toBe(409)
  await expect(page.getByText("Cannot delete")).toBeVisible()
  await expect(page.getByText("Distributed-systems").first()).toBeVisible()

  // --- Snapshot visible (load-bearing: discriminates the REAL materialized
  // row from on-the-fly synthesis -- PIN-2 vs. the retired DEBT-5 fallback).
  const snapshotResp = await page.request.get(
    `${API_ROOT}/api/v1/applications/${APP_ID}/snapshot`,
    { headers },
  )
  expect(snapshotResp.status()).toBe(200)
  const snapshotBody = (await snapshotResp.json()) as { id: string }
  expect(snapshotBody.id).toBe(SUBMITTED_SNAPSHOT_ID)

  // --- And the UI renders the same submitted copy on the application detail.
  await page.goto(`/applications/${APP_ID}`)
  await page.getByRole("button", { name: /view submitted copy/i }).click()
  await expect(
    page.getByRole("dialog").getByText("Distributed-systems"),
  ).toBeVisible()
})
