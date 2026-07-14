# progress.md -- resumable operational state

PLAN (v3) says what we are building; this file says where we are. Update at every block boundary and at any permitted-blocker stop. Governing process: `docs/plans/loop-research/sprint-treadmill-process.md`.

## Current state

- Phase / run: sprint-03-shortlist / sprint-03-run-1 (status: COMPLETE -- shipped + self-advanced; master CI green at 2567e4c)
- Active branch: master (sprint-03 merged 5b3e09c, ship + self-advance 2567e4c)
- Last verified checkpoint: sprint-03 shipped and self-advanced to sprint-04; master CI fully green at 2567e4c
- CI verification at the ship SHA 2567e4c (all first-try green, no INT-class fix): Test Backend (run 29306199586), Test Docker Compose (29306199563), Playwright incl. the extended core-journey job->shortlist (29306199566), Zizmor (29306199581) all success. The "core-journey required in CI" conjunct is closed against this run.
- Next phase (sprint-04-applications-resume-snapshot) exact next action: SYNCHRONOUS S0 read-back with Wes (ADVISORY, HIGH-risk, fresh Goal block; the long-pole sprint -- applications+resume+snapshot as ONE slice with 3a/3b/3c internal checkpoints, ONE master merge). Codex D1+D2 MUST fire. See the sprint-04 Goal block in GOAL.md.
- S7 ship evidence at the merge SHA 5b3e09c: backend 354 passed (POSTGRES_SERVER=localhost uv run pytest -q), lint clean, generate-client zero diff, frontend unit 323 passed; core-journey (login -> create job -> lists/persists -> shortlist -> shortlist lists) green 11.7s against the rebuilt compose stack with a fresh seed (7 demo jobs + 6 shortlist entries). CI verification at the master SHA recorded below once green.
- sprint-02 (prior phase) shipped + verified: run sprint-02-run-2, merge b942a1f, INT-3 fix 07dd4bf, master CI fully green at 07dd4bf.
- S6 review outcome: DB job exemplar SOUND (correctness Opus: no HIGH/MED, RLS proven under app_runtime; D2: exemplar statically sound). SIM-1/SIM-2 fixed (88bbc5b). QA-1/D2-1 (mock-layer cross-tenant leak activated by PIN-9) -> PO re-scoped conjunct 3 to the DB Job resource (run-2), mock layer accepted as DEBT-5 (sprint-04 structural fix). Reports: scratchpad/panel-{qa,correctness,simplification}.md + sweep-finder.md; ledger below.
- Packet log (sprint-02): spec 06d952c/7d0f6f3 (D1 UNSOUND -> hardened -> SOUND, thread 019f5da8); P1-P3 9723739 (job table migration 4c17ea8b5656 + tenant session + DB getJobs/getJob + dual-write mint + seed jobs); P4 cf3d268 (editable wizard, getJobs-backed /jobs default view, core-journey.spec.ts born, smoke auths as demo tenant).
- S5 evidence (2026-07-13, branch sprint-02-jobs at cf3d268): backend 325 passed (POSTGRES_SERVER=localhost uv run pytest -q) incl. tests/migrations 39 (job-table AC-01 suite) and tests/api/routes/test_jobs.py (fidelity/tenancy/provenance/drift); lint (mypy strict + ty + ruff + format) clean; frontend build green, vitest 323 passed, biome clean; generate-client.sh produced ZERO diff; playwright 36/36 (35 smoke + core-journey) against the rebuilt compose stack; core-journey transcript: real-form login -> unique-content capture -> getJobs-network-asserted list -> reload-persists -> DB detail render, 9.5s.
- Packet log: P1 b4470a1 (contract-first generation). P2 298832b (CI gates + app_runtime/append-only migration, 11 tests, PIN-2 negative evidence). P4 e6c48ad (split, verifier PASS). P3 98f70e5 (rollback world + PIN-9 self-test). P6 e0ce64b (seed + prestart gate, verifier PASS w/ 1 fixed finding). P5 79fad89 (auth boundary, ONE commit: single 401 raise site, router-level CurrentUser, DB getCurrentUser, OpenAPI-derived sweep). P7 d0b7cdb (throttle/claims/lifetime/fail-closed/CORS/CSP). Rework f569173 (PO review W-1 + P6-V-1). e2e fix 6ea0891 (one login per run; bearer on fixture fetches).
- S5 evidence (2026-07-13, branch sprint-01-foundation): backend 292 passed (293 after the D2 fixes); lint (mypy strict + ty + ruff) clean over app and tests; frontend vitest 323 passed, tsc + biome clean, build green; compose boot from CLEAN VOLUMES green (docker compose down -v && up -d --build --wait backend prestart db); playwright smoke 35/35.
- AC-07 discriminating transcript (Codex D2-3; run 2026-07-13 against the local employa-bot-fastapi compose project, commands verbatim):
  1. `docker compose exec -T db psql -U postgres -d app -tA -c "SELECT id FROM \"user\" WHERE email='wes.gilleland@gmail.com'"` -> `d01bf05a-d3d5-4965-8215-8ed8210fd699` (row exists before reset)
  2. `docker compose exec -T backend python -m app.scripts.seed --reset` -> exit 0, log line `Demo user seeded`
  3. same SELECT -> `fb60444d-1203-44c4-93a4-4256f6a50d9e` (id CHANGED: the existing row was deleted and recreated by the explicit reset -- prestart residue cannot produce this)
  4. `curl -s -o /dev/null -w "login-status=%{http_code}" -X POST http://localhost:8000/api/v1/login/access-token -d "username=wes.gilleland@gmail.com&password=employa-demo-1"` -> `login-status=200`
- Trap change: the old session-teardown delete-all-users is GONE -- the P3 rollback world never deletes; bootstrap rows (FIRST_SUPERUSER, test user, intruder) persist like prestart state.
- Recorded limitation (queue rev 1 default): vite DEV mode runs without the meta CSP (react-refresh inline preamble); production builds get it injected at build time, and the API serves the header always (DEBT-2).
- Entry step 0 evidence (2026-07-13): one deliberate early stop attempted after the manifest commit; the /goal Stop hook BLOCKED it, returning an audit that correctly judged all 10 manifest conjuncts unsatisfied. Hook verified working; sprint remains attended per queue row.
- Resume preflight 2026-07-13: tree carried pre-run dirt only (Wes's `.idea/*.iml` modifications + untracked `AGENTS.md`, both predating activation commit 9d3a784; not sprint work, left untouched). No prior manifest, run never started -> NOT abandoned-dirty; direct start. Queue copy in GOAL.md diffed against approved-queue.md rev 1: identical.

## Run manifests

### sprint-03-run-1 (guard on 2026-07-13)

- run_id: sprint-03-run-1
- GOAL.md commit SHA as invoked: this guard-on commit (branch sprint-03-shortlist); repo HEAD at invocation 5a0b1bd (master, sprint-02 shipped)
- approved-queue.md commit SHA: 9d3a784dc830ae3bf2653d7b6a7c5eb2f9670d27 (Wes-authored, queue_revision 1, unchanged)
- S0 record: Wes invoked `/goal Complete the snapshotted current run in @GOAL.md` against the sprint-03 ADVISORY block = the go decision. Retro proposals PR-1..PR-4 ratified at default (adopt) into GOAL.md Proven patterns (this commit). Queue copy diffed vs approved-queue.md rev 1 at invocation: identical. Entry criteria met: sprint-02 shipped (merge b942a1f, master CI green at 07dd4bf), the job exemplar exists. Preflight: tree clean (only pre-existing .idea/*.iml).
- Codex D1 fired pre-guard (MUST: fresh block), thread 019f5eaa-1626-7d02-b0f6-9b9d494efb77, verdict UNSOUND, 11 findings -> dispositions in docs/sprints/sprint-03-spec.md and the ledger. D1-11 confirmed: Codex D2 WILL fire pre-merge (first composite-FK-to-parent exemplar). D1-3 (duplicate-add response semantics) is a HUMAN-DECISION with no recorded default -> PO question at spec time.
- Done-when conjuncts, verbatim from GOAL.md at that SHA:
  1. the `shortlist_entry` table exists via a migration satisfying the binding conventions (tenant user_id, composite UNIQUE(user_id, id) anchor, FORCE RLS under app_runtime != owner, timestamptz) with the dedup UNIQUE(user_id, job_id) live
  2. the composite FK (user_id, job_id) -> job(user_id, id) rejects a cross-tenant job_id at the DB (proven under app_runtime) with migration tests green
  3. the shortlist contract operations are served from the database with their manifest entries flipped to implemented and contract fidelity green
  4. the ownership-matrix tenancy tests pass (intruder_client cross-tenant reads/dedup-creates all fail as tenant-indistinguishable 404s)
  5. frontend/e2e/core-journey.spec.ts is extended through login -> create job -> add to shortlist -> shortlist lists, green from a fresh seed and required in CI
  6. the review ledger has no finding outside a terminal disposition
  7. GOAL.md is retargeted to sprint-04-applications-resume-snapshot and committed


(One entry per S1 guard-on: run_id, GOAL.md commit SHA, approved-queue.md commit SHA, Done-when conjuncts verbatim. The completion audit judges against the manifest, not against later edits.)

### sprint-02-run-2 (PO re-plan 2026-07-13, supersedes run-1 for the completion audit)

- run_id: sprint-02-run-2
- Why: Codex D2 (thread 019f5df8) ruled run-1's Done-when conjunct 3 violated as written (QA-1/D2-1: PIN-9 routes real user job data through createApplication into the shared un-tenanted mock Application store; intruder can read/dismiss it). Per the sprint-02 recorded advisory default the lead stopped for a PO waiver. Wes (PO), via a recorded decision 2026-07-13, chose to RE-SCOPE conjunct 3 to the DB-backed Job resource and accept the mock-layer gap as DEBT-5 (structural fix when applications go DB-side in sprint-04). D2's prescribed process path: a new run manifest carrying the narrowed conjunct; run-1 stands as the historical record of the finding. The authoritative approved-queue.md sprint-02 exit gate was ALREADY Job-scoped ("created job persists + lists in browser; core-journey covers login->job"), so no queue edit is needed and queue_revision stays 1; the over-broad conjunct was a GOAL.md Goal-block drafting artifact, corrected here under PO authority.
- GOAL.md commit SHA as re-planned: cc1d34a (this branch); repo HEAD at re-plan cc1d34a
- approved-queue.md commit SHA: 9d3a784dc830ae3bf2653d7b6a7c5eb2f9670d27 (Wes-authored, queue_revision 1, unchanged)
- Inherited work (counts toward this manifest): 06d952c/7d0f6f3 (spec), 9723739 (P1-P3), cf3d268 (P4), 88bbc5b (SIM fixes), cc1d34a (ledger).
- Done-when conjuncts, verbatim (run-2 = run-1 with conjunct 3 narrowed):
  1. the `job` table exists via a migration satisfying every binding convention (composite uniqueness, tenant user_id, FORCE row-level security under a runtime role that is not the owner, timestamptz, NUMERIC money, named JSONB CHECKs, the partial-unique dedup index) with migration tests green under app_runtime
  2. the jobs contract operations are served from the database with their manifest entries flipped to implemented and contract fidelity green
  3. the ownership-matrix tenancy tests pass for the DB-backed Job resource (intruder_client cross-tenant reads of getJobs/getJob all fail as tenant-indistinguishable 404s; the Job resource exposes no mutation op, and createApplication mints the job under the caller's user_id). Cross-tenant exposure of captured job data via the shared mock Application/searches/resume/shortlist layer is OUT of scope for this DB-vertical and is tracked as DEBT-5 (structural fix: sprint-04, applications DB-side).
  4. a job created in the browser persists and lists after a reload against the compose stack
  5. frontend/e2e/core-journey.spec.ts exists, is required in CI, and covers login -> create job -> job lists, green from a fresh seed
  6. the review ledger has no finding outside a terminal disposition
  7. GOAL.md is retargeted to sprint-03-shortlist and committed

### sprint-02-run-1 (guard on 2026-07-13)

- run_id: sprint-02-run-1
- GOAL.md commit SHA as invoked: 4260831bb432bc1fb50357d6892c24cd559dc077 (self-advance ship commit; repo HEAD at invocation 895b096)
- approved-queue.md commit SHA: 9d3a784dc830ae3bf2653d7b6a7c5eb2f9670d27 (Wes-authored, queue_revision 1)
- S0 record: Wes invoked `/goal Complete the snapshotted current run in @GOAL.md` directly against this ADVISORY block. The operator runbook line in GOAL.md (which he shipped and re-read at invocation) places the synchronous S0 read-back before that invocation; his invocation is recorded as the go decision. Retro proposals PR-1/PR-2/PR-3 ratified at their stated default dispositions (adopt; all three were already reflected in the GOAL.md Proven patterns he advanced). Queue copy diffed against approved-queue.md rev 1 at invocation: identical. Entry criteria: sprint-01 shipped (merge 0b83cd2), master CI fully green at 954bd00 (recorded 895b096). No prior sprint-02 work: fresh run, preflight clean (only pre-existing `.idea/*.iml` dirt).
- Codex D1 fired pre-work (MUST trigger: fresh block + exemplar hard blocker), thread 019f5da8-4c83-7f03-8c0c-7eae419b51eb, verdict UNSOUND, 14 findings -> ledgered as S02-D1-1..14; dispositions in docs/sprints/sprint-02-spec.md and the review ledger below. Blocking findings close before implementation.
- Done-when conjuncts, verbatim from GOAL.md at that SHA:
  1. the `job` table exists via a migration satisfying every binding convention (composite uniqueness, tenant user_id, FORCE row-level security under a runtime role that is not the owner, timestamptz, NUMERIC money, named JSONB CHECKs, the partial-unique dedup index) with migration tests green under app_runtime
  2. the jobs contract operations are served from the database with their manifest entries flipped to implemented and contract fidelity green
  3. the ownership-matrix tenancy tests pass (intruder_client cross-tenant reads/writes all fail as tenant-indistinguishable 404s)
  4. a job created in the browser persists and lists after a reload against the compose stack
  5. frontend/e2e/core-journey.spec.ts exists, is required in CI, and covers login -> create job -> job lists, green from a fresh seed
  6. the review ledger has no finding outside a terminal disposition
  7. GOAL.md is retargeted to sprint-03-shortlist and committed

### sprint-01-run-1 (guard on 2026-07-13)

- run_id: sprint-01-run-1
- GOAL.md commit SHA as invoked: 9d3a784dc830ae3bf2653d7b6a7c5eb2f9670d27 (Wes-authored)
- approved-queue.md commit SHA: 9d3a784dc830ae3bf2653d7b6a7c5eb2f9670d27 (Wes-authored, queue_revision 1)
- Done-when conjuncts, verbatim from GOAL.md at that SHA:
  1. generate-client.sh generates from mvp-api.yaml with the generated-diff CI job green
  2. migration + manifest CI jobs pass
  3. every mock route returns 401 without a token via the single normalized code path (sweep evidence)
  4. the 401 message is uniform across invalid/inactive/unknown
  5. getCurrentUser is implemented with the contract fidelity test green
  6. contract test files are split with the full suite green under the rollback fixture
  7. seed --reset produces a working login from a fresh compose stack
  8. the P7 auth conventions are implemented with their tests green (throttle, claims, lifetime, fail-closed secret, CORS, CSP)
  9. the review ledger has no finding outside a terminal disposition
  10. GOAL.md is retargeted to sprint-02-jobs-manual-capture and committed

## Completed sprints

(One entry per shipped sprint: outcomes with evidence, AC covered, review results, deviations, cost line. This section absorbs the CHANGELOG role for sprint work.)

### sprint-03-shortlist (run sprint-03-run-1, shipped 2026-07-14, merge 5b3e09c)

The first child table that composite-FKs a parent -- the exemplar sprint-04's children (stage_transition, resume_snapshot, match_report) copy. Outcomes vs the 7 run-manifest conjuncts:

1. shortlist_entry migration (4317eb75f1cd) under the conventions + dedup: tenant user_id + composite UNIQUE(user_id,id) anchor, CASCADE user FK, FORCE RLS (policy shortlist_tenant_isolation on the app.user_id GUC) under app_runtime != owner, timestamptz, named salary JSONB CHECK (IS-TRUE-wrapped, none_as_null), schema_version, source CHECK; partial dedup uq_shortlist_user_job UNIQUE(user_id,job_id) WHERE job_id IS NOT NULL. tests/migrations/test_shortlist_entry.py 20 tests (AC-01a..d, AC-02, AC-02b) green under app_runtime.
2. composite FK (user_id,job_id) -> job(user_id,id) rejects a cross-tenant job_id at the DB, PROVEN under app_runtime (test_composite_fk_is_the_backstop_under_app_runtime, D2-2) not just as owner; MATCH SIMPLE skips the FK on NULL job_id.
3. shortlist ops DB-backed + manifest flipped + fidelity: getShortlist(default)/addToShortlist/dismissFromShortlist served from the DB via get_tenant_session; searchId-scoped getShortlist stays mock (PIN-3), unrecognized searchId falls through to the DB default (SIM-2). Manifest flips the three ops. Provenance discriminators + wire fidelity + drift round-trip in tests/api/routes/test_shortlist.py (14 tests).
4. ownership matrix: intruder cross-tenant list sees zero victim rows; cross-tenant dismiss + not-owned-jobId add are byte-identical 404s; caller-stamped add DB-asserted; QA seat independently confirmed RLS holds via a bypassed-predicate raw SELECT + WITH CHECK rejects a spoofed user_id.
5. journey extended: core-journey now login -> create job -> lists/persists -> add to shortlist (POST carries the created jobId, network-asserted; entry composite-FKs the job) -> /shortlist lists it. Green 11.7s from a fresh seed at 5b3e09c; required in CI (whole e2e dir, alls-green-playwright).
6. ledger closed (sprint-03 review ledger below, all terminal).
7. retarget: this ship self-advances GOAL.md to sprint-04-applications-resume-snapshot.

AC covered: AC-01a..d, AC-02, AC-02b, AC-03..08 (docs/sprints/sprint-03-spec.md).

Review results: Codex D1 (thread 019f5eaa) UNSOUND->hardened->SOUND (11 findings; PO ruled duplicate-add -> 409 via AskUserQuestion). 3-seat panel: QA PASS on tenancy (exhaustive independent attack incl. RLS-bypass probe), correctness (Opus) confirmed code correct (composite FK + RLS complementary, salary CHECK airtight, DEBT-6 index intact, tests discriminate), simplification SIM-1/SIM-2 fixed + rubric 6/10. Sweep (lead re-run, sl-sweep report lost in transit) corroborated QA PASS, no distinct finding. Codex D2 (thread 019f5eca) UNSOUND (4 findings) -> all fixed (D2-3 = this ship step) -> SOUND at c0bd8b1.

Deviations worth knowing: PO HUMAN-DECISION on duplicate-add semantics (409 conflict, not idempotent). job_id kept NULLABLE (contract-faithful, jobId optional) with a partial dedup -- no mvp-api.yaml edit. The catch-all `except IntegrityError->409` was narrowed to the dedup constraint name (QA-1/COR-2/SIM-1) so the exemplar disambiguates 404-vs-409 for sprint-04's deletable-parent children. A two-connection race test's session-level SET ROLE poisoned the pool under FORCE RLS -> connections invalidate()'d. D2 re-opened D2-1 twice (sequential test -> lock_timeout contention test -> concurrent-route [201,409] test) before closing.

Retro (2 questions):
Q1 -- Proven-patterns proposals (inert until ratified at sprint-04 S0; default: adopt; expire after 2 plannings):
  - PR-5: the composite-FK-to-parent + partial-dedup + nullable-reference pattern (shortlist_entry) is the copyable template for sprint-04's child tables; copy the migration shape (composite FK via raw op.execute, MATCH SIMPLE for optional refs, partial unique for optional dedup).
  - PR-6: a DB constraint surfaced through a route MUST disambiguate by constraint name (`exc.orig.diag.constraint_name`), never a catch-all `except IntegrityError`, when >1 constraint can fire -- else a TOCTOU on a deletable parent mislabels the error.
  - PR-7: two-connection / concurrency tests that use session-level `SET ROLE` MUST invalidate() their connections (or use SET LOCAL) -- a pooled connection left as app_runtime breaks later owner-role inserts under FORCE RLS.
  - PR-8: a DB/mock split's "no-match" fallback must be re-derived per resource (unrecognized searchId -> DB default here), not mechanically inherited from a fully-mock op's shape.
Q2 -- debt: no new blocking debt. DEBT-6 (autogenerate drift on migration-only RLS/index) now applies to shortlist_entry too (carried, same pattern). DEBT-7 (none_as_null) honored on the salary column.

Cost line: 1 session (attended handoff continued). Inline implementation (no fanned implementers -- exemplar-copy judgment work). Fan-out = 3 panel seats (2 Sonnet + 1 Opus) + 1 Haiku sweep finder (report lost, lead re-ran). Codex = D1 (1 dispatch + 3 replies) + D2 (1 dispatch + 3 replies). 1 PO decision (duplicate-add 409). The panel + D2 caught 6 real evidence/robustness issues (sequential race test, FK-not-tested-under-runtime, catch-all error taxonomy, dead mock fallback, pool poison) the AC matrix alone missed -- independence paid off again.

### sprint-02-jobs-manual-capture (run sprint-02-run-2, shipped 2026-07-13, merge b942a1f)

The first populated-schema DB vertical -- the `job` table exemplar under plan v3's binding Design conventions. Outcomes vs run-2's 7 conjuncts (Job-scoped conjunct 3 after the PO re-plan):

1. Job migration under every binding convention: migration 4c17ea8b5656 (models.Job) -- UNIQUE(user_id,id), user_id FK ON DELETE CASCADE, FORCE RLS (policy `job_tenant_isolation` on the `app.user_id` GUC) under app_runtime != owner, timestamptz, no float money column (compensation is JSONB Salary, PIN-6), 9 named JSONB CHECKs (IS-TRUE-wrapped), schema_version, partial-unique `uq_job_user_source_url (user_id, source_url) WHERE NOT NULL`. `tests/migrations/test_job_table.py` 15 tests prove each AC-01a..h by introspection + 14 negative-insert cases + raw SQL under SET ROLE app_runtime. Evidence at merge SHA b942a1f: `POSTGRES_SERVER=localhost uv run pytest tests/migrations -q` -> 39 passed.
2. Jobs ops DB-backed + manifest flipped + fidelity: getJobs/getJob served from the DB via app/job_mapper.py through TenantSession; getJobsInbox stays mock (PIN-2, seam-safe -- no DB row keyed by a mock search id); manifest flips getJobs+getJob to implemented. Provenance discriminators (store-only job not served / DB-only job served) + wire-fidelity + drift round-trip in tests/api/routes/test_jobs.py. `uv run pytest tests/contract -q -k jobs` + test_operation_manifest green.
3. Ownership matrix (Job resource, run-2 scope): intruder getJobs sees zero victim rows; cross-tenant getJob 404 byte-identical to unknown-id 404; the Job resource has no mutation op; createApplication mints under the caller's user_id (DB-asserted). Correctness (Opus) independently proved RLS holds with no `.where` and with the GUC unset. `POSTGRES_SERVER=localhost uv run pytest tests/api -q -k job` green.
4. Browser persistence: core-journey creates a per-run unique-content job, asserts absent-before / present-after / present-after-reload on the getJobs-backed /jobs list (network-asserted served by GET /api/v1/jobs), reads /jobs/{id} back via DB getJob. Clean-volume boot (`docker compose down -v && up --wait`) + fresh seed (7 demo jobs) at b942a1f -> `bunx playwright test e2e/core-journey.spec.ts` 1 passed (10.0s).
5. core-journey in CI: frontend/e2e/core-journey.spec.ts exists in the e2e dir that playwright.yml runs whole (no filter/skip); required via the alls-green-playwright branch-protection job. Verified in CI at the master SHA (below).
6. Ledger: all sprint-02 findings at terminal dispositions (sprint-02 review ledger below).
7. Retarget: this ship self-advances GOAL.md to sprint-03-shortlist.

AC covered: AC-01a..h, AC-02..07 (docs/sprints/sprint-02-spec.md). Manifest conjuncts: run-2 (7), superseding run-1 after the PO re-scope.

Review results: 3-seat panel -- correctness (Opus) no HIGH/MED, charter YES (RLS proven under app_runtime, tenant-session survives the mid-request commit, JSONB IS-TRUE airtight, jsonb-null rejected); simplification SIM-1/SIM-2 (both fixed) + SIM-3->DEBT-7 + positives; QA-1 HIGH (mock Application layer cross-tenant leak, PIN-9-activated). Sweep corroborated QA-1's scope (shortlist/fork/match-report/deep-score also un-tenanted mock). Codex D1 (thread 019f5da8) UNSOUND->hardened->SOUND (14 findings dispositioned pre-work); Codex D2 (thread 019f5df8) UNSOUND on QA-1/D2-1 -> PO re-scoped conjunct 3 to the Job resource (run-2) -> SOUND at 493f2a9. D2-2 (empty ledger) fixed.

Deviations worth knowing: QA-1/D2-1 -- PIN-9 made createApplication write real user data into the shared un-tenanted mock store; the DB job vertical is correctly isolated, but the frozen run-1 conjunct 3 read broader than the Job resource. PO (Wes) re-scoped it to the DB Job resource and accepted the mock layer as DEBT-5 (structural fix sprint-04). The panel caught this release-blocking finding that the AC matrix AND Codex D1 both missed -- panel independence earned its cost. Migration recreated once to add the CASCADE FK (SIM-2). Frontend full-suite timeouts under concurrent load were flakes (unit project green in isolation).

Retro (2 questions):
Q1 -- Proven-patterns proposals (inert until ratified at sprint-03 S0; default: adopt; expire after 2 plannings):
  - PR-1: the `get_tenant_session` dependency (SET LOCAL ROLE app_runtime + set_config('app.user_id', true) + RESET teardown; app-level `.where` as belt, RLS as backstop) is THE copyable pattern for every future tenant route.
  - PR-2: ON DELETE CASCADE on every tenant-child FK -- user teardown stays one DELETE instead of an ordered manual chain (SIM-2).
  - PR-3: `sa_type=JSONB(none_as_null=True)` is mandatory on nullable JSONB columns paired with named CHECKs, else the CHECK silently skips NULL (SIM-3/DEBT-7); document centrally before sprint-03 adds one.
  - PR-4: e2e/smoke authenticate as the DEMO tenant now that surfaces are tenant-filtered; new DB verticals keep their smoke fixtures owned by the demo user.
Q2 -- debt: DEBT-5 (mock layer un-tenanted; HIGH mock-layer, non-blocking for the prototype; sprint-04), DEBT-6 (autogenerate drift on migration-only RLS/index), DEBT-7 (none_as_null landmine). All ledgered above.

Cost line: 1 session (attended). Inline implementation (no fanned implementers -- exemplar judgment work). Fan-out = 3 panel seats (2 Sonnet + 1 Opus) + 1 Haiku sweep finder. Codex = D1 (1 dispatch + 2 replies) + D2 (1 dispatch + 3 replies). 1 PO decision (QA-1 re-scope). Panel/D2 independence caught the one release-blocker the AC matrix + D1 missed -- the fan-out cost bought a real defect, not theater.

### sprint-01-gates-and-foundation (run sprint-01-run-1, shipped 2026-07-13, merge 0b83cd2)

Outcomes vs the 10 manifest conjuncts (AC-01..10, docs/sprints/sprint-01-spec.md):

1. AC-01 generate-client from mvp-api.yaml: commit b4470a1; generated-diff CI job green in Test Backend run 29289255710 at merge SHA 0b83cd2; local `bash scripts/generate-client.sh && git diff --exit-code frontend/src/client backend/app/schemas.py` clean at 0b83cd2.
2. AC-02 migration + manifest CI jobs: migration-gates and manifest-validation jobs green in the same run 29289255710 (https://github.com/InfiniteRoomLabs/employa-bot-fastapi/actions/runs/29289255710); 11 migration tests incl. append-only under SET LOCAL ROLE app_runtime.
3. AC-03 401 boundary: runtime-route-tree sweep (test_auth_sweep.py) green -- 106 routes, 5 named exemptions, uniform envelope; commits 79fad89/df9e268/7c35970.
4. AC-04 401 uniformity: byte-identical bodies across invalid/expired/unknown/inactive/malformed/non-uuid-sub (test_auth_boundary.py).
5. AC-05 getCurrentUser implemented: DB-backed via CurrentUser, manifest flipped, no-override fidelity test green.
6. AC-06 split + rollback world: per-subsystem contract files (verifier PASS, 121 defs preserved); PIN-9 self-test proves the outer-transaction rollback; full suite 293 green at 0b83cd2.
7. AC-07 seed from fresh stack: clean-volume boot + discriminating id-change transcript (above) + demo login 200.
8. AC-08 P7 conventions: throttle (order-proof spy test), JWT iss/aud/iat/nbf/jti/sv (sv required + validated), 60-min lifetime, fail-closed SECRET_KEY, credential-free narrowed CORS, CSP header + build-time meta; all tests green.
9. AC-09 ledger: all findings at terminal dispositions (D1-1 flipped fixed below).
10. AC-10 retarget: this commit rewrites GOAL.md to sprint-02-jobs-manual-capture.

Review results: panel = QA PASS (zero findings), correctness 1 HIGH disproved-with-evidence + 2 LOW fixed, simplification 1 MED fixed; sweeps zero findings; Codex D1 9 findings (all closed), D2 4 findings (all closed, final verdict SOUND); PO live review W-1 fixed; P4/P6 verifiers PASS (1 LOW-MED fixed).

Deviations worth knowing: SEED_DEMO_DATA wired via compose.yml not .env (commit guard); CSP meta injected at build time by a vite plugin (dev-mode react-refresh limitation, DEBT-2); e2e suite reworked to one-login-per-run (the throttle broke per-worker logins); Playwright CI image/lockfile version mismatch found at ship (pre-existing, INT-1) and fixed in this commit.

Cost line: 1 attended session; fan-out = 2 Sonnet implementers + 3 verifiers/finders (2 Sonnet, 1 Haiku) + 3 panel seats (2 Sonnet, 1 Opus); Codex = 4 calls (D1 x1, D2 x1 + 2 reply rounds). Implementer/verifier pair hypothesis: supported -- both pairs shipped clean with 1 real finding caught (P6-V-1) at a fraction of inline wall-clock.

Retro (2 questions):
Q1 proposals (inert until ratified at the next S0, expire after 2 plannings):
  - PR-1: add to Proven patterns -- always `uv run` for python tooling; bare python3 is 3.12 and produced a false HIGH finding (default: adopt; already reflected in the new GOAL.md patterns).
  - PR-2: fanned finder/verifier agents must WRITE reports to a file, not only message them (one Haiku report was lost in transit and had to be re-run) (default: adopt; reflected in patterns).
  - PR-3: keep the Sonnet implementer/verifier pair for fanned packets; evidence above (default: adopt).
Q2 debt: DEBT-1 (single-process throttle), DEBT-2 (vite dev CSP), DEBT-3 (UNDO_WINDOW_SECONDS -> Settings when sprint-04 rebuilds applications); all non-blocking, ledgered above.

## Review ledger

(Every finding: stable ID, reviewer, severity, one-sentence finding, disposition, closure evidence as command + output. Dispositions: fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION (illegal at gate-0.1). Zero-finding dispatches are recorded too.)

| ID | Reviewer | Sev | Finding | Disposition | Closure evidence |
|---|---|---|---|---|---|
| (process design review 2026-07-13: 14 Codex findings on the process spec itself, all fixed -- see the appendix in sprint-treadmill-process.md) | | | | | |
| D1-1 | Codex D1 (thread 019f5d1a-ee9e-79d3-8f2b-e8ee4f1db58d) | HIGH | Manifest never requires the shipped commit to be reachable from master | fixed | evidence re-run at MASTER merge SHA 0b83cd2: backend 293 passed, lint clean, frontend build + 323 tests green, generated-diff clean locally; CI at that SHA: Test Backend run 29289255710 success (generated-diff, migration-gates, manifest-validation jobs), Test Docker Compose 29289255799 success, Zizmor success |
| D1-2 | Codex D1 | HIGH | Green CI job conclusions do not prove the gates enforce anything | fixed | negative evidence recorded in commit 298832b message: dirty client -> git diff --exit-code exits 1; second alembic head -> test_single_head FAILED; renamed manifest op -> manifest tests FAILED |
| D1-3 | Codex D1 | HIGH | 401 sweep evidence proves neither route completeness nor one code path | fixed | sweep derives universe from the runtime route tree (test_auth_sweep.py, commits 79fad89 + df9e268); single raise site enforced by test_single_raise_site_in_deps; suite green |
| D1-4 | Codex D1 | HIGH | getCurrentUser evidence cannot discriminate DB-backed from a test double | fixed | test_get_current_user_contract_fidelity_no_overrides: plain TestClient, asserts app.dependency_overrides empty, real committed row round-trip (commit 79fad89), green |
| D1-5 | Codex D1 | HIGH | Expired-token envelope uniformity omitted from the frozen conjunct | fixed | test_401_envelope_uniform_across_all_failure_modes byte-compares invalid/expired/unknown/inactive/malformed/non-uuid-sub bodies (commits 79fad89, c85214f), green |
| D1-6 | Codex D1 | MED | Seed evidence can pass with seed --reset broken or unused | fixed | discriminating transcript in S5 evidence below: existing demo row id d01bf05a... -> seed --reset -> new id fb60444d... (delete+recreate proven), login 200 |
| D1-7 | Codex D1 | MED | P7 predicate subjective (CSP directives, global cap, CORS narrowing unpinned) | fixed | exact values pinned in sprint-01-spec.md PIN-7 and carried in Settings (LOGIN_THROTTLE_*, JWT_*, API_PUBLIC_ORIGIN) + CONTENT_SECURITY_POLICY; per-convention tests green (commit d0b7cdb) |
| D1-8 | Codex D1 | MED | compose down -v / seed --reset under-classified as ordinary verification | fixed | seed.py refuses ENVIRONMENT != local without --force and refuses the default password even with it; evidence runs confirmed against the employa-bot-fastapi local compose project only |
| D1-9 | Codex D1 | MED | Green full suite does not prove the rollback fixture is actually in effect | fixed | tests/test_db_world.py asserts a committed write is invisible to other connections AND absent after teardown (commit 98f70e5), green in every suite run |
| SEC-1 | background security review (via p4-verifier) | MED | SEED_DEMO_PASSWORD hardcoded default | fixed | seed.py refuses the default password outside local even with --force (commit e0ce64b) |
| P6-V-1 | p6-verifier (Sonnet) | LOW-MED | No test proves seed --reset leaves other users untouched | fixed | test_seed_reset_leaves_other_users_untouched green (commit f569173) |
| P6-V-2 | p6-verifier (Sonnet) | INFO | Demo seed persists Wes's real email (carried verbatim from store.py, already public in the repo) as a login-capable DB row when SEED_DEMO_DATA=true | informational, no action | pre-existing value, PO-owned persona choice; flag stays visible here |
| W-1 | Wes (PO, attended review) | MED | P7 module constants (throttle limits, JWT iss/aud, CSP origin) bypassed the Settings/.env config ecosystem | fixed | LOGIN_THROTTLE_*, JWT_ISSUER/JWT_AUDIENCE, API_PUBLIC_ORIGIN in Settings; frontend CSP origin from VITE_API_URL (commits d0b7cdb, f569173) |
| QA-panel | panel-qa (Sonnet seat) | -- | ZERO findings: no mock route reachable without a token; exempt list product-correct (email-enumeration checked); one LOW robustness note on the exempt-route test's DB dependency | recorded (zero-finding review) + note fixed | seat report; docstring note in test_auth_sweep.py (commit c85214f) |
| COR-1 | panel-correctness (Opus seat) | HIGH (claimed) | `except A, B:` alleged SyntaxError on Python 3.14 | disproved-with-evidence | Discriminating experiment: seat ran SYSTEM python3 (3.12.3, where it IS an error); project interpreter `uv run python --version` = 3.14.3; `uv run python -m py_compile app/api/deps.py` exit 0; fresh import after `rm -rf app/api/__pycache__` prints fresh-import=OK (PEP 758). QA seat independently reached the same conclusion. |
| COR-2 | panel-correctness | LOW | JWT require list omitted `sv` | fixed | security.py require list includes sv (commit c85214f); suite green |
| COR-3 | panel-correctness | LOW | Signed token with non-UUID sub -> DataError 500 instead of the uniform 401 | fixed | TokenPayload.sub is UUID-typed; `non-uuid-sub` case added to the byte-identical uniformity test, green (commit c85214f) |
| SIM-1 | panel-simplification (Sonnet seat) | MED | `_reset_store` autouse-by-directory fixture violates the v3 Test-isolation rule | fixed | reset moved into store_client/unauthenticated_client bodies; `grep -rn "autouse=" backend/tests/ --include="*.py"` returns 0 hits (commit c85214f; remaining grep matches for the bare word are docstrings); contract suite green |
| D2-1 | Codex D2 (thread 019f5d81-c7b3-7da0-bc69-1356d671a3ca) | HIGH | Ledger completion row false: D1 rows sat at open->PIN with pending evidence | fixed | every D1 row above now carries a terminal disposition with concrete evidence, except D1-1 which structurally closes in the S7 ship commit (see its row) |
| D2-2 | Codex D2 | HIGH | Sweep universe from OpenAPI, not the served route tree; schema-hidden routes evade | fixed | _walk_routes recurses the runtime route tree incl. lazy _IncludedRouter, mount guard + OpenAPI-coverage cross-check added (commit df9e268); suite green |
| D2-3 | Codex D2 | MED | AC-07 evidence did not discriminate seed --reset from prestart's seeding | fixed | id-change transcript: existing row d01bf05a... deleted and recreated as fb60444d... by the explicit reset, login 200 (S5 evidence) |
| D2-4 | Codex D2 | MED | Throttle order (before password verification) asserted but not proven | fixed | test spies on crud.authenticate: zero invocations on the throttled request (commit df9e268), green |
| SWEEP-1 | Haiku finder + lead re-run + QA seat | -- | Mechanical sweep, ZERO findings: `grep -L "dependencies=[Depends(get_current_user)]" app/api/routes/*.py` -> only login/users/utils/__init__ (per-route auth hand-verified by the QA seat); all four 403 literals in app/ are PRIVILEGE-class (superuser rules), none CREDENTIAL; `_STATUS_TO_KIND` contains no 403 | recorded (zero-finding sweep) | grep outputs above; Haiku finder's original report was lost in transit -- checks re-run by the lead, independently corroborated by panel-qa |
| D2-verdict | Codex D2 | -- | Pre-merge audit final verdict after two reply rounds: all four findings CLOSED | SOUND for merge to master | thread 019f5d81-c7b3-7da0-bc69-1356d671a3ca |
| INT-1 | lead (S7 ship, CI at merge SHA) | MED | Playwright CI red at 0b83cd2: Dockerfile.playwright image v1.58.2 vs bun.lock @playwright/test 1.61.1 (browsers missing in image); PRE-EXISTING latent mismatch, first playwright run since 2026-07-04 | fixed | image bumped to v1.61.1-noble + frozen install (ship commit 4260831); browsers launched at the transition-SHA run 29289701259, which then surfaced INT-2 |
| INT-2 | lead (S7 ship, CI at transition SHA) | LOW | Playwright CI still red at 4260831: @axe-core/react's dev-only a11y logging ("Fix any of the following") lands inside the smoke console-error assertion on slow CI runners (1000ms debounce race); PRE-EXISTING flake -- axe + the assertion both predate the sprint | fixed | smoke console filter excludes the axe dev-aid output; local 35/35; VERIFIED at fix SHA 954bd00: Playwright run 29290236523 success (with Test Backend 29290236855, Docker Compose 29290236585, Zizmor 29290236693 all green -- master CI fully green). Underlying a11y findings ledgered as DEBT-4. |

### sprint-02 review ledger (run sprint-02-run-1)

Dispositions: fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION. D1 dispositions detailed in docs/sprints/sprint-02-spec.md; verdict SOUND after the reply round (thread 019f5da8-4c83-7f03-8c0c-7eae419b51eb).

| ID | Reviewer | Sev | Finding | Disposition | Closure evidence |
|---|---|---|---|---|---|
| S02-D1-1 | Codex D1 (thread 019f5da8) | HIGH | Frozen contract has no create-job op; browser-created job cannot be delivered by DB-backing reads alone | fixed | PIN-1/8/9: createApplication is the DB write path; core-journey creates a unique-content job and asserts it lists (commit cf3d268) |
| S02-D1-2 | Codex D1 | HIGH | "Jobs ops served from DB" can pass with the vertical partly mock-backed | fixed | PIN-2 routing split (amended in reply round, SOUND): getJobs/getJob flip + DB-backed; getJobsInbox stays planned+mock; browser default /jobs list rewired onto getJobs, network-asserted in core-journey; provenance discriminators test_store_only_job_is_not_served / test_db_only_job_is_served |
| S02-D1-3 | Codex D1 | HIGH | Partial-unique dedup index required with no decided key/predicate | fixed | PIN-3: UNIQUE(user_id, source_url) WHERE source_url IS NOT NULL; test_dedup_index_is_partial_on_source_url + test_dedup_index_behavior green |
| S02-D1-4 | Codex D1 | HIGH | JSONB convention weakened (ranges + drift test dropped) | disproved-with-evidence | the depth IS the PO-recorded advisory default in Wes-authored approved-queue.md rev 1 (commit 9d3a784); the dropped drift artifact restored: test_every_demo_fixture_round_trips_wire_row_wire green |
| S02-D1-5 | Codex D1 | HIGH | schema_version omitted from the exemplar | fixed | ck_job_schema_version + column NOT NULL DEFAULT 1; test_schema_version_defaults_to_one green |
| S02-D1-6 | Codex D1 | HIGH | Migration evidence does not discriminate convention completeness | fixed | tests/migrations/test_job_table.py: per-convention introspection + 14 negative-insert cases (AC-01a..h), 15 tests green under app_runtime |
| S02-D1-7 | Codex D1 | HIGH | Tenancy evidence cannot prove RLS is the mechanism | fixed | PIN-7 raw-SQL tests under SET ROLE app_runtime: no-WHERE sees only own rows, no-GUC sees zero, WITH CHECK rejects cross-tenant insert, relforcerowsecurity asserted; correctness seat independently confirmed |
| S02-D1-8 | Codex D1 | HIGH | Browser evidence satisfiable by seeded/pre-existing data | fixed | core-journey uses a per-run unique company string, asserts absent-before / present-after / present-after-reload on the getJobs-backed list |
| S02-D1-9..13 | Codex D1 | MED | umbrella predicates / write-matrix overclaim / manifest-flip not falsifiable / CI non-discriminating / master reachability | fixed | AC matrix maps each convention+op to a named test; AC-03 states the no-mutation-op fact from the contract; PIN-10 master-SHA + no-skip binding; provenance discriminators |
| S02-D1-14 | Codex D1 | LOW | frozen-non-blocking is mechanically gameable | recorded (no action; process-defined) | disputed-severity=release-blocking rule (process section 4) is the standing mitigation |
| COR-1..3 | panel-correctness (Opus) | INFO | PEP-758 except is valid 3.14; malformed-GUC fails closed; route tests defense-in-depth (RLS independently proven) | recorded (controls confirmed) | panel-correctness.md; charter answer YES, no HIGH/MED |
| COR-4 | panel-correctness | INFO | RLS + dedup index live only in the migration, not model metadata -> autogenerate-drift risk | recorded -> DEBT-6 | future `alembic revision --autogenerate` could emit a spurious drop_index; noted for the next migration author |
| SIM-1 | panel-simplification (Sonnet) | MED | jobs screen fires both useJobs + useJobsInbox unconditionally, throwing one away | fixed | useAsyncResource gains an enabled gate; jobs screen fetches only the active source (commit 88bbc5b); build + core-journey green |
| SIM-2 | panel-simplification | MED | job.user_id lacks ondelete CASCADE -> growing manual FK-teardown chain across seed + tests | fixed | ON DELETE CASCADE on job.user_id; manual DELETE FROM job removed from seed.py + test_seed.py; confdeltype='c' verified; 42 seed+migration tests green (commit 88bbc5b) |
| SIM-3 | panel-simplification | LOW | none_as_null required on every nullable JSONB column (else the named CHECK silently never fires on NULL) -- documented on one field only | recorded -> retro PR + DEBT-7 | central callout needed before sprint-03 adds a nullable JSONB column |
| SIM-4/5/6 | panel-simplification | INFO | positive: no autouse fixtures; duplicate scratch-DB machinery consolidated into conftest (LOC reduction); no new module-constant W-1 violations | recorded (zero-defect) | panel-simplification.md |
| SWEEP | Haiku finder + lead | -- | Enumeration corroborates QA-1's scope: shortlist/forkResumeAsDraft/getMatchReport/deep-score also reference job data through the un-tenanted mock store (pre-existing); manifest flip is exactly getJobs+getJob | recorded (no new distinct finding) | sweep-finder.md; same mock-layer root cause as QA-1 |
| QA-1 | panel-qa (Sonnet) + Codex D2-1 | HIGH | Mock Application routes (getApplication/dismiss/transition/markWon/...) do zero ownership checks; PIN-9 made createApplication write REAL user-typed job data into that shared mock store, so an intruder with any valid token + an application id reads/mutates another tenant's captured job data | **waived-by-Wes (re-scope) -> DEBT-5** | PO decision 2026-07-13 (recorded, AskUserQuestion): conjunct 3 is scoped to the DB-backed Job resource; the shared mock Application/searches/resume/shortlist layer is accepted as a known pre-existing gap (v3: "everything else stays entirely mock-served"), structural fix when applications go DB-side in sprint-04. Runnable probes archived scratchpad/probes/. Tracked as DEBT-5 |
| S02-D2-1 | Codex D2 (thread 019f5df8-f956-7112-84f1-a77116522c7d) | HIGH | Done-when conjunct 3 violated as written -- the run-1 manifest did not scope it to Job DB ops, and QA-1 leaks captured job data via the mock Application resource | resolved-by-PO-re-plan | Wes re-scoped conjunct 3 to the DB Job resource; superseding run manifest sprint-02-run-2 (above) carries the narrowed conjunct, run-1 stands as the historical record. D2's own prescribed path (new run manifest + DEBT-5). Narrowed conjunct 3 evidence: test_get_jobs_excludes_other_tenants_rows + test_cross_tenant_get_job_404_indistinguishable_from_unknown green |
| S02-D2-2 | Codex D2 | HIGH | "Review ledger closed" row was false: progress.md claimed S02-D1-1..14 ledgered but the ledger held only sprint-01 rows | fixed | this sprint-02 ledger block written (commit pending); D2 re-audit reply sent |
| COR/QA controls | panel-qa QA-2/3/4 | INFO | RLS backstop holds with no WHERE + unset GUC; cross-tenant 404 byte-identical incl. headers; getJobs collection filtering + caller-stamped mint re-verified non-vacuous | recorded (controls confirmed) | panel-qa.md |
| INT-3 | lead (S7 ship, CI at merge/self-advance SHA) | MED | Playwright CI red at 3363e16: e2e `envVal()` read the repo-root `.env` before honoring its fallback, so the demo-tenant `SEED_DEMO_*` creds (not in the CI Playwright container env; `.env` gitignored/absent there) threw ENOENT in globalSetup. Green locally, red in CI. | fixed | envVal wraps the read in try/catch so a fallback survives an absent file; core-journey logs in as the demo user with fallbacked creds (commit 07dd4bf). VERIFIED master CI fully green at 07dd4bf: Playwright run 29298986175 success (Test Backend 29298986178, Docker Compose 29298986172, Zizmor 29298986168 all success). Security-review flag on the `employa-demo-1` fallback acknowledged: non-secret local-only demo default (Settings.SEED_DEMO_PASSWORD; seed.py refuses it outside local), already public in the repo. |

### sprint-03 review ledger (run sprint-03-run-1)

Dispositions detailed in docs/sprints/sprint-03-spec.md. D1 thread 019f5eaa (SOUND after replies); D2 thread 019f5eca (SOUND at c0bd8b1).

| ID | Reviewer | Sev | Finding | Disposition | Closure evidence |
|---|---|---|---|---|---|
| S03-D1-1..11 | Codex D1 | HIGH/MED/LOW | 11 findings on the fresh Goal block (journey-exercises-FK, DB/mock split, dedup semantics, nullable job_id, JSONB/schema_version/drift, snapshot semantics, D2-fires) | fixed / disproved-with-evidence / PO-decision | dispositions table in sprint-03-spec.md; D1 verdict SOUND after 3 replies |
| S03-D1-3 | Codex D1 + PO | HIGH | duplicate-add response semantics contract-silent | waived->PO decision | Wes ruled 409 conflict (AskUserQuestion 2026-07-13); AC-02b asserts one-201/one-409 |
| QA-1 | sl-qa (Sonnet) | INFO->fixed | catch-all except IntegrityError->409 could mislabel a TOCTOU composite-FK fire | fixed | narrowed to _constraint_name == uq_shortlist_user_job; else re-raise (commit c1231f4) |
| QA-2 | sl-qa | INFO | unrecognized searchId returns mock default (pre-existing) | subsumed by SIM-2 fix | unrecognized searchId now -> DB default (c1231f4) |
| QA-3/4 (controls) | sl-qa | -- | RLS holds via bypassed-predicate raw SELECT; WITH CHECK rejects spoofed user_id; cross-tenant list/dismiss/add all clean | recorded (PASS) | sl-qa.md; zero tenancy findings |
| COR-1 | sl-correctness (Opus) | MED | "concurrent" dedup test was sequential | fixed (= D2-1) | replaced by concurrent-route [201,409] test + two-connection lock_timeout test (c0bd8b1) |
| COR-2 | sl-correctness | LOW | route maps all IntegrityError->409 | fixed | = QA-1/SIM-1 narrowing (c1231f4) |
| COR (controls) | sl-correctness | -- | composite FK + RLS complementary; salary CHECK airtight (jsonb-null/{}/missing-key rejected); DEBT-6 index intact; manifest flip honest; tests discriminate | recorded (charter YES) | sl-correctness.md |
| SIM-1 | sl-simplification (Sonnet) | MED | 404-vs-409 disambiguation relied on the FK case being unreachable, not distinguished | fixed | constraint-name disambiguation (c1231f4); flagged for sprint-04 children |
| SIM-2 | sl-simplification | LOW-MED | dead store.shortlist searchId fallback (write-dead, untested) | fixed | unrecognized searchId -> DB default + test (c1231f4) |
| SIM (rubric) | sl-simplification | -- | mechanical scaffolding copies cleanly; 6/10 (composite-FK/dedup residual judgment now explicit) | recorded | sl-simplification.md; sprint-04 copy verdict recorded |
| SWEEP | Haiku finder (lost) + lead re-run | -- | 8-list ownership enumeration: no orphan store writes, every id/jobId path ownership-validated, 3 ops flipped, DEBT-6 index intact | recorded (no distinct finding) | scratchpad/sl-sweep.md (lead re-run) |
| S03-D2-1 | Codex D2 (thread 019f5eca) | HIGH | AC-02b test sequential, not a concurrent route race | fixed | test_concurrent_route_add_one_201_one_409 (two threads, shared client) -> [201,409] + one row (c0bd8b1); D2 confirmed close |
| S03-D2-2 | Codex D2 | HIGH | composite-FK cross-tenant rejection tested only as owner | fixed | test_composite_fk_is_the_backstop_under_app_runtime under SET ROLE app_runtime + GUC (c1231f4) |
| S03-D2-3 | Codex D2 | HIGH | ledger + retarget not yet done | fixed | this ship step: ledger written, GOAL.md self-advanced to sprint-04 |
| S03-D2-4 | Codex D2 | MED | no jsonb 'null' salary case / named-CHECK introspection | fixed | test_named_checks_exist + salary='null'::jsonb negative case (d3c5202) |

## Open-debt ledger

| ID | Description + evidence | Severity | Affected AC | Owner | Release-blocking | Target phase |
|---|---|---|---|---|---|---|
| DEBT-1 | Login throttle is in-memory, single-process only (app/core/throttle.py docstring) | low | AC-08 | backend | no | when multi-worker deploy exists (post-0.1) |
| DEBT-2 | Vite dev mode runs without the meta CSP (react-refresh inline preamble; recorded queue default). Production builds and the API header are covered. | low | AC-08 | frontend | no | real deploy target (post-0.1) |
| DEBT-3 | UNDO_WINDOW_SECONDS=300 hardcoded in the MOCK applications route; becomes a Settings value when sprint-04 replaces that code with the real DB implementation | low | -- | backend | no | sprint-04 |
| DEBT-4 | Axe dev-check reports real a11y violations on /agents and /dashboard ("element has focusable descendants", "content not contained by landmarks") -- logged, filtered from the smoke gate; the accessibility gate itself is deferred per plan v3's register | low | -- | frontend | no | post-0.1 (v3 deferred register) |
| DEBT-5 | The mock Application/searches/resume/shortlist layer is a shared single-tenant store with no ownership checks (sprint-01 design: mock routes are "valid token", the store is decoupled from DB user identity). Since sprint-02 PIN-9, createApplication carries REAL user-typed job data into it, so an intruder with a valid token + an application id can read/dismiss another tenant's captured job data (QA-1/D2-1, probes in scratchpad/probes/). The DB `job` vertical is correctly tenant-isolated; this is the adjacent mock layer. PO-accepted 2026-07-13 (conjunct 3 re-scoped to the Job resource). | HIGH (mock-layer) | conjunct 3 (Job-scoped) | backend | no (prototype; single-founder learning artifact, not a multi-tenant deploy) | sprint-04 (applications go DB-side + tenant-isolated) |
| DEBT-6 | RLS policy + partial-unique dedup indexes live only in the migrations (raw op.execute), not in model metadata -- job (4c17ea8b5656) AND shortlist_entry (4317eb75f1cd, incl. the composite FK); a future `alembic revision --autogenerate` emits a spurious drop for them (observed and hand-removed in the shortlist migration). Every new tenant migration must hand-strip the autogenerate drops. | low | -- | backend | no | next migration / when autogenerate is next run |
| DEBT-7 | `sa_type=JSONB(none_as_null=True)` is mandatory on every nullable JSONB column (else psycopg sends jsonb 'null' and the named CHECK silently never fires on NULL); documented on one field, silently required on the rest (SIM-3). Needs a central callout before sprint-03 adds a nullable JSONB column. | low | -- | backend | no | sprint-03 (retro pattern PR) |

## Parked tangents

(Agenda for the next S0, or route to the ideas repo.)

- Build the goal-treadmill plugin in agent-ops (validators, snapshot/audit tooling, Stop-hook packaging) -- Release 0.1 is its pilot evidence. Design: docs/plans/loop-research/goal-treadmill-workflow-design.md.
- CLAUDE.md/AGENTS.md sync as a real cross-platform agent-ops feature (Codex support) -- parked 2026-07-12.

## Clean-session handoff

An unfamiliar agent resuming this repo should read, in order: `GOAL.md` (current contract), this file (current state), `docs/plans/loop-research/approved-queue.md` (the queue, Wes-only), `docs/plans/full-stack-implementation-plan-v3.md` (binding spec), `docs/plans/loop-research/sprint-treadmill-process.md` (the operating process), and `CLAUDE.md` (commands + traps). Then run the resume preflight before invoking /goal.
