/**
 * The cumulative founder journey (sprint-02 AC-04/AC-05, extended every
 * implementation sprint; Gate 0.1 verifies it, never discovers it).
 *
 * Sprint-02 segment: LOGIN through the real form -> manually capture a job
 * with per-run unique content -> the job appears in the /jobs default list
 * (network-asserted to be served by DB-backed GET /api/v1/jobs, PIN-8) ->
 * survives a reload -> its detail page renders via DB-backed getJob.
 *
 * Runs serially in one worker: the steps are one story, and the second
 * login of the run (global-setup did the first) stays under the per-account
 * throttle only if we don't multiply it per worker.
 */

import { expect, type Page, test } from "@playwright/test"
import { envVal } from "./auth"

test.describe.configure({ mode: "serial" })

// Unique per run -- discriminates the created job from every seeded fixture
// (the seed ships Stripe/Linear/Sentry etc.; nothing ships this string).
const RUN_TAG = `${Date.now()}`
const COMPANY = `E2E Journey Co ${RUN_TAG}`
const ROLE = `Journey Engineer ${RUN_TAG}`

const JOBS_API = /\/api\/v1\/jobs$/

async function gotoJobsAndWaitForApi(page: Page): Promise<void> {
  const jobsResponse = page.waitForResponse(
    (r) => JOBS_API.test(r.url()) && r.request().method() === "GET",
  )
  await page.goto("/jobs")
  expect((await jobsResponse).status()).toBe(200)
}

test("login -> create job -> lists + persists -> shortlist -> shortlist lists", async ({
  page,
}) => {
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
})
