---
goal_protocol: 1
queue_revision: 1
current_phase: gate-0.1-terminal-audit
current_checkpoint: HUMAN DECISION
current_run_id: gate-0.1-run-1
next_phase: none
terminal_phase: gate-0.1-terminal-audit
approved_queue: docs/plans/loop-research/approved-queue.md
approved_plan: docs/plans/full-stack-implementation-plan-v3.md
process_spec: docs/plans/loop-research/sprint-treadmill-process.md
progress_log: docs/progress.md
consecutive_clean_reviews: 1
status: COMPLETE
---

# GOAL.md -- current executable work contract

Operator runbook: this is the TERMINAL phase (gate-0.1-terminal-audit), a HUMAN DECISION checkpoint -- the Release 0.1 audit, NOT an implementation sprint. All five implementation sprints (01-05) have shipped: the founder journey (login -> job -> shortlist -> application+transitions+snapshot -> fake match score) is one abandonment-safe DB-backed vertical on master. The self-advance may NOT invent further work past this phase (Codex F11/terminal rule). At the audit: run the Codex release audit against the e2e journey + a fresh-clone drill + the incrementally-built AC traceability matrix; frozen ledger dispositions are ILLEGAL here (every open finding must reach fixed / disproved-with-evidence / waived-by-Wes). PASS -> set status: COMPLETE, remove the active work goal, summarize optional debt, stop -- NO retarget. FAIL -> status: BLOCKED with the failing evidence + a proposed repair scope written as options for Wes; the queue pre-approves ONE gate-0.1-repair transition (scoped to the audit's named failures only). A second FAIL is a HUMAN DECISION with no pre-approved path.

## Release 0.1: COMPLETE (terminal audit PASS, 2026-07-20)

No approved phases remain in queue rev 1; no active work goal exists; NO retarget. The audit record is docs/audits/release-0.1-terminal-audit.md: original verdict FAIL (4 traceability failures, no product defect), Wes-authorized gate-0.1-repair (two passes; the re-audit caught the first pass's incomplete GA-3), re-audit PASS at master 9116800 (thread 019f6865). The founder journey was ruled proven-discriminating end to end from a clean clone. The ship/no-ship call on Release 0.1 itself is Wes's, made on that record.

Optional post-0.1 debt (all triaged non-blocking; full table in the audit doc section 5): DEBT-1 in-memory throttle; DEBT-2 vite-dev CSP; DEBT-4 a11y findings; DEBT-5 mock-search fixture pools (retire with searches in 0.2); DEBT-6 autogenerate hand-strip; DEBT-7 none_as_null callout; DEBT-8 move-stage quick-action mockups; DEBT-9 prod-build font CSP; DEBT-10 real-provider settlement reconciliation (Phase-C entry criterion); DEBT-11 sprint-04 SECURITY DEFINER bare search_path (first post-0.1 fix per PR-13); DEBT-12 candidate: CI runs no lint job (the format drift the repair disclosed was invisible to master CI).

Next work, when Wes ratifies it: the Release 0.2 browser-extension queue (docs/plans/browser-extension-plan-v1.md, DEC-EXT-001..004 recorded; entry criterion -- this COMPLETE state -- now satisfied), and the AI-integration / email-channel plans drafted from their deliberation syntheses.

## Completion evidence (gate-0.1 terminal audit -- filled when the audit runs)

| Predicate | Evidence (commit SHA + exact command + exit status + durable output) | Verification command |
|---|---|---|
| fresh-clone drill | PASS at f43ffe3 (fresh GitHub clone, fresh compose project + volumes): prestart seeds -> demo login 200 -> backend `POSTGRES_SERVER=localhost uv run pytest -q` 535 passed -> frontend build + 323 unit passed -> `bunx playwright test` 36/36 incl. core-journey -> `down -v` clean; condensed transcript in docs/audits/release-0.1-terminal-audit.md section 3. GA-3 caveat RESOLVED by the repair: scripts/test.sh, CLAUDE.md, and backend/README.md now document the canonical host recipe (test-local.sh deleted) | docs/audits/release-0.1-terminal-audit.md sections 3 + 8 |
| core-journey required in CI at the audited master SHA | all four workflows green at f83684b (Playwright run 29460780470 over the whole e2e dir), 1e61182, f43ffe3; NO branch-protection rule exists -- satisfied under the accepted process meaning per the Codex ruling (INFO, non-blocking) | gh run view 29460780470 |
| AC traceability matrix complete | 75/75 mapped after gate-0.1-repair (the two GAP rows name their repair tests); conjunct SATISFIED at 9116800 | manual read of the matrix |
| ledger has no frozen finding | all findings across sprints 01-05 at fixed / disproved-with-evidence / waived-by-Wes; `grep frozen docs/progress.md` -> zero disposition cells. The four gate-0.1 audit findings (GA-1..4) are fixed via the Wes-authorized repair (evidence in their ledger rows); zero open, zero frozen | manual read of docs/progress.md ledgers |
| Codex release audit verdict | thread 019f6865-95f7-7e12-b00b-294099f32d69: original FAIL (4 named failures) -> Wes-authorized repair (2 passes) -> re-audit **PASS** at master 9116800, "new blocking findings: none"; full record in audit doc sections 6-9 | read the audit doc |
| terminal state set | status: COMPLETE on the PASS re-audit; active work goal removed; optional debt summarized; NO retarget | git show HEAD -- GOAL.md |

Evidence binding: every row names the commit SHA it was produced against. The sprint-05-run-1 completion evidence (bound to merge SHA 3125d4b) is preserved in docs/progress.md's sprint-05 completed-sprint entry, not here -- this table is the terminal audit's own.

### Self-advance (last Ship step, every run)

1. Record this phase under Completed in docs/progress.md.
2. Select ONLY the next phase from the approved queue copy below; diff the copy against docs/plans/loop-research/approved-queue.md first.
3. Verify its entry criteria. Failed -> status: BLOCKED, write evidence, stop.
4. Rewrite the active Goal block for that phase, verbatim from the queue row.
5. Update consecutive_clean_reviews.
6. Commit the transition with the shipped work.
7. If no approved phases remain, set Current: COMPLETE, remove the active work goal, summarize optional debt, and stop.

Self-advance MAY NOT: create/split/merge/reorder phases, promote a checkpoint toward autonomy, alter acceptance criteria, waive findings, choose product direction, edit the authoritative queue file, or move past unmet entry criteria.

## Proven patterns

- Canonical commands: `cd backend && POSTGRES_SERVER=localhost uv run pytest -q` (DB tests need the compose db up); `uv run pytest tests/contract -q` (DB-free); `uv run bash scripts/lint.sh` (mypy strict + ty + ruff -- ALWAYS under `uv run`: bare python3 on this machine is 3.12 and produced a false HIGH panel finding in sprint-01); `cd frontend && bun run build && bun run test`; `bunx playwright test` (backend must be up); `docker compose watch` for the stack; `uv run prek run --all-files` pre-commit.
- Mock route pattern exemplar: `backend/app/api/routes/searches.py`. Error envelope: raise `ApiError` subclasses from `app/api/errors.py`, never HTTPException, in mock routes.
- DB-tenant-vertical exemplar (sprint-02, ratified PR-1..PR-4 at sprint-03 S0): the `job` table + `backend/app/api/routes/jobs.py` are the copy-template for every DB-backed tenant resource. (PR-1) route DB access goes through the `get_tenant_session` dependency in `deps.py` (`SET LOCAL ROLE app_runtime` + `set_config('app.user_id', :uid, true)`; RLS is the backstop, the app-level `.where(user_id==...)` is the belt) -- copy it, do not hand-roll session role/GUC. (PR-2) every tenant-child FK carries `ondelete="CASCADE"` so user teardown stays one DELETE. (PR-3) nullable JSONB columns MUST use `sa_type=JSONB(none_as_null=True)` paired with named `(...) IS TRUE`-wrapped CHECKs -- else the CHECK silently skips SQL NULL. (PR-4) e2e/smoke authenticate as the DEMO tenant (creds via `envVal(..., fallback)` so the CI container needs no `.env`); a new DB vertical keeps its smoke/journey fixtures owned by the demo user. Wire<->row mapping lives in a per-resource `*_mapper.py` (hand-verify the field list per resource -- no shared helper by design). Migration recipe: copy `4c17ea8b5656` (ENABLE+FORCE RLS + policy + partial indexes via raw `op.execute`; the RLS/index are migration-only, NOT in the model -- DEBT-6 autogenerate caveat).
- Test world: explicit fixtures in `backend/tests/conftest.py` (`db` rollback session, `client`, `db_client`, `intruder_client`, `seed_domain`); contract tests use `store_client`/`unauthenticated_client`; NO autouse fixtures anywhere. Seed/bootstrap tests write real rows with explicit cleanup (mixing them with the rollback world deadlocks on unique keys).
- Auth: every mock router carries `dependencies=[Depends(get_current_user)]`; ONE raise site in deps.py emits the uniform 401; do NOT add 403 to `_STATUS_TO_KIND` (contract maps unauthorized->401); login is throttled (Settings.LOGIN_THROTTLE_*) -- e2e suites must log in ONCE per run (see frontend/e2e/global-setup.ts).
- Known traps: `resume_lifecycle` must stay included before `resumes` in `api/main.py` (path shadowing); the backend test suite's seed tests DELETE the demo user during cleanup -- re-run `python -m app.scripts.seed` (or prestart) after running the suite against the dev DB; changelog-guard requires a CHANGELOG entry on master commits; commit guard forbids .env in commits (wire env defaults through compose.yml); stage files explicitly (no -a).
- Append-only machinery: migration 075675058c67 provides `enforce_append_only(regclass)` + the `app_runtime` role -- new append-only tables call the SQL function and add behavioral tests under `SET LOCAL ROLE app_runtime` (pattern: backend/tests/migrations/test_migration_gates.py).
- ORM/seed/test discipline (sprint-04, ratified PR-9..PR-12 at sprint-05 S0): (PR-9) multi-row ORM mutations whose intermediate state can violate a constraint need explicit `session.flush()` ordering between dependent inserts -- raw-SQL composite FKs (DEBT-6 class) are invisible to the unit-of-work's insert ordering. (PR-10) tests needing two identities must NOT pull both shared-TestClient fixtures (header mutation is fixture-order-dependent); build the second identity's state via direct DB inserts. (PR-11) seed fixtures that other rows composite-FK must be upserted in place, never delete+recreated (LC-1). (PR-12, process) the scratchpad is disposable (a machine crash erased /tmp mid-sprint-04): land work orders, fanned-agent reports, and running-ledger state in commits early; commit-boundary discipline + progress.md exact-next-action are the real crash protection.
- Composite-FK child exemplar (sprint-03, ratified PR-5..PR-8 at sprint-04 S0): `shortlist_entry` (migration 4317eb75f1cd) is the copy-template for child tables -- composite FK (user_id, parent_id) -> parent(user_id, id) via raw op.execute, MATCH SIMPLE for optional refs, partial unique for optional dedup. (PR-6) a route surfacing a DB constraint MUST disambiguate by constraint name (`exc.orig.diag.constraint_name`), never catch-all `except IntegrityError`, when >1 constraint can fire. (PR-7) two-connection/concurrency tests using session-level `SET ROLE` MUST invalidate() their connections (or use SET LOCAL) -- a pooled connection left as app_runtime breaks later owner-role inserts under FORCE RLS. (PR-8) a DB/mock split's no-match fallback is re-derived per resource, never mechanically inherited from a fully-mock op's shape.
- Encoding: ASCII-only prose in docs (Spec-Kitty gate).
- Review discipline: findings ledger lives in docs/progress.md; dispositions are fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION (illegal at gate-0.1). Fanned finder/verifier agents must WRITE their report to a file (a lost-in-transit Haiku report cost a re-run in sprint-01).
- SECURITY DEFINER search_path (sprint-05, ratified PR-13 at gate-0.1 S0): any SECURITY DEFINER function that reads a table an app_runtime caller could shadow MUST pin `SET search_path = public, pg_temp` (pg_temp LAST), and its introspection test MUST assert the exact proconfig value, not a substring -- a bare `= public` lets a TEMP-privileged caller shadow-read (panel F1). The sprint-04 functions (application_stage_transition, application_soft_remove) still carry bare `= public` -> DEBT-11.
- Reserve-then-settle exemplar (sprint-05, ratified PR-14 at gate-0.1 S0): the two-function shape (short reserve txn -> provider OUTSIDE any txn -> settle txn, with arm_tenant_transaction re-arming role+GUC after the mid-request commit) is the copy-template for any future "reserve external work, then record the result" flow; app/ai_flow.py is the exemplar.
- Review-tier limits (sprint-05, ratified PR-15 at gate-0.1 S0, process): Codex's sandbox cannot reach the compose postgres, so its audits run static-only -- keep a live-SQL correctness seat as a MUST on any sprint touching SECURITY DEFINER / privilege boundaries; never treat a green Codex D2 as covering runtime behavior it could not execute.

## Approved queue (copy of approved-queue.md rev 1)

| ID | Phase (v3) | Exit gate | Checkpoint | Hard-blocker check | Risk | Codex (per trigger function) |
|---|---|---|---|---|---|---|
| sprint-01 | Phase 0 + A (merged, PO decision rev 1) + v3 auth conventions | 401 boundary + auth hardening + all CI gates green | ADVISORY (attended dry run) | blocker present: process itself unproven, template first-of-kind | med | D1+D2 (fresh block; touches token verification) |
| sprint-02 | B1 jobs, manual capture | created job persists + lists in browser; core-journey covers login->job | ADVISORY | blocker present: no shipped DB-vertical exemplar -- this sprint CREATES it (first migration under the binding conventions, RLS, composite FKs) | med | D1+D2 (hard blocker; exemplar first-instance) |
| sprint-03 | B2 shortlist | unique(user_id, job_id) live; journey extended to shortlist | ADVISORY -- promotion path: Wes may flip to AUTONOMOUS by queue edit only after sprint-02 ships AND an exemplar-coverage mapping plus one recorded rubric score exist (Codex F13) | pending exemplar: one first-of-kind slice is asserted, not proven, to be representative | low | none (pattern-repeat; empty-table migration) |
| sprint-04 | B3 WHOLE: applications + minimal resume + snapshot together (internal checkpoints 3a/3b/3c commit to the sprint branch; ONE final merge to master) | 3c journey gate incl. invalid_transition envelope; two-connection test (one winner, no orphan child rows); journey extended through application->applied->locked resume+snapshot | ADVISORY | blocker present: known high-severity uncertainty (concurrency, append-only mechanics, undo/undo_grant semantics) | high | D1+D2 |
| sprint-05 | B4 fake AI seam | fake score persists + renders; reservation-cap two-connection test; journey extended to match score | ADVISORY | high: reservation arithmetic; append-only ai_run | high | D1+D2 |
| gate-0.1 | Terminal audit | core-journey.spec.ts required in CI; fresh-clone drill | HUMAN DECISION, TERMINAL | -- | -- | release audit |
| gate-0.1-repair | Pre-approved repair: may run ONLY after a FAIL audit, scoped to the audit's named failures, no new scope; returns to the terminal audit | audit's named failures closed with evidence | ADVISORY | -- | varies | per trigger function (derived from what the repair diff touches) |
