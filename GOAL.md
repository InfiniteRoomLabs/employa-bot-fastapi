---
goal_protocol: 1
queue_revision: 1
current_phase: sprint-04-applications-resume-snapshot
current_checkpoint: ADVISORY
current_run_id: sprint-04-run-1
next_phase: sprint-05-fake-ai-seam
terminal_phase: gate-0.1-terminal-audit
approved_queue: docs/plans/loop-research/approved-queue.md
approved_plan: docs/plans/full-stack-implementation-plan-v3.md
process_spec: docs/plans/loop-research/sprint-treadmill-process.md
progress_log: docs/progress.md
consecutive_clean_reviews: 0
status: ready
---

# GOAL.md -- current executable work contract

Operator runbook: sprint-04 is ADVISORY and HIGH-RISK -- the release long pole (7-12 sessions). A SYNCHRONOUS S0 read-back is required (fresh Goal block -- Codex D1 MUST fire pre-guard; D2 MUST fire pre-merge: append-only mechanics + populated concurrency + the exemplar guarded-UPDATE). At S0, diff this queue copy against approved-queue.md rev 1, ratify the sprint-03 retro proposals PR-5..PR-8 (default: adopt) into Proven patterns, and confirm the multi-session plan (3a/3b/3c are internal checkpoints on ONE branch, ONE final merge to master -- v3's abandonment-safety rule: applications+resume+snapshot move together). Then run the resume preflight and invoke `/goal Complete the snapshotted current run in @GOAL.md`. At S1 guard-on, append the run manifest to docs/progress.md and commit before any work.

## Goal -- Sprint 04: B3 WHOLE (applications + minimal resume + snapshot)

> Do not stop until the applications+resume+snapshot slice is integrated on master (ONE merge) and GOAL.md is retargeted.
> 1. Investigation -- map the mock applications surface (createApplication already mints a job + ids-only application; transitionApplication with the LEGAL_TRANSITIONS matrix; markWon/undoMarkWon/dismiss/reactivate/timeline/snapshot; resume routes) and the resume/snapshot wire schemas + store fixtures + frontend consumers; confirm the append-only machinery (migration 075675058c67 enforce_append_only + app_runtime) and the composite-FK child pattern (sprint-03 shortlist_entry exemplar). Label CONFIRMED/INFERRED/UNKNOWN.
> 2. Spec -- binding spec is plan v3 "Phase B" item 3 (3a/3b/3c) + Design conventions (append-only tables via role REVOKE + triggers; the ONE stage-mutation DB function; guarded versioned UPDATE; composite tenant FKs on every child); mint AC IDs; charter the panel seats (QA: "can intruder_client read/mutate another user's application, transition, snapshot, or resume via any op or nested id -- all tenant-indistinguishable 404s?"; correctness/security (Opus): "does the guarded UPDATE ... WHERE id AND user_id AND version=:expected AND stage=:from RETURNING abort on zero rows BEFORE any child write; does APPLIED snapshot+resume-lock happen in ONE transaction; is stage_transition/resume_snapshot append-only under app_runtime (REVOKE + trigger); does the two-connection test leave exactly one winner and NO orphan child rows; is undo a compensating transition, never a history delete?"; simplification: "did the child tables copy the shortlist composite-FK exemplar mechanically, or expose an accident?").
> 3. Implementation -- branch sprint-04-apps-resume-snapshot. Internal checkpoints (each gated + committed, resumable via the multi-session rule): 3a CRUD + read projection (application, minimal resume; application_view() join; NO transitions). 3b transitions + concurrency + history + snapshot (stage_transition append-only via the mutation-function pattern; the guarded versioned UPDATE; APPLIED materializes resume_snapshot + resume-lock in the same transaction; two-connection test). 3c markWon/undo/dismiss/reactivate/timeline (persistent undo_grant table consumed atomically; undo = compensating transition per v3 Data-integrity #8; set-default-resume locks the user row first). Seed extends to demo applications/resumes behind the gate. `frontend/e2e/core-journey.spec.ts` EXTENDED through application -> legal transitions -> applied (resume required) -> one illegal transition rejected (invalid_transition envelope) -> resume locked + snapshot visible.
> 4. Reviews -- 3-seat panel per charters; ownership-matrix sweep (every child table's composite FK, every id-addressed op); Codex D1 pre-guard (fresh block -- MUST); Codex D2 pre-merge (append-only + populated concurrency + guarded-UPDATE exemplar -- MUST). Ledger closed per process spec section 4 dispositions.
> 5. Ship -- bash scripts/lint.sh + both suites + compose boot green; progress.md completed-sprint entry, retro (2 questions, <=10 lines), cost line; self-advance this file to sprint-05-fake-ai-seam.
> Done when: the `application` / `stage_transition` / minimal `resume` / `resume_snapshot` tables exist via a migration satisfying every binding convention (tenant user_id + composite UNIQUE(user_id, id) anchors, composite FKs on every child (user_id, <parent>_id) -> parent(user_id, id), FORCE RLS under app_runtime != owner, timestamptz, NUMERIC money where present, append-only enforcement on stage_transition + resume_snapshot via role REVOKE + triggers) with migration tests green under app_runtime AND the applications/resume/snapshot contract operations are served from the database with their manifest entries flipped to implemented and contract fidelity green AND the guarded versioned UPDATE aborts on zero rows before any child write, proven by a two-connection test where exactly one of two same-version transition requests commits and the loser leaves NO orphan child rows AND an illegal transition is rejected with the invalid_transition envelope AND undo is a compensating transition (never a history delete) AND the ownership-matrix tenancy tests pass (intruder_client cross-tenant reads/writes across every application/resume/snapshot op all fail as tenant-indistinguishable 404s) AND frontend/e2e/core-journey.spec.ts is extended through job -> shortlist -> application -> applied (resume required, one illegal transition rejected) -> resume locked + snapshot visible, green from a fresh seed and required in CI AND the review ledger has no finding outside a terminal disposition AND GOAL.md is retargeted to sprint-05-fake-ai-seam and committed.
> Advisory questions and recorded defaults: see approved-queue.md sprint-04 (two-connection test shape -> proceed when exactly-one-winner AND no-orphan-child-rows both assert on DB state under the runtime role; undo semantics -> compensating transition source=user_correction + corrects_transition_id, never a history delete -- the mock's verbatim behavior is explicitly NOT ported).
> Stop only for: a contract question mvp-api.yaml cannot answer (HUMAN DECISION); any change that would require editing mvp-api.yaml; an open review finding requiring a PO waiver (options + evidence written to the ledger); a release-blocking frozen finding.

## Completion evidence

| Predicate | Evidence (commit SHA + exact command + exit status + durable output) | Verification command |
|---|---|---|
| application/stage_transition/resume/resume_snapshot migration under conventions | migration file(s) + tests green under app_runtime at the master SHA (composite FKs, append-only REVOKE+trigger, guarded UPDATE) | cd backend && POSTGRES_SERVER=localhost uv run pytest tests/migrations -q |
| guarded UPDATE + two-connection concurrency | exactly-one-winner + no-orphan-child-rows asserted on DB state under app_runtime | POSTGRES_SERVER=localhost uv run pytest tests/api -q -k "transition or concurren" |
| append-only enforced | stage_transition/resume_snapshot refuse UPDATE/DELETE under app_runtime (REVOKE + trigger) | POSTGRES_SERVER=localhost uv run pytest tests/migrations -q -k "append" |
| ops DB-backed + manifest flipped | contract + fidelity tests green; manifest diff | uv run pytest tests/contract -q && git show HEAD -- docs/operation-ownership.yaml |
| tenancy ownership matrix | intruder tests green on DB state across every app/resume/snapshot op | POSTGRES_SERVER=localhost uv run pytest tests/api -q -k "intruder or tenant" |
| journey through applied+snapshot | core-journey transcript from a fresh seed (job -> shortlist -> application -> applied -> snapshot) incl. invalid_transition rejection | cd frontend && bunx playwright test e2e/core-journey.spec.ts |
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
- Mock route pattern exemplar: `backend/app/api/routes/searches.py`. Error envelope: raise `ApiError` subclasses from `app/api/errors.py`, never HTTPException, in mock routes.
- DB-tenant-vertical exemplar (sprint-02, ratified PR-1..PR-4 at sprint-03 S0): the `job` table + `backend/app/api/routes/jobs.py` are the copy-template for every DB-backed tenant resource. (PR-1) route DB access goes through the `get_tenant_session` dependency in `deps.py` (`SET LOCAL ROLE app_runtime` + `set_config('app.user_id', :uid, true)`; RLS is the backstop, the app-level `.where(user_id==...)` is the belt) -- copy it, do not hand-roll session role/GUC. (PR-2) every tenant-child FK carries `ondelete="CASCADE"` so user teardown stays one DELETE. (PR-3) nullable JSONB columns MUST use `sa_type=JSONB(none_as_null=True)` paired with named `(...) IS TRUE`-wrapped CHECKs -- else the CHECK silently skips SQL NULL. (PR-4) e2e/smoke authenticate as the DEMO tenant (creds via `envVal(..., fallback)` so the CI container needs no `.env`); a new DB vertical keeps its smoke/journey fixtures owned by the demo user. Wire<->row mapping lives in a per-resource `*_mapper.py` (hand-verify the field list per resource -- no shared helper by design). Migration recipe: copy `4c17ea8b5656` (ENABLE+FORCE RLS + policy + partial indexes via raw `op.execute`; the RLS/index are migration-only, NOT in the model -- DEBT-6 autogenerate caveat).
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
