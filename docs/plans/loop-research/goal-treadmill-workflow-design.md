# Guided Goal Treadmill -- reusable workflow design (gpt-5.6-sol via Codex, 2026-07-10)

> Design for turning the hoyle-re `/goal` loop into a reusable agent-ops workflow. Produced with full machine context (Codex loaded `~/.codex/AGENTS.md` + repo AGENTS.md + CLAUDE.md -- wiring validated). Cites the investigation report + exemplars.

## Recommendation

Ship one cross-platform `goal-treadmill` plugin/package with three layers:

1. `stand-up-goal-loop` guided skill -- investigates the project, evaluates autonomy readiness, writes the design, hands off to planning.
2. `goal-loop-init` deterministic bootstrap command -- installs repository templates and validates their structure.
3. Platform runtime adapters -- Claude Code: `/goal` + a session-scoped Stop hook. Codex: its native persistent thread-goal system, with a thin `/goal`-equivalent launcher.

Repository artifacts are platform-neutral; runtime enforcement is platform-specific. This preserves the real Hoyle architecture: the guard enforces one invocation, `GOAL.md` advances the approved queue between invocations. No recursive daemon, no agent-selected backlog expansion.

Governing principle:

> **Investigation earns automation.** The workflow may automate execution only after requirements, evidence, boundaries, transitions, and completion checks have become sufficiently formulaic.

## 1. Repository additions

### GOAL.md -- current executable work contract

The only doc read as the active guarded objective. NOT the long-term plan, NOT a backlog. YAML frontmatter for deterministic validation + human-readable body.

```yaml
---
goal_protocol: 1
queue_revision: 3
current_phase: phase-04-thin-vertical-slice
current_checkpoint: AUTONOMOUS
current_run_id: phase-04-attempt-1
next_phase: phase-05-correctness-resilience
terminal_phase: phase-09-terminal-audit
approved_plan: PLAN.md
progress_log: docs/progress.md
status: ready
---
```

Body sections: **Ledger** (completed / current / remaining approved / terminal condition); **Current phase goal** (5-stage objective: investigation, spec, implementation, verification+reviews, integration+reporting; conjunctive "Done when: A and B and C..."; explicit **Permitted stops** list); **Completion evidence** table (predicate -> required evidence -> verification command); **Self-advance transaction** (11 ordered steps); **Approved queue** table; **Proven patterns** (exemplars, commands, traps).

**The `current_run_id` solves the retargeting paradox.** A guard started for `phase-04-attempt-1` judges completion of THAT snapshot. Rewriting the file for phase 05 is the final phase-04 deliverable but does not add phase 05 to the current invocation (matches observed hoyle-re behavior, investigation:54-60).

### PLAN.md -- approved work program

Stable authority from which GOAL.md may select work. Must contain: outcome/users/intent; success metrics + terminal condition; evidence inventory (UNKNOWN/INFERRED/CONFIRMED); unresolved-question register; scope/non-goals/prohibited-expansions; architecture + module boundaries; acceptance criteria with stable IDs; risks/dependencies/irreversible-ops; phase queue with immutable IDs; per-phase entry+exit criteria, deliverables, checkpoint type, advisory default, human-decision owner, verification commands, branch policy, next phase; global quality/release gates; terminal audit + definition of done.

Queue edits require operator approval. A running autonomous phase may correct discovered facts but may NOT add a phase, change a HUMAN DECISION checkpoint, change the terminal condition, or redirect product intent.

### docs/progress.md -- resumable operational state

Answers "where are we now" (PLAN.md answers "what are we building" -- separation is explicit in the exemplar). Sections: timestamp + phase/run ID; active branch + integration target; last verified checkpoint + commands; deliverables; evidence discovered/corrected; **review ledger** (finding ID / reviewer / severity / disposition / closure evidence); **open-debt ledger** (severity / owner / affected AC / release-blocking); blockers + unresolved questions; exact next action; clean-session handoff. Update at every phase boundary and at any permitted-blocker stop.

### CHANGELOG.md -- durable delivery record

Outcomes not activity: behavior delivered, AC covered, architecture/schema changes, migration/rollback posture, verification commands + results, independent review outcomes + finding closure, known limitations/debt, deviations from plan + why, release identifiers.

### Exemplar specs + implementations

A phase cannot be autonomous merely because a template exists -- it needs >=1 approved pattern covering the work it repeats. Store as normal project artifacts (docs/specs/000-exemplar-feature.md, tests/architecture/, tests/product-flows/). Exemplar spec includes intent+non-goals, AC mapping, IO/states/failure, architecture placement, security/privacy/a11y/data implications, test matrix, known-unknowns with evidence labels, release+observability requirements. A synthetic scaffold is NOT evidence of repeatability.

### CLAUDE.md / AGENTS.md

Runtime operating context, not goal state. Expose: canonical commands, architecture invariants, generated-file rules, branch/integration conventions, safety constraints + traps, resume instruction (read PLAN.md + GOAL.md + progress.md), how to invoke the platform goal guard. Follow the IRL sync convention: shared facts identical, one authoritative file + short platform sibling, platform-only invocation in labeled sections, bootstrap validation fails if one file references the treadmill and the other does not, never copy ephemeral goal status into either.

### Completion-guard wrapper

Runtime infrastructure, NOT a file copied from Hoyle (investigation found no repo implementation, :21-31). The plugin ships: Claude Code command def, Stop-hook handler, shared goal parser/validator, shared completion-audit prompt/schema, Codex launcher/guidance, repo templates. A bootstrapped project DEPENDS on the installed plugin and commits only platform-neutral artifacts + small config wiring -- it does not vendor the Stop-hook.

Completion audit returns structured output:
```json
{"run_id":"phase-04-attempt-1","result":"incomplete","satisfied":["AC-01","ARCH-01"],
 "unmet":["FLOW-03","DOCS-01","ADVANCE-01"],"evidence":["..."],
 "next_action":"Run the checkout recovery flow and record evidence.","permitted_blocker":null}
```
Stop allowed only when all predicates satisfied + self-advance complete, OR a permitted blocker matches the phase's declared stop conditions. The evaluator snapshots `current_run_id` + predicates when the goal begins; it must NOT judge against the newly retargeted phase.

## 2. Guided workflow skill: `stand-up-goal-loop`

Brainstorming shape: inspect context, ask one question at a time, present design, get approval, write design, hand off to plan writing. Does not bootstrap files until the operator approves.

Checklist (18 steps): 1 inspect repo context; 2 define intended terminal outcome (reject "keep improving"/"build the MVP" until observable); 3 map decision authority (approved vs stakeholder vs agent-may-change vs may-investigate-not-decide vs irreversible/external/costly/public); 4 inventory evidence+uncertainty (require >=1 system-mapping discovery pass before grading readiness); 5 identify repeatable work units (compare >=2 phases against a shipped exemplar; separate stable mechanics from creative decisions); 6 define quality+acceptance evidence (every exit condition names an observable artifact/command); 7 draft phase boundaries (default spec/MVP queue below); 8 run autonomy-readiness assessment per phase; 9 assign checkpoint types; 10 present 2-3 operating designs (attended-only / hybrid-recommended / high-autonomy); 11 present recommended design in sections, get approval; 12 write design to docs/plans/YYYY-MM-DD-goal-loop-design.md; 13 independent design challenge (subjective outcomes? silent product-direction choice? gameable exit criteria? under-classified irreversible actions? real exemplar per phase? can terminal manufacture work?); 14 operator reviews+approves; 15 hand off to writing-plans -> PLAN.md with stable IDs; 16 bootstrap + validate --strict; 17 attended dry run of one phase (verify an unfamiliar agent can resume, every predicate has real evidence); 18 operator activation gate (explicit approval of the first autonomous phase, THEN `/goal`).

Default spec/MVP queue: (1) Discovery/evidence (2) Product/spec freeze (3) Architecture decision (4) Thin vertical slice (5) Correctness/resilience (6) Product QA/usability (7) Docs/operability (8) Release candidate (9) Terminal audit.

Terminal state of the SETUP skill is a validated, approved first invocation -- not autonomous execution without a final operator gate.

## 3. Autonomy-readiness gate (per phase, not per project)

**Hard blockers (any one prohibits AUTONOMOUS):** ambiguous outcome/AC; >1 costly architecture viable with no approved default; phase can add scope/choose features/reprioritize; success is subjective visual/editorial/interaction judgment without approved exemplar+review; outstanding stakeholder approval; unknown external dependency with no fixture/sandbox; public/destructive/financial/legal/privacy/irreversible op without a pre-approved reversible procedure; "good enough"/"polished"/"production-ready" without observable proxies; no representative shipped exemplar for pattern work; no reliable verification path; a known high-severity uncertainty can alter the design; cannot stop safely + resume from committed state.

**Scored rubric (0/1/2 across 12 dimensions):** outcome clarity, evidence maturity, pattern maturity, architecture, verification, product authority, dependency control, reversibility, reviewability, resumability, scope boundedness, operational safety.

Classification: **AUTONOMOUS** >=21/24, no hard blocker, every critical dimension at 2. **ADVISORY** 16-20, no unbounded product decision, recorded default per advisory question. **HUMAN DECISION** any direction/authority hard blocker, or <16. **TERMINAL** verify the approved terminal predicate only. Critical dimensions = outcome clarity, product authority, verification, scope boundedness, operational safety.

(Hoyle's complex trick-taking games are attended-mode by this gate -- the exemplar says so directly, GOAL.md:107-109. That's the gate working, not failing to automate.)

## 4. Anti-slop for spec/MVP projects

Coverage is evidence about exercised code, not that the correct product was built. Every implementation phase requires (where applicable):

- **Acceptance traceability matrix:** AC ID -> spec -> impl unit -> automated test -> product-flow evidence -> release status. No required AC unimplemented/untested/silently-deferred; deferral needs a pre-approved scope change or human decision.
- **Architectural boundary checks (automated):** UI accesses data only through approved seams; domain logic doesn't import infra/rendering; generated code never hand-edited; persistence only through approved repos; authz at the intended boundary; cross-module cycles fail CI.
- **Product-flow QA (journeys not pages):** primary flow, validation failure, empty, loading, permission denial, external-dependency failure, partial+resume, recovery/retry, destructive-cancel, a11y keyboard/SR path. Reproducible evidence each; screenshot-only is insufficient for correctness.
- **Clean-environment docs verification:** a reviewer follows setup/migration/test/recovery from a clean clone; local hidden state must not be needed.
- **Open-debt ledger:** stable ID, description+evidence, severity, affected AC, owner, release-blocking decision, target phase, approval/waiver ref. Agent may discover debt; may not quietly move release-blocking debt past a human checkpoint.
- **Independent reviews (separate concerns):** Product/QA; Correctness/security/code-quality; Architecture/simplification; "Should this exist?". Every finding fixed, disproved with evidence, or explicitly waived by the named authority.
- **Pre-approved advancement ONLY:** self-advance may mark current phase complete, instantiate the exact next approved phase, carry forward evidence+debt, set COMPLETE. It may NOT create/split/merge/reorder phases, promote advisory->autonomous, alter AC, waive findings, choose product direction, or move past unmet entry criteria. Failed entry criteria -> `status: BLOCKED`, write evidence, stop.

## 5. Agent-ops placement + cross-platform

Marketplace layout (agent-ops root, single-plugin style): `skills/stand-up-goal-loop/` (SKILL.md + references/ + assets/ templates + scripts/goal_loop.py), `commands/{goal-loop-init.md, goal.md}`, `hooks/{goal-stop-guard.py, hooks.json}`, `tests/` (+ fixtures per checkpoint type), registry.yaml + plugin.json + CHANGELOG. One Python entry point with subcommands: `goal_loop.py {init, validate --strict, status, snapshot, audit --run-id}`.

**Claude Code:** `/goal @GOAL.md` -> `goal_loop.py snapshot` (records run ID, objective, completion predicates, permitted blockers, queue revision, phase hash) -> inject objective + begin -> Stop hook runs completion audit -> incomplete: reject Stop + inject evidence/unmet/next-action; complete: clear + permit. `/goal clear` = explicit operator cancel. Project carries artifacts + local config, not the global hook.

**Codex (concrete finding):** Codex HAS a native persistent goal system. `~/.codex/goals_1.sqlite` has a `thread_goals` table (thread_id, goal_id, objective; statuses active/paused/blocked/usage_limited/budget_limited/complete; token+time accounting). Binary metadata references `state/src/runtime/goals.rs`, `ext/goal`, continuation steering, turn-stop progress accounting, resume restoration, `/goal`. So Codex should USE its native goal facility, not manipulate the SQLite directly or emulate it in repo code. Recommended invocation: `/goal Complete the snapshotted current run in @GOAL.md. Do not advance beyond its pre-approved next-phase transition.`

Parity caveat: native persistence/status/budget/resume/continuation = available; EXACT Stop-rejection semantics identical to Claude Code = NOT yet proven from CLI help. Classify the Codex adapter as "persistent guarded objective with protocol enforcement", add a fixture test that attempts an early final response against an unmet GOAL.md, and promote the claim only after observing it resume/block. Do NOT access/edit `goals_*.sqlite` directly -- runtime-owned.

Cross-platform sync: bootstrapper detects CLAUDE.md + AGENTS.md, creates the missing sibling if convention requires, adds the same shared treadmill paragraph to both (artifact paths, validation commands, queue-immutability rule, resume order) + platform-specific activation subsections, validates semantic markers not byte-identical files. Workflow logic lives in skill references + repo artifacts, not duplicated at length in both context files.

## 6. Literal bootstrap kit

Files copied into a new repo: GOAL.md, PLAN.md, CHANGELOG.md (create if absent), docs/progress.md, docs/plans/YYYY-MM-DD-goal-loop-design.md, docs/specs/000-exemplar-spec.md (replace with a real exemplar), docs/quality/{acceptance-traceability.md, open-debt.md}, CLAUDE.md, AGENTS.md. Optional: docs/architecture/boundaries.md, docs/quality/{product-flow-matrix.md, release-checklist.md}, tests/architecture/, tests/product-flows/.

Do NOT copy: `.claude/commands/goal.md`, the Stop-hook implementation, Codex SQLite state, daemon/loop scripts -- those come from the installed plugin or the native platform.

One entry point: `/goal-loop-init` -> invokes `stand-up-goal-loop` (interview, readiness assessment, approved design, plan handoff, scaffold, validate, attended dry run). Programmatic: `uv run python scripts/goal_loop.py init --repo . && ... validate --strict`.

First activation (after guided workflow + plan review + dry run + explicit approval):
- Claude Code: `/goal Complete the snapshotted current run in @GOAL.md`
- Codex: `/goal Complete the snapshotted current run in @GOAL.md. Follow its permitted-stop and pre-approved self-advance rules exactly.`
Each successful run PREPARES but does not execute the next approved phase.

## Build order

1. Artifact schemas + validator. 2. Readiness rubric + fixture projects. 3. Guided `stand-up-goal-loop` skill. 4. `goal-loop-init` command + templates. 5. Claude Code snapshot + Stop guard. 6. Claude Code early-stop/completion/retarget tests. 7. Codex native-goal behavior tests. 8. Context-file synchronization checks. 9. Pilot on one formulaic project + one spec/MVP project. 10. Independent review, version bump, marketplace release.

First release deliberately OMITS: unattended multi-phase recursion, automatic phase creation, automatic waivers, direct Codex database access, deployment/publishing authority. The safe reusable unit is one guarded, pre-approved phase per invocation.
