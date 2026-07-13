---
goal_protocol: 1
queue_revision: 1
current_phase: sprint-01-gates-and-foundation
current_checkpoint: ADVISORY
current_run_id: sprint-01-run-1
next_phase: sprint-02-jobs-manual-capture
terminal_phase: gate-0.1-terminal-audit
approved_queue: docs/plans/loop-research/approved-queue.md
approved_plan: docs/plans/full-stack-implementation-plan-v3.md
process_spec: docs/plans/loop-research/sprint-treadmill-process.md
progress_log: docs/progress.md
consecutive_clean_reviews: 0
status: ready
---

# GOAL.md -- current executable work contract

Operator runbook: run the resume preflight (see process spec, Runtime reality), then invoke `/goal Complete the snapshotted current run in @GOAL.md`. At S1 guard-on, append the run manifest to docs/progress.md and commit before any work. This sprint is an ATTENDED DRY RUN -- Wes watches the first self-advance land.

## Goal -- Sprint 01: Phase 0 gates + Phase A foundation

> Do not stop until the CI gates and the DB-backed auth boundary are integrated on master and GOAL.md is retargeted.
> 0. Entry -- verify /goal exists and its Stop hook blocks one attempted early stop; if not, run attended.
> 1. Investigation -- confirm generate-client.sh's current source; inventory mixed contract test files and their subsystem split; map every mock route missing CurrentUser. Label findings CONFIRMED/INFERRED/UNKNOWN.
> 2. Spec -- binding spec is plan v3 "Phase 0" + "Phase A" + Design conventions; mint AC IDs per Done-when conjunct; charter the panel seats (QA: "can any mock route be reached without a token?"; correctness: "do invalid/inactive/unknown tokens produce byte-identical 401 envelopes through one code path, and do the migration tests exercise the runtime role?"; simplification: "is any of the test-world plumbing autouse magic v3 forbids?").
> 3. Implementation -- branch sprint-01-foundation. Packets: (P1) generate-client.sh reads mvp-api.yaml; (P2) CI generated-diff job + migration tests (empty-upgrade, head singularity, append-only trigger tests under the runtime role) + manifest validation, coverage gate to advisory; (P3) one DB test world: engine, outer-transaction rollback fixture, explicit db_client/store_client/intruder_client, seed_domain, no autouse-by-directory magic; (P4) split mixed contract test files by subsystem; (P5) auth boundary as ONE commit: CurrentUser on every mock route, 401 normalization, getCurrentUser served from the DB as the first implemented op, contract fidelity test; (P6) seed module + python -m app.scripts.seed [--reset], prestart behind SEED_DEMO_DATA=true; (P7) v3 auth conventions: login throttling before password verification, JWT iss/aud/iat/nbf/jti + session-version claim, 60-minute access-token lifetime, fail-closed SECRET_KEY outside local, allow_credentials=False + narrowed CORS, CSP per recorded default. P3/P4/P6 are independent and may run as parallel implementer/verifier pairs; P5 and P7 are sequential and inline.
> 4. Reviews -- 3-seat panel per charters; Haiku finder + Sonnet verifier sweep (no mock route lacks CurrentUser, no 403 remains in _STATUS_TO_KIND paths); Codex D1 pre-guard (fresh block -- MUST trigger); Codex D2 pre-merge (P5/P7 touch credential/token verification -- MUST trigger). Ledger closed per process spec section 4 dispositions.
> 5. Ship -- bash scripts/lint.sh + both suites + compose boot green; progress.md completed-sprint entry, retro (2 questions, <=10 lines), cost line; self-advance this file to sprint-02.
> Done when: generate-client.sh generates from mvp-api.yaml with the generated-diff CI job green AND migration + manifest CI jobs pass AND every mock route returns 401 without a token via the single normalized code path (sweep evidence) AND the 401 message is uniform across invalid/inactive/unknown AND getCurrentUser is implemented with the contract fidelity test green AND contract test files are split with the full suite green under the rollback fixture AND seed --reset produces a working login from a fresh compose stack AND the P7 auth conventions are implemented with their tests green (throttle, claims, lifetime, fail-closed secret, CORS, CSP) AND the review ledger has no finding outside a terminal disposition AND GOAL.md is retargeted to sprint-02-jobs-manual-capture and committed.
> Advisory questions and recorded defaults: see approved-queue.md sprint-01 (coverage gate -> relax; token lifetime -> 60 min; throttle limits -> 5/min account, 10/min IP; CSP -> backend header + meta fallback).
> Stop only for: a contract question mvp-api.yaml cannot answer (HUMAN DECISION); a CI platform limitation blocking a required job; any change that would require editing mvp-api.yaml; an open review finding requiring a PO waiver (options + evidence written to the ledger); a release-blocking frozen finding.

## Completion evidence

| Predicate | Evidence (commit SHA + exact command + exit status + durable output) | Verification command |
|---|---|---|
| generate-client from contract | script diff + regenerated client committed; CI generated-diff job green for the SHA | bash scripts/generate-client.sh && git diff --exit-code frontend/src/client backend/app/schemas.py |
| migration + manifest CI gates | CI run URL for the head SHA, jobs green | gh run view <id> |
| 401 boundary complete | sweep report (route -> 401 evidence) + fidelity test id | uv run pytest tests/contract -q |
| 401 uniformity | one test asserting byte-identical envelopes for invalid/inactive/unknown | uv run pytest tests/api -q -k "credential" |
| getCurrentUser implemented | contract fidelity test green; manifest entry flipped to implemented | uv run pytest tests/contract -q -k "current_user or manifest" |
| test files split + rollback fixture | full suite green under the new fixtures | cd backend && POSTGRES_SERVER=localhost uv run pytest -q |
| seed from fresh stack | login succeeds against seeded user from clean volumes | docker compose down -v && docker compose up -d --build && <login curl> |
| P7 auth conventions | per-convention tests green (throttle 429 path, claim validation, expiry, fail-closed boot, CORS preflight, CSP header present) | uv run pytest tests/api -q -k "auth" |
| review ledger closed | ledger section in progress.md; every finding at a terminal disposition | manual read of docs/progress.md ledger |
| retarget | GOAL.md diff in the ship commit | git show HEAD -- GOAL.md |

Evidence binding: every row names the commit SHA it was produced against; stale evidence is re-run at S7, not trusted.

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

- Canonical commands: `cd backend && uv run pytest -q` (DB tests need `POSTGRES_SERVER=localhost` + compose db up); `uv run pytest tests/contract -q` (DB-free); `bash scripts/lint.sh` (mypy strict + ty + ruff); `cd frontend && bun run build && bun run test`; `docker compose watch` for the stack; `uv run prek run --all-files` pre-commit.
- Mock route pattern exemplar: `backend/app/api/routes/searches.py`. Error envelope: raise `ApiError` subclasses from `app/api/errors.py`, never HTTPException, in mock routes.
- Known traps: `resume_lifecycle` must stay included before `resumes` in `api/main.py` (path shadowing); the DB test session teardown deletes ALL users (`docker compose up -d prestart` re-seeds); the contract maps unauthorized->401 -- do NOT add 403 to `_STATUS_TO_KIND` (v3 Security); frontend treats 403+"Could not validate credentials" as logout.
- Encoding: ASCII-only prose in docs (Spec-Kitty gate). Changelog-guard requires a CHANGELOG entry on master commits; stage files explicitly (no -a).
- Review discipline: findings ledger lives in docs/progress.md; dispositions are fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION (illegal at gate-0.1).

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
