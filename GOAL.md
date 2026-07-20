---
goal_protocol: 1
queue_revision: 2
current_phase: ext-01-contract-revision
current_checkpoint: HUMAN DECISION
current_run_id: ext-01-run-1
next_phase: ext-02-token-infrastructure
terminal_phase: gate-0.2-terminal-audit
approved_queue: docs/plans/loop-research/approved-queue.md
approved_plan: docs/plans/browser-extension-plan-v1.md
process_spec: docs/plans/loop-research/sprint-treadmill-process.md
progress_log: docs/progress.md
consecutive_clean_reviews: 0
status: ready
---

# GOAL.md -- current executable work contract

Operator runbook: Release 0.1 is COMPLETE (gate-0.1 PASS at 9116800; record in docs/audits/release-0.1-terminal-audit.md and docs/progress.md -- this file's 0.1 evidence tables moved there). This contract instantiates Release 0.2 (browser extension) from queue rev 2. Governing plan: docs/plans/browser-extension-plan-v1.md, whose PO rulings DEC-EXT-001..004 (Wes, 2026-07-20) are BINDING on every ext-* phase: 93 ops with no token-check endpoint; Job nullable relaxation over a staging table; the FORCE-RLS verifier-lookup policy pattern (exact connection role ratified from repo inspection at ext-02 S0, never assumed); the Settings numbers bundle (token TTL 90d, cap 5, quota 50/UTC-day count-based, snapshot 2 MiB, body 2.25 MiB, retention 90d, REJECT on oversize). ext-01 is HUMAN DECISION at S0 (Wes's go on the run itself -- the recorded pattern: his /goal invocation against this block is the go), then ADVISORY. Codex D1 MUST fire at ext-01 S0 (fresh block, first contract revision under governance).

## Goal -- ext-01: rulings + contract revision 89 -> 93

> Do not stop until the frozen-contract revision is shipped end to end: the four new operations exist in mvp-api.yaml under full governance, both generated artifact sets are regenerated with proof, and the wire layer carries the DEC-EXT-002 nullability.
> 1. Governance first -- record DEC-EXT-001..004 in DECISIONS-NEEDED.md (referencing the plan doc) and write the CONTRACT-NOTES.md deltas; bump the contract version; add captureJob, createExtensionToken, listExtensionTokens, revokeExtensionToken to mvp-api.yaml exactly as specified in the plan's contract-delta section (dual-auth captureJob with 201-created/200-deduped and created boolean; one-time token display on mint; metadata-only list; 204 revoke with tenant-indistinguishable 404).
> 2. Regenerate -- backend/app/schemas.py (datamodel-codegen, documented post-gen fixup) and frontend/src/client (generate-client.sh) in the SAME change; prove a second regeneration produces an empty diff; hand-patch NO generated file.
> 3. Wire layer -- operation-ownership.yaml gains the four entries (status: planned; they flip to implemented in ext-02/ext-03); wire mappers + fixtures compile with nullable company/location/workMode/employment/posted + captureNote on the Job wire shape (the DB migration itself is ext-03's, NOT this phase's).
> 4. Error surface -- the new ops declare the envelope error cases from the plan: 401 unauthorized (incl. both-credentials), 402 cap_reached (mint at cap), 422 validation_error, 429 rate_limited; no 403 mapping anywhere.
> Done when: DEC-EXT-001..004 are recorded in DECISIONS-NEEDED.md with CONTRACT-NOTES.md deltas committed referencing all four AND mvp-api.yaml serves exactly 93 operations with the contract-drift guard and operation manifest green (four new ownership entries) AND backend schemas + frontend client are regenerated in the same change with an empty-second-regeneration proof and no generated file hand-patched AND the wire mappers and fixtures compile with the five nullable Job fields + captureNote AND the new ops declare the plan's error envelope cases AND the review ledger has no finding outside a terminal disposition AND GOAL.md is retargeted to ext-02-token-infrastructure and committed.
> Advisory questions and recorded defaults: none new -- DEC-EXT-001..004 are the recorded rulings; any question they do not answer is a permitted stop.
> Stop only for: a contract question DEC-EXT-001..004 does not answer (HUMAN DECISION -- the contract is Wes's); any finding requiring a PO waiver; Codex D1 findings that survive the reply round as release-blocking.

## Completion evidence (filled at S7 ship)

| Predicate | Evidence (commit SHA + exact command + exit status + durable output) | Verification command |
|---|---|---|
| rulings + deltas | (recorded at ship) | git show <sha> -- DECISIONS-NEEDED.md CONTRACT-NOTES.md |
| 93 ops + drift/manifest green | (recorded at ship) | uv run pytest tests/contract/test_contract_drift.py tests/test_operation_manifest.py -q |
| empty-regen-diff proof | (recorded at ship) | bash scripts/generate-client.sh && git diff --exit-code |
| wire nullability compiles | (recorded at ship) | cd frontend && bun run build; cd backend && uv run bash scripts/lint.sh |
| ledger terminal | (recorded at ship) | manual read of docs/progress.md |
| retarget | (recorded at ship) | git show HEAD -- GOAL.md |

### Self-advance (last Ship step, every run)

1. Record this phase under Completed in docs/progress.md.
2. Select ONLY the next phase from the approved queue copy below; diff the copy against docs/plans/loop-research/approved-queue.md first.
3. Verify its entry criteria. Failed -> status: BLOCKED, write evidence, stop.
4. Rewrite the active Goal block for that phase, verbatim from the queue row + the plan doc's phase packet.
5. Update consecutive_clean_reviews.
6. Commit the transition with the shipped work.
7. If no approved phases remain, set Current: COMPLETE, remove the active work goal, summarize optional debt, and stop.

Self-advance MAY NOT: create/split/merge/reorder phases, promote a checkpoint toward autonomy, alter acceptance criteria, waive findings, choose product direction, edit the authoritative queue file, or move past unmet entry criteria.

## Proven patterns

- Canonical commands: `cd backend && POSTGRES_SERVER=localhost uv run pytest -q` (DB tests need the compose db up); `uv run pytest tests/contract -q` (DB-free); `uv run bash scripts/lint.sh` (mypy strict + ty + ruff -- ALWAYS under `uv run`); `cd frontend && bun run build && bun run test`; `bunx playwright test` (backend up, compose frontend STOPPED locally -- DEBT-9); `bash scripts/test.sh` for the full from-scratch cycle (host suite; the image ships no tests/); `uv run prek run --all-files` pre-commit.
- Mock route pattern exemplar: `backend/app/api/routes/searches.py`. Error envelope: raise `ApiError` subclasses from `app/api/errors.py`, never HTTPException, in contract routes; no 403 in `_STATUS_TO_KIND`.
- DB-tenant-vertical exemplar (sprint-02, PR-1..4): the `job` table + `jobs.py` + `get_tenant_session` (SET LOCAL ROLE app_runtime + app.user_id GUC; app-level `.where` belt, RLS backstop); CASCADE tenant-child FKs; `sa_type=JSONB(none_as_null=True)` + named IS-TRUE CHECKs; migration recipe copies 4c17ea8b5656 with DEBT-6 hand-strip.
- Composite-FK child exemplar (sprint-03, PR-5..8): `shortlist_entry` / migration 4317eb75f1cd; constraint-name disambiguation over catch-all IntegrityError; two-connection tests invalidate() their connections (PR-7); no-match fallbacks re-derived per resource.
- ORM/seed/test discipline (sprint-04, PR-9..12): explicit flush() ordering between dependent inserts; two-identity tests build the second identity via direct DB inserts (PR-10); composite-FK'd seed fixtures upsert in place (PR-11); scratchpad is disposable -- land review state in commits early (PR-12).
- SECURITY DEFINER search_path (sprint-05, PR-13): pin `SET search_path = public, pg_temp` (pg_temp LAST) + exact-proconfig test on any function reading an app_runtime-shadowable table. DEBT-11: the sprint-04 functions still carry bare `= public` -- first post-0.1 fix candidate.
- Reserve-then-settle exemplar (sprint-05, PR-14): app/ai_flow.py for any future reserve-external-work-then-record flow.
- Review-tier limits (sprint-05, PR-15): Codex sandbox cannot reach the compose postgres -- keep a live-SQL correctness seat as a MUST on SECURITY DEFINER / privilege-boundary work; a green static Codex audit does not cover runtime behavior. ext-02 and ext-03 both trip this rule.
- Auth: every contract router carries `dependencies=[Depends(get_current_user)]`; ONE raise site in deps.py; login throttled -- e2e logs in ONCE per run (global-setup).
- Test world: explicit fixtures in `backend/tests/conftest.py` (`db` rollback, `client`, `db_client`, `intruder_client`, `seed_domain`); NO autouse; seed/bootstrap tests write real rows with explicit cleanup; the suite's seed tests DELETE the demo user -- re-seed the dev DB after suite runs.
- Known traps: `resume_lifecycle` before `resumes` in api/main.py; changelog-guard requires a CHANGELOG entry on master commits; commit guard forbids .env changes; stage files explicitly (no -a); stage and commit in SEPARATE Bash calls (guard hooks inspect staging); CI runs NO lint job (DEBT-12 candidate) -- run lint.sh locally before trusting clean.
- Append-only machinery: migration 075675058c67 (`enforce_append_only(regclass)` + `app_runtime` role); behavioral tests under SET LOCAL ROLE app_runtime.
- Review discipline: findings ledger in docs/progress.md; dispositions fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION (frozen illegal at terminal gates). Fanned agents WRITE reports to files.
- Encoding: ASCII-only prose in docs (Spec-Kitty gate). No hard-wrapped prose.

## Approved queue (copy of approved-queue.md rev 2, Release 0.2 rows)

| ID | Phase | Exit gate | Checkpoint | Hard-blocker check | Risk | Codex (per trigger function) |
|---|---|---|---|---|---|---|
| ext-01 | Release 0.2: rulings + contract 89->93 | drift+manifest green; empty-regen-diff proof | HUMAN DECISION at S0, then ADVISORY | blocker: first contract revision under governance | med | D1 (fresh block) |
| ext-02 | Token infrastructure + settings UI | exact RLS artifacts + both-direction probes + lifecycle suite green | ADVISORY | blocker: first pre-principal credential exemplar | high | D1+D2 |
| ext-03 | Capture backend + Job relaxation | populated-migration proofs + dedup race + quota boundary + 5 ripple suites green | ADVISORY | blocker: only populated-table migration of the increment | high | D1+D2 |
| ext-04 | MV3 extension client + extension CI | client CI green + minimizer fixtures + manual compose capture evidence | ADVISORY | blocker: first MV3 exemplar | med | D1 |
| ext-05 | Integration hardening + chained e2e | 3 consecutive fresh-seed journey runs + token-leak + XSS sweeps + ledger terminal | ADVISORY | -- | med | none unless tripwire |
| gate-0.2 | Terminal release audit | EXT AC matrix + fresh-clone drill + release audit | HUMAN DECISION, TERMINAL | -- | -- | release audit |
| gate-0.2-repair | Pre-approved repair, only after a FAIL, scoped to named failures | named failures closed | ADVISORY | -- | varies | per trigger |
