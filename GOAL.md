---
goal_protocol: 1
queue_revision: 1
current_phase: sprint-03-shortlist
current_checkpoint: ADVISORY
current_run_id: sprint-03-run-1
next_phase: sprint-04-applications-resume-snapshot
terminal_phase: gate-0.1-terminal-audit
approved_queue: docs/plans/loop-research/approved-queue.md
approved_plan: docs/plans/full-stack-implementation-plan-v3.md
process_spec: docs/plans/loop-research/sprint-treadmill-process.md
progress_log: docs/progress.md
consecutive_clean_reviews: 0
status: ready
---

# GOAL.md -- current executable work contract

Operator runbook: sprint-03 is ADVISORY, so a SYNCHRONOUS S0 read-back is required before guard-on (this Goal block is a FRESH draft -- Codex D1 MUST fire pre-guard). At S0, diff this queue copy against approved-queue.md rev 1, ratify the sprint-02 retro proposals PR-1..PR-4 (default: adopt) into Proven patterns, and decide D2: the queue derives "none" for sprint-03 (empty-table pattern-repeat), but `shortlist_entry` ships the FIRST composite-FK-to-a-parent instance -- weigh whether that is a discretionary D2 or is bracketed by the correctness seat + migration gates. Then run the resume preflight and invoke `/goal Complete the snapshotted current run in @GOAL.md`. At S1 guard-on, append the run manifest to docs/progress.md and commit before any work.

## Goal -- Sprint 03: B2 shortlist

> Do not stop until the DB-backed shortlist vertical is integrated on master and GOAL.md is retargeted.
> 1. Investigation -- map the mock shortlist surface (contract ops getShortlist/addToShortlist/removeFromShortlist and any nested job reference, wire schemas, store fixtures, the jobs-screen useAddJobToShortlist + shortlist-screen consumers/hooks); confirm which ops DB-back vs stay mock (abandonment-safety: no DB row may reference a mock entity); inventory what `shortlist_entry` needs from the binding conventions AND from the sprint-02 job exemplar copy-map (docs/sprints/sprint-02-spec.md + panel-simplification copy map). Label CONFIRMED/INFERRED/UNKNOWN.
> 2. Spec -- binding spec is plan v3 "Phase B" item 2 + Design conventions; mint AC IDs per Done-when conjunct; produce the exemplar-coverage mapping (which sprint-02 patterns cover shortlist's tenancy/dedup/UI/migration work -- this is the queue's promotion-path artifact, Codex F13) + one recorded rubric score; charter the panel seats (QA: "can intruder_client see or mutate another user's shortlist entry via list, get, dedup-create, or the composite job reference -- and is every id-addressed miss a tenant-indistinguishable 404?"; correctness: "does the composite FK (user_id, job_id) -> job(user_id, id) make a cross-tenant job_id fail at the DB, and does unique(user_id, job_id) hold under a two-request race?"; simplification: "did the exemplar actually copy mechanically, or did the copy expose a job-specific accident in the sprint-02 pattern?").
> 3. Implementation -- branch sprint-03-shortlist. `shortlist_entry` migration copies the job exemplar (tenant user_id, UNIQUE(user_id, id) anchor + ON DELETE CASCADE FK, FORCE RLS on the app.user_id GUC under app_runtime, timestamptz), PLUS the first composite FK (user_id, job_id) -> job(user_id, id) and the dedup UNIQUE(user_id, job_id); DB-backed shortlist routes via the get_tenant_session pattern (PR-1); seed extends to demo shortlist entries; `frontend/e2e/core-journey.spec.ts` is EXTENDED: after creating a job, add it to the shortlist and assert it appears, green from a fresh seed.
> 4. Reviews -- 3-seat panel per charters; ownership-matrix sweep of the DB-backed shortlist resource (dedup-create with another tenant's job_id, composite-FK cross-tenant rejection, list/get 404s); Codex D1 pre-guard (fresh block -- MUST trigger); Codex D2 per the S0 ruling (queue: none; composite-FK-first-instance may warrant discretionary). Ledger closed per process spec section 4 dispositions.
> 5. Ship -- bash scripts/lint.sh + both suites + compose boot green; progress.md completed-sprint entry, retro (2 questions, <=10 lines), cost line; self-advance this file to sprint-04-applications-resume-snapshot.
> Done when: the `shortlist_entry` table exists via a migration satisfying the binding conventions (tenant user_id, composite UNIQUE(user_id, id) anchor, FORCE RLS under app_runtime != owner, timestamptz) with the dedup UNIQUE(user_id, job_id) live AND the composite FK (user_id, job_id) -> job(user_id, id) rejects a cross-tenant job_id at the DB (proven under app_runtime) with migration tests green AND the shortlist contract operations are served from the database with their manifest entries flipped to implemented and contract fidelity green AND the ownership-matrix tenancy tests pass (intruder_client cross-tenant reads/dedup-creates all fail as tenant-indistinguishable 404s) AND frontend/e2e/core-journey.spec.ts is extended through login -> create job -> add to shortlist -> shortlist lists, green from a fresh seed and required in CI AND the review ledger has no finding outside a terminal disposition AND GOAL.md is retargeted to sprint-04-applications-resume-snapshot and committed.
> Advisory questions and recorded defaults: see approved-queue.md sprint-03; promotion to AUTONOMOUS is a Wes-only queue edit (never self-advance) and only after the exemplar-coverage mapping + one recorded rubric score exist (Codex F13).
> Stop only for: a contract question mvp-api.yaml cannot answer (HUMAN DECISION); any change that would require editing mvp-api.yaml; an open review finding requiring a PO waiver (options + evidence written to the ledger); a release-blocking frozen finding.

## Completion evidence

| Predicate | Evidence (commit SHA + exact command + exit status + durable output) | Verification command |
|---|---|---|
| shortlist_entry migration under conventions + dedup + composite FK | migration file + tests green under app_runtime at the master SHA (composite-FK cross-tenant rejection + unique(user_id, job_id)) | cd backend && POSTGRES_SERVER=localhost uv run pytest tests/migrations -q |
| shortlist ops DB-backed + manifest flipped | contract + fidelity tests green; manifest diff | uv run pytest tests/contract -q -k "shortlist" && git show HEAD -- docs/operation-ownership.yaml |
| tenancy ownership matrix | intruder tests green on DB state (reads + dedup-create) | POSTGRES_SERVER=localhost uv run pytest tests/api -q -k "shortlist" |
| journey extended to shortlist | core-journey transcript from a fresh seed (job -> shortlist) | cd frontend && bunx playwright test e2e/core-journey.spec.ts |
| core-journey required in CI | workflow diff + CI run URL for the SHA | gh run view <id> |
| review ledger closed | ledger section in docs/progress.md | manual read |
| retarget | GOAL.md diff in the ship commit | git show HEAD -- GOAL.md |

Evidence binding: every row names the commit SHA it was produced against; stale evidence is re-run at S7, not trusted. Master reachability is part of every row (Codex D1-1, sprint-01): evidence binds to the MASTER merge SHA.

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
- Mock route pattern exemplar: `backend/app/api/routes/searches.py`. Error envelope: raise `ApiError` subclasses from `app/api/errors.py`, never HTTPException, in mock routes. DB-backed jobs routes should follow the sprint-01 getCurrentUser mapping pattern in `routes/account.py` until this sprint creates the richer exemplar.
- Test world: explicit fixtures in `backend/tests/conftest.py` (`db` rollback session, `client`, `db_client`, `intruder_client`, `seed_domain`); contract tests use `store_client`/`unauthenticated_client`; NO autouse fixtures anywhere. Seed/bootstrap tests write real rows with explicit cleanup (mixing them with the rollback world deadlocks on unique keys).
- Auth: every mock router carries `dependencies=[Depends(get_current_user)]`; ONE raise site in deps.py emits the uniform 401; do NOT add 403 to `_STATUS_TO_KIND` (contract maps unauthorized->401); login is throttled (Settings.LOGIN_THROTTLE_*) -- e2e suites must log in ONCE per run (see frontend/e2e/global-setup.ts).
- Known traps: `resume_lifecycle` must stay included before `resumes` in `api/main.py` (path shadowing); the backend test suite's seed tests DELETE the demo user during cleanup -- re-run `python -m app.scripts.seed` (or prestart) after running the suite against the dev DB; changelog-guard requires a CHANGELOG entry on master commits; commit guard forbids .env in commits (wire env defaults through compose.yml); stage files explicitly (no -a).
- Append-only machinery: migration 075675058c67 provides `enforce_append_only(regclass)` + the `app_runtime` role -- new append-only tables call the SQL function and add behavioral tests under `SET LOCAL ROLE app_runtime` (pattern: backend/tests/migrations/test_migration_gates.py).
- Encoding: ASCII-only prose in docs (Spec-Kitty gate).
- Review discipline: findings ledger lives in docs/progress.md; dispositions are fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION (illegal at gate-0.1). Fanned finder/verifier agents must WRITE their report to a file (a lost-in-transit Haiku report cost a re-run in sprint-01).

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
