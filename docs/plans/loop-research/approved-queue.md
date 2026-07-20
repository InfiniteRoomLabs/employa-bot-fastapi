# Approved queue -- Employa-Bot Release 0.1 (AUTHORITATIVE)

Edited ONLY by Wes (PO). Every edit bumps `queue_revision`. Agents may read this file and copy rows verbatim into GOAL.md; they may never edit it. Governing process: `docs/plans/loop-research/sprint-treadmill-process.md`. Binding spec: `docs/plans/full-stack-implementation-plan-v3.md`.

queue_revision: 2
approved_by: Wes, 2026-07-13 (rev 1); Wes, 2026-07-20 (rev 2 -- in-session approval of the Release 0.2 extension rows as presented in docs/plans/browser-extension-plan-v1.md section 9)
terminal_phase: gate-0.2-terminal-audit

## PO decisions recorded at rev 1

1. v3 Phase 0 and Phase A are merged into sprint-01 (one foundation sprint; the gates and the auth boundary are coupled work).
2. B3 (applications + minimal resume + snapshot) is ONE sprint with branch-internal 3a/3b/3c checkpoints and one final merge -- v3's abandonment-safety rule; per Codex review finding F2.
3. No AUTONOMOUS rows exist at rev 1. Autonomy is earned via the sprint-03 promotion path, never granted by fiat.
4. The v3 binding auth conventions are owned by sprint-01 packet P7 (Codex F6); no binding convention is left ownerless.
5. gate-0.1-repair is pre-approved but may run ONLY after a FAIL terminal audit, scoped to the audit's named failures.
6. (rev 2) Release 0.2 = the browser-extension increment per docs/plans/browser-extension-plan-v1.md; the four PO rulings DEC-EXT-001..004 are recorded there (2026-07-20) and are binding on every ext-* row. gate-0.2-repair mirrors the gate-0.1-repair rule.

## The queue

| ID | Phase (v3) | Exit gate | Checkpoint | Hard-blocker check | Risk | Codex (per trigger function) |
|---|---|---|---|---|---|---|
| sprint-01 | Phase 0 + A (merged, PO decision rev 1) + v3 auth conventions | 401 boundary + auth hardening + all CI gates green | ADVISORY (attended dry run) | blocker present: process itself unproven, template first-of-kind | med | D1+D2 (fresh block; touches token verification) |
| sprint-02 | B1 jobs, manual capture | created job persists + lists in browser; core-journey covers login->job | ADVISORY | blocker present: no shipped DB-vertical exemplar -- this sprint CREATES it (first migration under the binding conventions, RLS, composite FKs) | med | D1+D2 (hard blocker; exemplar first-instance) |
| sprint-03 | B2 shortlist | unique(user_id, job_id) live; journey extended to shortlist | ADVISORY -- promotion path: Wes may flip to AUTONOMOUS by queue edit only after sprint-02 ships AND an exemplar-coverage mapping plus one recorded rubric score exist (Codex F13) | pending exemplar: one first-of-kind slice is asserted, not proven, to be representative | low | none (pattern-repeat; empty-table migration) |
| sprint-04 | B3 WHOLE: applications + minimal resume + snapshot together (internal checkpoints 3a/3b/3c commit to the sprint branch; ONE final merge to master) | 3c journey gate incl. invalid_transition envelope; two-connection test (one winner, no orphan child rows); journey extended through application->applied->locked resume+snapshot | ADVISORY | blocker present: known high-severity uncertainty (concurrency, append-only mechanics, undo/undo_grant semantics) | high | D1+D2 |
| sprint-05 | B4 fake AI seam | fake score persists + renders; reservation-cap two-connection test; journey extended to match score | ADVISORY | high: reservation arithmetic; append-only ai_run | high | D1+D2 |
| gate-0.1 | Terminal audit | core-journey.spec.ts required in CI; fresh-clone drill | HUMAN DECISION, TERMINAL | -- | -- | release audit |
| gate-0.1-repair | Pre-approved repair: may run ONLY after a FAIL audit, scoped to the audit's named failures, no new scope; returns to the terminal audit | audit's named failures closed with evidence | ADVISORY | -- | varies | per trigger function (derived from what the repair diff touches) |
| ext-01 | Release 0.2: rulings + contract 89->93 | drift+manifest green; empty-regen-diff proof | HUMAN DECISION at S0, then ADVISORY | blocker: first contract revision under governance | med | D1 (fresh block) |
| ext-02 | Token infrastructure + settings UI | exact RLS artifacts + both-direction probes + lifecycle suite green | ADVISORY | blocker: first pre-principal credential exemplar | high | D1+D2 |
| ext-03 | Capture backend + Job relaxation | populated-migration proofs + dedup race + quota boundary + 5 ripple suites green | ADVISORY | blocker: only populated-table migration of the increment | high | D1+D2 |
| ext-04 | MV3 extension client + extension CI | client CI green + minimizer fixtures + manual compose capture evidence | ADVISORY | blocker: first MV3 exemplar | med | D1 |
| ext-05 | Integration hardening + chained e2e | 3 consecutive fresh-seed journey runs + token-leak + XSS sweeps + ledger terminal | ADVISORY | -- | med | none unless tripwire |
| gate-0.2 | Terminal release audit | EXT AC matrix + fresh-clone drill + release audit | HUMAN DECISION, TERMINAL | -- | -- | release audit |
| gate-0.2-repair | Pre-approved repair, only after a FAIL, scoped to named failures | named failures closed | ADVISORY | -- | varies | per trigger |

## Advisory questions + recorded defaults

A question with no recorded default is a HUMAN DECISION. ADVISORY phases apply these defaults and proceed; overriding a default mid-sprint requires a permitted stop.

**sprint-01**
- Coverage-gate relaxation to advisory? -> default: relax, per v3 Delivery #6.
- New access-token lifetime (v3 says "dropped from 8 days", unspecified)? -> default: 60 minutes; revisit at Gate 0.1 if refresh friction shows up in the journey test.
- Login throttle limits? -> default: 5/min per account, 10/min per IP, before password verification, one uniform error message; global cap sized generously (v3 names the shape, not the numbers).
- Where is the CSP served from? -> default: backend middleware header on API responses + frontend served with a meta-tag CSP in index.html; note the vite-dev-mode limitation in progress.md rather than blocking on it.

**sprint-02**
- Does the jobs schema satisfy every binding convention before the first migration commits? -> default: proceed when the correctness seat and D2 both confirm; otherwise stop for waiver.
- JSONB CHECK constraint depth for JobLocation/Employment/Salary? -> default: named CHECKs for json type + required keys + scalar types (v3 Data-integrity #15); ranges only where v3 names them.

**sprint-04**
- Two-connection test shape adequate for the transition guard? -> default: proceed when exactly-one-winner and no-orphan-child-rows both assert on DB state under the runtime role.
- Undo semantics? -> default: compensating transition (source=user_correction, corrects_transition_id), never history delete -- v3 Data-integrity #8; the mock's verbatim behavior is explicitly NOT ported.

**sprint-05**
- Reservation conversion timing? -> default: reserve conservative max in a short txn, call provider outside the txn, convert reservation->actual after (v3 Data-integrity #5/#6); idempotency key + unique constraint for retry safety.

## Change log

- rev 1 (2026-07-13): initial queue, approved by Wes in session. Derived from plan v3 Release 0.1 with the two structural PO decisions above (0+A merge, B3 atomic).
- rev 2 (2026-07-20): Release 0.2 extension rows (ext-01..gate-0.2-repair) appended per docs/plans/browser-extension-plan-v1.md. Approved by Wes in session ("LGTM" on the plan + explicit direction to commit); the edit was executed by the session agent at his direction with the row content he reviewed verbatim -- recorded here because the standing rule is Wes-only edits.
