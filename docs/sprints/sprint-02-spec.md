# Sprint-02 spec -- B1 jobs, manual capture (run sprint-02-run-1)

Binding spec: plan v3 "Phase B" item 1 + "Design conventions (binding from the first migration)". Queue row: approved-queue.md rev 1, sprint-02. Run manifest: docs/progress.md sprint-02-run-1. This file freezes the phase mini-spec, mints AC IDs, dispositions the Codex D1 findings (thread 019f5da8-4c83-7f03-8c0c-7eae419b51eb, verdict UNSOUND -> all 14 dispositioned below), and charters the review panel.

## Investigation findings (S2, all verified against code)

- CONFIRMED: the jobs contract ops are read-only -- getJobs (mvp-api.yaml:465), getJobsInbox (:480), getJob (:499). The contract has NO job-create operation; manual capture is createApplication, whose contract description says "mints a Job for the posting" (mvp-api.yaml:111); ownership manifest line 121 names it "job capture (manual/paste) flow (ORI-014)".
- CONFIRMED: the mock createApplication (backend/app/api/routes/applications.py:212-252) mints a Job into store.jobs plus an ids-only Application at DRAFTING.
- CONFIRMED: the frontend jobs screen lists the INBOX (useJobsInbox); useJobs/getJobs has no screen consumer; /jobs/:id (job-detail screen) consumes getJob; the add-a-job flow navigates to /applications/new whose save posts a HARDCODED fixture payload (Stripe) to createApplication (frontend/src/screens/add-app/index.tsx:206-224).
- CONFIRMED: store.application_view (store.py:3541) joins store.jobs -- mock applications read job data from the store, with no DB session available in mock routes.
- CONFIRMED: inbox items carry jobId links into store.jobs' seeded fixed UUIDs (JOB_ID_STRIPE etc.); the jobs-screen row links to /jobs/{jobId} only when jobId is set.
- CONFIRMED: the app engine connects as POSTGRES_USER=postgres (superuser, table owner); app_runtime exists NOLOGIN with DML grants + default privileges (migration 075675058c67), exercised in tests via SET ROLE; the migration docstring reserves wiring the app onto it for "when the first DB vertical ships" -- this sprint.
- CONFIRMED: getJobsInbox's per-search views are keyed by MOCK search ids (store.JOBS_INBOX_BY_SEARCH); searches stay mock through Release 0.1 (v3: only journey entities become DB-backed).
- CONFIRMED: test world fixtures db/client/db_client/intruder_client/seed_domain exist (tests/conftest.py); migration gate patterns exist (tests/migrations/test_migration_gates.py); seed script seeds the demo user only, with "later sprints extend this to demo entities" (app/scripts/seed.py).
- CONFIRMED: the partial-unique dedup index is v3-named: B1 says "job table with the partial-unique dedup index reserved for later captureJob" (v3:75); Security #13 names "canonical-URL dedup" (v3:98).
- INFERRED: "the jobs contract operations" in the Done-when means the operations over the Job resource (getJobs, getJob -- both return Job). getJobsInbox returns the JobInboxItem projection fed by mock platform searches; DB-backing it would make DB rows depend on mock search ids -- exactly the cross-store seam v3's abandonment-safety rule forbids. See PIN-2; flagged to Codex in the D1 reply for confirmation.
- UNKNOWN (resolved at implementation): exact wording of compose/CI SEED_DEMO_DATA wiring for the e2e stack -- verified when core-journey lands.

## Pinned decisions (PINs)

- PIN-1 (capture path): createApplication's job-mint becomes the DB write path: it INSERTs the canonical `job` row (tenant = caller) AND keeps the store.jobs copy so every mock join (application_view, deep-score reads, resume fork) keeps working. createApplication's manifest status stays `planned` (it remains a mock op with a DB side effect; it flips in sprint-04). No DB row references mock data; mock applications referencing durable DB job ids is the safe direction (mock is ephemeral; the DB never dangles).
- PIN-2 (inbox stays mock; canonical-collection routing split -- amended per Codex D1 reply round): getJobs and getJob are the operations that flip to implemented; getJobsInbox remains `planned` (mock search-feed projection, outside the manual-capture gate) with an explicit manifest note -- its per-search views are keyed by mock search ids and searches stay mock through Release 0.1. The BROWSER routing splits accordingly: the jobs screen's DEFAULT view (no searchId -- the manual-capture collection at /jobs) consumes DB-backed getJobs (mapped to the existing row display); search-scoped views (/searches/:id) keep consuming the mock getJobsInbox. No DB row stores or references a mock search id. This closes the "mock inbox pretending to be the shipped jobs list" seam Codex named.
- PIN-3 (dedup index): `source_url text NULL` is normalized out of JobSource to a column (v3 JSONB convention: queryable/constrained fields become columns); the reserved index is `UNIQUE (user_id, source_url) WHERE source_url IS NOT NULL` named `uq_job_user_source_url`. URL canonicalization is captureJob's concern (Release 0.2, Security #13); manual captures without a URL are never deduped (NULL exempt).
- PIN-4 (JSONB CHECK depth): per the PO-recorded advisory default (approved-queue.md rev 1, sprint-02): named CHECKs assert json type + required keys + scalar types; enum-membership checks for the Employment axes and workMode; ranges only where v3 names them (none named for job). The v3 "wire-schema-vs-DB-constraint drift is a tested artifact" clause is honored via a round-trip test: every seeded/created DB row must validate through wire schemas.Job.
- PIN-5 (schema_version): `schema_version int NOT NULL DEFAULT 1 CHECK (schema_version >= 1)` rides the job row (it carries evolving JSONB documents).
- PIN-6 (NUMERIC money): the job table has no scalar money column -- compensation is JSONB Salary, which v3's JSONB convention names explicitly. The NUMERIC(10,6) convention is discharged as not-applicable-here with introspection evidence (no float/real/double column exists on job); the first real money column arrives with ai_run (sprint-05).
- PIN-7 (RLS mechanism, not vibes): policy `job_tenant_isolation` FOR ALL USING + WITH CHECK `user_id = NULLIF(current_setting('app.user_id', true), '')::uuid`; `ENABLE` + `FORCE ROW LEVEL SECURITY`; owner (postgres) != runtime role (app_runtime). Routes run tenant queries through a tenant-session dependency that issues `SET LOCAL ROLE app_runtime` + `SELECT set_config('app.user_id', :uid, true)` inside the request transaction. App-level `.where(user_id == ...)` predicates are retained as the first line; RLS is the tested backstop. Behavioral tests run raw SQL under SET ROLE app_runtime: (a) with the GUC set to user A and NO where-clause, only A's rows are visible; (b) without the GUC, zero rows; (c) INSERT with a mismatched user_id is rejected by WITH CHECK; (d) pg_class shows relrowsecurity AND relforcerowsecurity true; (e) tableowner != app_runtime.
- PIN-8 (journey discriminators): the wizard's review-step company/role fields become real inputs; core-journey creates a job with a per-run unique company string, asserts it absent from the /jobs default list before creation, present after, and present after reload; the journey asserts (network-level) that the /jobs default list was served by GET /api/v1/jobs (not /jobs/inbox); it captures the created jobId from the createApplication response and asserts /jobs/{jobId} renders (DB-backed getJob). DB provenance is additionally carried by AC-02's discriminator tests (below).
- PIN-9 (frontend de-mock scope): the existing add-app review step's fixed display fields (company, role, location) become controlled inputs prefilled with the current fixture values; the jobs screen's default view is rewired from useJobsInbox to useJobs per PIN-2 (existing hook, existing row rendering, a local Job->row mapping only). No new screens, no route changes, no contract change. This is de-mocking the existing manual-capture flow, not new product surface.
- PIN-10 (evidence binding): every completion-evidence row is produced at (or re-run at) the MASTER merge SHA; CI evidence for core-journey = the playwright workflow run at that SHA whose log shows core-journey.spec.ts executed (plus the alls-green-playwright required job), and a grep transcript showing the spec carries no skip/conditional markers.

## The `job` table (exemplar DDL shape)

Columns: `id uuid PK`, `user_id uuid NOT NULL REFERENCES "user"(id)`, `company text NOT NULL`, `title text NOT NULL`, `location jsonb NOT NULL`, `work_mode text NOT NULL CHECK in (remote|hybrid|onsite)`, `employment jsonb NOT NULL`, `compensation jsonb NULL`, `seniority text NULL`, `source jsonb NOT NULL`, `source_url text NULL`, `is_new boolean NULL`, `posted timestamptz NOT NULL`, `summary text NULL`, `tags jsonb NULL`, `requirements jsonb NULL`, `description text NULL`, `match jsonb NULL`, `schema_version int NOT NULL DEFAULT 1`, `created_at timestamptz NOT NULL DEFAULT now()`.

Constraints: `UNIQUE (user_id, id)` (composite-FK anchor for sprint-03+ children); named CHECKs `ck_job_location_shape` (object; raw required string; locality/region/country string when present), `ck_job_employment_shape` (object; classification in w2|contract|1099, cadence in hourly|salary, commitment in full-time|part-time), `ck_job_compensation_shape` (NULL, or object with extra array and either value number, or min+max numbers), `ck_job_source_shape` (object; board string; channel in url|jd-text|extension|email-forward; capturedAt string), `ck_job_match_shape` (NULL or object with score number), `ck_job_tags_array` / `ck_job_requirements_array` (NULL or array), `ck_job_schema_version` (>= 1); partial unique index per PIN-3; RLS per PIN-7. Index on `user_id`.

## AC matrix (one row per Done-when conjunct; sub-ACs where the conjunct bundles conventions)

| AC | Conjunct | Proven by (named test/evidence) |
|---|---|---|
| AC-01a | composite uniqueness UNIQUE(user_id, id) | migration test: introspect unique constraint + duplicate-insert rejection |
| AC-01b | tenant user_id | introspection: NOT NULL FK -> user(id) |
| AC-01c | FORCE RLS under runtime role != owner | PIN-7 tests (a)-(e), under app_runtime |
| AC-01d | timestamptz | introspection: posted/created_at are timestamptz; no timestamp-without-tz column on job |
| AC-01e | NUMERIC money | PIN-6: introspection proves no float/double/real column; note recorded |
| AC-01f | named JSONB CHECKs | introspection: named constraints exist; negative inserts per CHECK are rejected; drift round-trip test (PIN-4) |
| AC-01g | partial-unique dedup index | introspection: index predicate; behavioral: same (user_id, source_url) rejected, NULL url twice accepted |
| AC-01h | schema_version | introspection + negative insert (0 rejected) |
| AC-02 | jobs ops DB-backed + manifest flipped + fidelity | getJobs/getJob served from DB (fidelity tests validate wire shape from real rows); discriminators: a store-only job does NOT appear in getJobs; a DB-only job (absent from store) IS served by getJob; manifest diff flips exactly getJobs+getJob to implemented with a PIN-2 note on getJobsInbox |
| AC-03 | ownership matrix, tenant-indistinguishable 404 | intruder getJobs sees zero victim rows; intruder getJob on victim id -> 404 byte-identical to unknown-uuid 404; createApplication mints the job under the CALLER's user_id (DB-asserted); contract enumeration evidence that no job mutation op exists (getJobs/getJobsInbox/getJob are the only jobs ops) |
| AC-04 | browser create -> persists + lists after reload | core-journey transcript per PIN-8 against the compose stack: unique job visible in the getJobs-backed /jobs default list pre/post-reload, with the network assertion proving the list came from GET /api/v1/jobs |
| AC-05 | core-journey.spec.ts in CI, login -> create job -> lists, fresh seed | spec file exists; playwright.yml executes the whole e2e dir (no filter/skip -- grep evidence); CI run log at the master SHA shows the spec ran green (PIN-10) |
| AC-06 | ledger closed | every S02-* row at a terminal disposition (progress.md) |
| AC-07 | retarget | GOAL.md rewritten to sprint-03-shortlist verbatim from the queue copy, committed with the ship |

## Codex D1 dispositions (S02-D1-1..14; ledger rows in progress.md at ship)

| ID | Sev | Disposition | How |
|---|---|---|---|
| S02-D1-1 | HIGH | fixed | PIN-1 + PIN-8/9: the wizard becomes a real capture form; createApplication writes the DB job; the journey asserts a unique-content job, not navigation theater |
| S02-D1-2 | HIGH | fixed | PIN-2 as amended after the Codex reply round: getJobs/getJob flip; getJobsInbox recorded planned + outside the gate; the browser's default jobs collection is rewired onto DB-backed getJobs (the routing split Codex named as closure); AC-02 provenance discriminators prevent silent mock-backing |
| S02-D1-3 | HIGH | fixed | PIN-3: key + predicate pinned from v3's own language (canonical-URL dedup, reserved for captureJob); not a new product decision |
| S02-D1-4 | HIGH | disproved-with-evidence | the "weakened" depth IS the PO-recorded advisory default in Wes-authored approved-queue.md rev 1 (commit 9d3a784) -- authority, not smuggling; the dropped drift-test artifact is restored (PIN-4 round-trip test) |
| S02-D1-5 | HIGH | fixed | PIN-5: schema_version shipped in the exemplar |
| S02-D1-6 | HIGH | fixed | AC-01a..h: per-convention introspection + negative-insert tests replace the generic suite as evidence |
| S02-D1-7 | HIGH | fixed | PIN-7: RLS proven behaviorally under app_runtime with no route in the loop |
| S02-D1-8 | HIGH | fixed | PIN-8: unique content + pre/post/reload assertions + DB-backed detail read |
| S02-D1-9 | MED | fixed | this AC matrix maps every convention/op to a named check |
| S02-D1-10 | MED | fixed | AC-03 enumerates the matrix honestly: reads + the one write path (createApplication mint); no-mutation-op fact evidenced from the contract instead of pretending a write matrix exists |
| S02-D1-11 | MED | fixed | AC-02 discriminators (store-only excluded / DB-only served) make manifest flips falsifiable |
| S02-D1-12 | MED | fixed | PIN-10: run-log + no-skip grep + required alls-green job, at the master SHA |
| S02-D1-13 | MED | fixed | PIN-10: master-SHA binding (carried sprint-01 D1-1 rule, already in GOAL.md evidence-binding note) |
| S02-D1-14 | LOW | recorded (no action; process-defined) | frozen-non-blocking is a deliberate process state; disputed severity = release-blocking (process section 4) is the existing mitigation; nothing sprint-02 can or should change |

## Review panel charters (S6)

- QA seat (Sonnet): "Can intruder_client see or mutate another user's job via list, get, or nested reference -- and is every id-addressed miss a tenant-indistinguishable 404? Attack the matrix: collection filters, the createApplication mint path, byte-level 404 comparison, and any route that touches store.jobs after this sprint."
- Correctness seat (Opus): "Does the first real migration satisfy EVERY binding convention (walk AC-01a..h against the DDL), and do the tests prove RLS + role enforcement on DB state under app_runtime -- including that the tenant-session dependency actually applies to every jobs query path and survives session commits?"
- Simplification seat (Sonnet): "Is the exemplar minimal enough that sprint-03 can copy it mechanically? Name anything in the migration/route/test pattern that is job-specific accident rather than convention, and anything (dual-write, mappers) that will confuse a mechanical copy."

## Packets (S4; inline, sequential -- judgment-heavy exemplar work)

- P1: models.Job + alembic migration (DDL above) + tests/migrations/test_job_table.py (AC-01a..h). Commit boundary.
- P2: tenant-session dependency + DB-backed getJobs/getJob + createApplication DB mint (dual-write) + tests/api/routes/test_jobs.py (AC-02, AC-03) + manifest flips + client regen if schemas moved. Commit boundary.
- P3: seed extension -- demo jobs from store._seed_jobs() under the demo user with the store's fixed UUIDs (inbox links resolve); seed tests. Commit boundary.
- P4: wizard editable fields + jobs-screen default-view rewire to useJobs (PIN-2/PIN-9) + frontend/e2e/core-journey.spec.ts (PIN-8) + workflow check. Commit boundary.
