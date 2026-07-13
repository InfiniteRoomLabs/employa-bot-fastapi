# progress.md -- resumable operational state

PLAN (v3) says what we are building; this file says where we are. Update at every block boundary and at any permitted-blocker stop. Governing process: `docs/plans/loop-research/sprint-treadmill-process.md`.

## Current state

- Phase / run: sprint-01-gates-and-foundation / sprint-01-run-1 (status: running, guard on 2026-07-13)
- Active branch: master (sprint branch `sprint-01-foundation` not yet created)
- Last verified checkpoint: run manifest committed (this commit)
- Exact next action: Codex D1 dispatch + S2 investigation, then S3 spec, then branch sprint-01-foundation.
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

- none yet

## Review ledger

(Every finding: stable ID, reviewer, severity, one-sentence finding, disposition, closure evidence as command + output. Dispositions: fixed / disproved-with-evidence / waived-by-Wes / frozen-HUMAN-DECISION (illegal at gate-0.1). Zero-finding dispatches are recorded too.)

| ID | Reviewer | Sev | Finding | Disposition | Closure evidence |
|---|---|---|---|---|---|
| (process design review 2026-07-13: 14 Codex findings on the process spec itself, all fixed -- see the appendix in sprint-treadmill-process.md) | | | | | |
| D1-1 | Codex D1 (thread 019f5d1a-ee9e-79d3-8f2b-e8ee4f1db58d) | HIGH | Manifest never requires the shipped commit to be reachable from master | open -> PIN-1 (spec) | pending: evidence bound to master merge SHA at S7 |
| D1-2 | Codex D1 | HIGH | Green CI job conclusions do not prove the gates enforce anything | open -> PIN-2 | pending: negative evidence per gate |
| D1-3 | Codex D1 | HIGH | 401 sweep evidence proves neither route completeness nor one code path | open -> PIN-3 | pending: programmatic route-universe sweep test |
| D1-4 | Codex D1 | HIGH | getCurrentUser evidence cannot discriminate DB-backed from a test double | open -> PIN-4 | pending: fidelity test with no dependency overrides |
| D1-5 | Codex D1 | HIGH | Expired-token envelope uniformity omitted from the frozen conjunct | open -> PIN-5 | pending: expired joins the byte-identical set |
| D1-6 | Codex D1 | MED | Seed evidence can pass with seed --reset broken or unused | open -> PIN-6 | pending: evidence invokes seed --reset explicitly, demo-user login |
| D1-7 | Codex D1 | MED | P7 predicate subjective (CSP directives, global cap, CORS narrowing unpinned) | open -> PIN-7 | pending: values pinned in sprint-01-spec.md |
| D1-8 | Codex D1 | MED | compose down -v / seed --reset under-classified as ordinary verification | open -> PIN-8 | pending: local-project guard + seed env refusal |
| D1-9 | Codex D1 | MED | Green full suite does not prove the rollback fixture is actually in effect | open -> PIN-9 | pending: fixture self-test |

## Open-debt ledger

| ID | Description + evidence | Severity | Affected AC | Owner | Release-blocking | Target phase |
|---|---|---|---|---|---|---|

- none yet

## Parked tangents

(Agenda for the next S0, or route to the ideas repo.)

- Build the goal-treadmill plugin in agent-ops (validators, snapshot/audit tooling, Stop-hook packaging) -- Release 0.1 is its pilot evidence. Design: docs/plans/loop-research/goal-treadmill-workflow-design.md.
- CLAUDE.md/AGENTS.md sync as a real cross-platform agent-ops feature (Codex support) -- parked 2026-07-12.

## Clean-session handoff

An unfamiliar agent resuming this repo should read, in order: `GOAL.md` (current contract), this file (current state), `docs/plans/loop-research/approved-queue.md` (the queue, Wes-only), `docs/plans/full-stack-implementation-plan-v3.md` (binding spec), `docs/plans/loop-research/sprint-treadmill-process.md` (the operating process), and `CLAUDE.md` (commands + traps). Then run the resume preflight before invoking /goal.
