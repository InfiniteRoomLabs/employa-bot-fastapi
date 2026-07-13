# hoyle-re /goal treadmill -- investigation (gpt-5.6-sol via Codex, 2026-07-10)

> Ground-truth investigation of the working autonomous loop, for standardizing it. Cites file:line across the hoyle-re repo + Claude Code session transcripts.

## Executive conclusion

The successful workflow had two distinct looping layers:

1. `/goal` supplied the runtime enforcement. It installed a session-scoped Stop hook whose condition was the literal command argument, such as `complete everything in @GOAL.md`. When the agent attempted to stop early, the hook evaluated the transcript, rejected stopping, and injected an evidence-based explanation of what remained.

2. `GOAL.md` supplied the work program and logical queue. It defined the current vertical slice, its quality gates, its shipping procedure, and a mandatory final action: rewrite `GOAL.md` for the next game. This did not automatically execute another slash command. Instead, it left a new, nonempty goal ready for the next `/goal complete everything in @GOAL.md` session.

That distinction matters. The Stop hook enforced completion within one invocation; the "queue-exhaustion" behavior was a document protocol that advanced the durable queue between invocations. There is no repository loop script, daemon, checkbox parser, or SessionStart hook doing this.

The strongest reusable idea:

> A runtime completion guard evaluates a durable, version-controlled goal document; completing the current item must transactionally advance that document to the next item.

The goal document was unusually effective because it was not merely a task list. It encoded the investigation targets, implementation topology, evidence standard, tests, independent reviews, branch and merge protocol, reporting requirements, stopping policy, and next-item selection.

## 1. The /goal mechanism

`/goal` appears as a slash command handled by the CLI. Invocation `/goal complete everything in @GOAL.md` emitted `Goal set: complete everything in @GOAL.md` and injected: "A session-scoped Stop hook is now active with condition: `complete everything in @GOAL.md`... The hook will block stopping until the condition holds. It auto-clears once the condition is met." (transcript 1402fa0a...jsonl:12-13).

Mechanics: goal condition is session-scoped; the command argument becomes both directive and Stop-hook condition; agent must start immediately; successful completion auto-clears the goal (`/goal clear` is only early cancel).

`@GOAL.md` was NOT parsed into a special queue type -- the agent just read the file ("Goal set. Read GOAL.md + progress doc first.", :18). The goal wrapper enforced the proposition "everything in that file is complete"; the Markdown supplied the meaning.

On attempted early stop, the hook did a SEMANTIC AUDIT of the transcript against completion criteria (not a periodic generic reminder): "Transcript shows: ... However, @GOAL.md completion requires Crazy Eights fully reverse-engineered, spec written, ported ... passed three-review gate, and shipped ... Transcript shows only the setup phase and earliest RE steps...". Agent responded by continuing + scheduling a wakeup.

Classification: `/goal` was a Claude Code slash command/wrapper; enforcement = session-scoped Stop hook; NOT defined in this repo (no `.claude/commands/goal.md`, no goal hook, no loop script). The only project skill is `.claude/skills/ghidra/SKILL.md`. Source is outside the repo evidence -- reimplement the observed contract rather than expect it to live in hoyle-re.

## 2. GOAL.md anatomy

Top-level scaffold: `# GOAL.md -- autonomous next-phase goal` - `**Shipped so far:** ...` - `## Goal (default target: ...)` with a blockquoted 5-stage goal + "Done when:" - `### Self-advance (do this as the last Ship step, every run)` - `## Reference -- the proven pipeline` - `## Retarget / alternatives` table - Batch/alternative options.

Header doubles as operator runbook: "Paste the **Goal** block below into `/goal` to run the next game port autonomously." Names the pipeline "RE -> spec -> port -> three-review -> merge -> submodule bump".

The 5-stage state machine (the reusable core), each pinned with concrete detail:
1. **RE complete** -- pins class clusters, help IDs, layout/turn rules, scoring formula, AI-memory questions, RNG path, required live-DB annotations, required save_program. Constrains discovery without pre-answering it; defines what "RE complete" evidence must contain.
2. **Spec** -- write `docs/NN-<game>-rules.md` as port-ready spec (CONFIRMED / INFERRED / flagged parity-TODOs), mirroring prior specs. Frozen implementation contract that retains uncertainty honestly.
3. **Port** -- dest dir, feature branch, TDD, reusable primitives, unit/functional/parity test layers, emotional-path tags, 100% pure-layer coverage. Prevents "implemented" degenerating into an untested dump.
4. **Three-review gate** -- QA + code-review + simplification by INDEPENDENT subagents; address every finding; gate green (`mise run check`). Independent adversarial checks + required closure.
5. **Ship** -- commits/pushes at checkpoints, subproject changelog, remote feature branch, non-ff merge, master push, parent submodule bump, parent changelog/progress, commit/push, retarget GOAL.md. "Done" = integrated + recoverable.

"**Done when:**" is a CONJUNCTIVE predicate ending in "**and `GOAL.md` retargeted to the next game.**" "**Stop only** for a genuine decision you + an advisor skill cannot confidently make." (narrows the "blocked" escape hatch).

Self-advance protocol (last Ship step, every run): add game to Shipped; strike + mark SHIPPED in table; rewrite goal heading/block for next target; increment doc number/dir/branch/RE pins; draw next anchors from inventory/help data. Retarget table = backlog + risk classifier, marks "highest bit-exactness risk ... do these attended, not autonomous".

## 3. The queue-exhaustion loop

Two state transitions.

**Within a session:** `/goal` condition active -> agent attempts stop -> Stop hook evaluates evidence vs condition -> incomplete: inject missing work, continue / complete: allow stop, auto-clear.

**Between sessions:** GOAL.md targets game N -> RE->spec->port->reviews->ship -> Ship step rewrites GOAL.md to game N+1 -> commit/push -> next session invokes `/goal complete everything in @GOAL.md`.

**Resolving the apparent paradox** (Done requires retargeting -> retargeting creates a new unfinished goal -> same goal never true): NOT how it behaved. The active Stop-hook condition was the invocation-level command; the agent treated self-advance as the LAST deliverable of the current run. The rewritten next block was preparation for the FOLLOWING invocation, not automatic expansion of the current run. Commit cadence confirms: `95170c1` "retarget GOAL.md to next phase (Crazy Eights) + self-advance step" then a week later the Crazy Eights RE/spec/ship/merge commits. Retarget prepared the next run; it did not immediately execute it.

-> Correct standardization: a queue treadmill ACROSS `/goal` invocations, not recursive execution inside one Stop hook.

**Queue representation:** no machine queue -- redundant Markdown (Shipped so far / Next default target / active Goal block / candidates table / struck SHIPPED rows / incrementing doc numbers). Deliberate for agent reasoning, not atomic. A standardized version could add YAML frontmatter while keeping the human-readable sections.

**Termination:** at invocation level = every conjunct in "Done when". At PROJECT level the current file has NO terminal sentinel -- it always names another target. A reusable template needs an explicit terminal state (e.g. `## Goal -- COMPLETE`, summarize optional debt, do not invent another phase). Without it the agent is encouraged to manufacture work.

## 4. Investigation / planning / scoping depth

Automation worked because earlier sessions converted a broad aspiration into a highly patterned production system.

PLAN.md is not a sprint list: purpose + legal/distribution model, "What we already know (from three parallel explore passes)", success criteria, architecture/layout, port-vs-reimplement boundaries, legal/IP, phase ordering, human-screenshot collaboration, numbered tasks, verification commands, execution blocks + checkpoint rules, risk + scope-honesty. Distinguishes deterministic ("extract bytes, decode, done") from discovery-driven work -- which let the loop assign formulaic games autonomously and reserve high-risk games for attended work.

Investigation used repeated evidence-improvement passes (Ghidra: decompile -> annotate -> re-decompile until it reads like C) with multiple independent anchors (strings/xrefs, MFC runtime-class tables, class-method enumeration, vocabulary-aligned annotation). Evidence classified not flattened (CONFIRMED / INFERRED / parity-TODO) -- prevented uncertain decompilation silently becoming asserted behavior. Plans were binding as PROCESS not as FACTS: Go Fish engine discovered to be Old Maid; task scopes revised when assumptions proved false; QA ambiguity triggered another binary check + spec correction; known original bugs registered + ported, not "fixed".

Autonomous run created 5 task records (RE, spec, port, three-review, ship). Reviews were substantive: QA returned "NEEDS WORK" with a corner-case test; agent rechecked the binary rather than guessing; findings sent back; corrected spec committed separately; suite reached 530 tests / 100% coverage; simplification concluded no changes warranted; only then shipping. CHANGELOG: "three-review gate passed (QA: NEEDS WORK -> all findings closed, code-review: APPROVE, simplification: no changes warranted)."

Standard of rigor to preserve: >=1 discovery pass mapping the system; written evidence inventory + unresolved-question register; explicit boundaries/non-goals; current-phase goal with named research questions; evidence-strength labels; a build spec before implementation; automated correctness gates; independent product/QA + code-quality + simplification reviews; re-investigation when review exposes ambiguity; a final integration + reporting checkpoint. "Depth" was less a fixed pass count, more ensuring each uncertainty crossed an evidence gate before becoming code.

## 5. Reporting-out pattern

Context written at several timescales:
- **Per discovery:** a dedicated port-ready rule doc (`docs/NN-<game>-rules.md`) -- implementation contract + next-agent handoff.
- **Per project state:** `docs/progress.md` -- "PLAN.md says what we're building; this says where we are. Update at every block boundary." README points resuming agents to it.
- **Per delivered change:** both changelogs. Parent CHANGELOG records shipped game, submodule commit, RE anchors, spec artifact, port structure + test counts, review outcomes, bugs + parity TODOs. Preserves the evidence + quality posture under which it shipped, not just "what changed".
- **Per checkpoint:** narrow semantically-named commits (RE pass, mechanical discovery, rule-complete spec, ship/submodule bump, review correction, retarget, merge) -- resumable evidence, not one opaque megapatch.
- **Cross-repo:** deliberate submodule integration procedure (commit/push web -> merge -> bump gitlink in parent -> update parent progress/changelog -> commit/merge).
- **GOAL.md as final report-to-next-run:** retarget captures what shipped, next target, anchors, incremented names, remaining alternatives + risk.

Every iteration reports BACKWARD through CHANGELOG/progress/specs and FORWARD through GOAL.md.

## 6. What made it work + what's project-specific

**Generalizable to nearly any project:** single durable version-controlled current-goal doc; conjunctive testable definition of done; strict separation of goal/plan/status/changelog; explicit investigation questions before implementation; evidence-strength labels; named quality gates + commands; independent reviews with mandatory finding closure; feature branches + deliberate integration; semantic checkpoint commits; "stop only for genuine decisions" policy; transactional self-advance to the next APPROVED phase; explicit risk classifier deciding what's autonomous; known-good exemplars for pattern completion; a terminal condition preventing invented work.

**Benefited from hoyle-re being formulaic:** each game followed nearly the same transform (binary class cluster -> rule/AI spec -> pure TS modules -> unit/functional/parity tests -> reviews -> merge/bump). Strong structural repetition (predictable class clusters, reusable help indexes, stable spec numbering, identical module layouts, reusable RNG/card primitives, repeatable test taxonomy, consistent branch naming, same review/ship process, finite candidate table). "Copy the Go Fish/War pattern" was unusually powerful. Creativity needed INSIDE RE; the surrounding delivery path was stable.

**Where the loop becomes unsafe:** open product requirements; multiple costly viable architectures; visual/interaction quality not reducible to exemplars; external stakeholder approval; subjective success; unknown dependencies; irreversible integration risk; the agent able to expand scope by retargeting itself. (The file already marks complex games "attended, not autonomous.")

**For a spec + MVP project (i.e. employa-bot):** same control loop, but a PHASE QUEUE not a feature treadmill. Recommended phases: (1) Discovery/evidence (2) Product/spec freeze (3) Architecture decision (4) Thin vertical slice (5) Correctness/resilience (6) Product QA/usability (7) Docs/operability (8) Release candidate (9) Terminal audit. Self-advance must NOT mean "the agent chooses the next product direction" -- it means "advance only to the next PREAPPROVED phase when its entry criteria are satisfied."

Add checkpoint TYPES:
- `AUTONOMOUS`: proceed when objective gates pass.
- `ADVISORY`: solicit independent analysis, then proceed using a recorded default.
- `HUMAN DECISION`: stop with options + evidence.
- `TERMINAL`: do not invent further work.

Anti-slop: MVP goal must require more than coverage -- acceptance-criteria traceability, architectural boundary tests, migrations/rollback, security + accessibility checks, error/empty/loading/recovery states, product-flow QA, docs tested from a clean environment, open-debt ledger with severity + ownership, release checklist, independent "should this exist?" simplification review.

Key principle: **automate execution only after investigation has made the work sufficiently formulaic.** hoyle-re did not skip planning; it invested enough that later execution became safely repetitive.

## 7. Concrete extraction -- minimal reusable kit

Files a new repo needs:
1. `GOAL.md` -- active phase, exact completion predicate, quality gates, self-advance, queue, terminal rule.
2. `PLAN.md` -- stable intent, architecture, scope, phase map, risk classification, verification, definitions of done.
3. `CLAUDE.md` -- invariants, canonical commands, boundaries, known traps, resume instructions.
4. `docs/progress.md` -- current state, last verified checkpoint, active branch, next action, blockers, unresolved questions.
5. `CHANGELOG.md` -- durable delivered outcomes, evidence, review results, deviations.
6. Exemplar spec(s) + implementation -- the repeatable pattern to copy.
7. `/goal` command / Stop-hook wrapper -- store a session goal, inject it as directive, reject premature stopping, explain missing evidence, auto-clear on success. (No loop script needed.)

**Standardized GOAL.md scaffold:**
```markdown
# GOAL.md -- autonomous current phase

## Ledger
- Completed: ...
- Current: ...
- Remaining approved phases: ...
- Terminal condition: ...

## Goal -- <current phase>
> Do not stop until <deliverable> is integrated.
> 1. Investigation -- questions that must be answered; sources/evidence required; UNKNOWN/INFERRED/CONFIRMED convention
> 2. Spec -- artifact path; acceptance criteria; architecture + non-goals
> 3. Implementation -- branch + module boundaries; required tests + quality commands
> 4. Reviews -- product/QA; correctness/code-quality; simplification/architecture; address every finding or record an approved waiver
> 5. Ship -- commit/push/merge; changelog/progress/docs; deployment/integration verification; self-advance this file
> Done when: <conjunctive, objectively verifiable predicate>.
> Stop only for: <explicit human-decision classes>.

### Self-advance
1. Record this phase under Completed.
2. Select only the next phase from Remaining approved phases.
3. Verify its entry criteria.
4. Rewrite the active Goal block for that phase.
5. Commit the transition with the shipped work.
6. If no approved phases remain, set Current: COMPLETE, remove the active work goal, summarize optional debt, and stop.

## Proven patterns
- Relevant exemplar specs / implementation / canonical commands / known pitfalls

## Approved queue
| Phase | Entry criteria | Exit criteria | Autonomy | Risk |
|---|---|---|---|---|
```

**/goal wrapper contract:** `/goal <condition>` -> validate nonempty, store session goal, inject (condition is the directive; begin/continue immediately; don't stop to report partial progress; stop only when evidenced or a permitted blocker), register Stop evaluator. On Stop -> evaluate repo state + transcript vs goal; complete: clear + allow; else: block + inject (evidence established, unmet predicates, next concrete action). `/goal clear` removes early. For stronger standardization, the Stop evaluator should read a machine-readable completion section rather than rely solely on unconstrained semantic judgment.

## Bottom line

Success did not come from a magical autonomous loop script. It came from coupling a semantic Stop hook with an exceptionally information-dense, version-controlled operating contract. `/goal` supplied persistence. `GOAL.md` supplied judgment structure. PLAN.md/specs/progress/changelogs/commits/tests/independent-reviews supplied accumulated institutional memory. Self-advance turned each successful shipment into the prepared starting state for the next invocation. Reusable -- but only after a project has been investigated enough that its next phases, evidence requirements, review gates, and stopping decisions can be written down with the same precision.
