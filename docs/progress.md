# progress.md -- resumable operational state

PLAN (v3) says what we are building; this file says where we are. Update at every block boundary and at any permitted-blocker stop. Governing process: `docs/plans/loop-research/sprint-treadmill-process.md`.

## Current state

- Phase / run: sprint-02-jobs-manual-capture / sprint-02-run-1 (status: ready, NOT started)
- Active branch: master (sprint branch `sprint-02-jobs` not yet created)
- Last verified checkpoint: sprint-01 shipped and self-advanced (this commit)
- Exact next action: SYNCHRONOUS S0 read-back with Wes (sprint-02 is ADVISORY and its Goal block is a fresh draft), then Codex D1 on the block, then resume preflight + `/goal Complete the snapshotted current run in @GOAL.md` + run manifest.
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

(One entry per S1 guard-on: run_id, GOAL.md commit SHA, approved-queue.md commit SHA, Done-when conjuncts verbatim. The completion audit judges against the manifest, not against later edits.)

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
| INT-2 | lead (S7 ship, CI at transition SHA) | LOW | Playwright CI still red at 4260831: @axe-core/react's dev-only a11y logging ("Fix any of the following") lands inside the smoke console-error assertion on slow CI runners (1000ms debounce race); PRE-EXISTING flake -- axe + the assertion both predate the sprint | fixed | smoke console filter excludes the axe dev-aid output (a deferred gate per plan v3's register, not an app error); local 35/35; CI verification at the fix SHA recorded below when it lands. Underlying a11y findings ledgered as DEBT-4. |

## Open-debt ledger

| ID | Description + evidence | Severity | Affected AC | Owner | Release-blocking | Target phase |
|---|---|---|---|---|---|---|
| DEBT-1 | Login throttle is in-memory, single-process only (app/core/throttle.py docstring) | low | AC-08 | backend | no | when multi-worker deploy exists (post-0.1) |
| DEBT-2 | Vite dev mode runs without the meta CSP (react-refresh inline preamble; recorded queue default). Production builds and the API header are covered. | low | AC-08 | frontend | no | real deploy target (post-0.1) |
| DEBT-3 | UNDO_WINDOW_SECONDS=300 hardcoded in the MOCK applications route; becomes a Settings value when sprint-04 replaces that code with the real DB implementation | low | -- | backend | no | sprint-04 |
| DEBT-4 | Axe dev-check reports real a11y violations on /agents and /dashboard ("element has focusable descendants", "content not contained by landmarks") -- logged, filtered from the smoke gate; the accessibility gate itself is deferred per plan v3's register | low | -- | frontend | no | post-0.1 (v3 deferred register) |

## Parked tangents

(Agenda for the next S0, or route to the ideas repo.)

- Build the goal-treadmill plugin in agent-ops (validators, snapshot/audit tooling, Stop-hook packaging) -- Release 0.1 is its pilot evidence. Design: docs/plans/loop-research/goal-treadmill-workflow-design.md.
- CLAUDE.md/AGENTS.md sync as a real cross-platform agent-ops feature (Codex support) -- parked 2026-07-12.

## Clean-session handoff

An unfamiliar agent resuming this repo should read, in order: `GOAL.md` (current contract), this file (current state), `docs/plans/loop-research/approved-queue.md` (the queue, Wes-only), `docs/plans/full-stack-implementation-plan-v3.md` (binding spec), `docs/plans/loop-research/sprint-treadmill-process.md` (the operating process), and `CLAUDE.md` (commands + traps). Then run the resume preflight before invoking /goal.
