# DECISIONS-NEEDED.md -- Slice 0 founder ruling batch

> **RULED 2026-07-04: founder accepted all 10 recommended defaults as-is.**
> Consequences folded into `mvp-api.yaml` + `CONTRACT-NOTES.md`. Notably, item 5
> removed `getCoachGreeting` from the contract entirely (canned client copy);
> the DEFERRED operation list is now 6 (proposeCoachEdit, saveCoachProposal,
> getReviewQueue, approveAgentAction, rejectAgentAction, patchAgentTrustTier).

Every category-(c) item found while freezing `mvp-api.yaml`. Each needs an explicit founder ruling OR an explicit deferral -- silence is not approval (per mvp-plan.md). Ruled items get frozen into the contract; unruled items stay on the deferred list and their operations are NOT implementable.

For each: **(i) question, (ii) recommended default, (iii) consequence of the default, (iv) affected operationIds.**

The recommended default is always the narrowest reversible interpretation.

---

## 1. Proposal-approval machine (unresolved state-machine stub)

**(i) Question.** The proposal-approval machine (`state-machines.md` "Outbound email + proposal" stub) is undrawn. How does a Coach/agent proposal flow from draft -> review -> apply? What states does a queued action have (pending / confirmed / rejected / invalidated-on-intervening-activity)? Does saving a proposal route through the exact same lock/append-only write path a human edit uses, and what audit attribution is recorded?

**(ii) Recommended default.** DEFER. Do not implement any proposal-approval endpoint in MVP. Ship the Coach panel read-only (threads + context) and the user's own direct edits; no agent-proposed writes.

**(iii) Consequence.** Coach can show context and greetings but cannot propose-and-apply changes; the review queue is inert. No agent write path exists to secure/audit yet -- which is the safe posture given "model output never directly authorizes writes" (mvp-plan AI ground rules). Reversible: add the machine later without touching frozen ops.

**(iv) Affected operationIds.** `proposeCoachEdit`, `saveCoachProposal`, `getReviewQueue`, `approveAgentAction`, `rejectAgentAction`.

**RULING (2026-07-04): default accepted.**

## 2. Agent trust-tier grant: immediate vs pending

**(i) Question.** `patchAgentTrustTier` -- does setting a tier grant immediately (mock behavior, `status=granted`) or enter a `pending` review state? The `granted|pending` split depends on the same unresolved approval machine as item 1.

**(ii) Recommended default.** DEFER the pending path; if any tier UI ships, grant immediately (`status=granted`) with the soft-gate framing the mock uses. But since trust tiers only matter once agents can act (item 1), DEFER the whole operation.

**(iii) Consequence.** No server-enforced tier gating in MVP; agents don't act autonomously anyway (item 1). Reversible.

**(iv) Affected operationIds.** `patchAgentTrustTier` (and the read `getAgentTrustTier` / `getAgentPermissions` stay implementable as pure reads if the founder wants the ladder visible).

**RULING (2026-07-04): default accepted.**

## 3. Rescission rollback cascade (WON -> OFFER_RESCINDED)

**(i) Question.** The `WON -> OFFER_RESCINDED` transition IS legal in the settled machine, but the dependent-cascade / two-phase rollback semantics (`state-machines.md` "Rescission rollback" stub: what dependent records unwind, FK-provenance rollback) are unresolved. What exactly happens to archived state, snapshots, and downstream records when a WON is rescinded after the D18 undo window closes?

**(ii) Recommended default.** Allow the `offer_rescinded` transition via `transitionApplication` (it is a legal edge), but perform NO automatic dependent cascade -- just record the stage change + a compensating transition. The 5-minute D18 undo (`markWon`/`undoMarkWon`) is settled and stays fully implementable; only the post-window cascade is deferred.

**(iii) Consequence.** A rescinded win moves stage and audits correctly but leaves any dependent records to manual cleanup; no silent multi-record mutation ships unreviewed. Reversible: add the cascade when the machine is drawn.

**(iv) Affected operationIds.** `transitionApplication` (the `offer_rescinded` target's cascade only; the transition itself is frozen). `markWon` / `undoMarkWon` are NOT affected (settled, frozen).

**RULING (2026-07-04): default accepted.**

## 4. Research / match-run product-visible states

**(i) Question.** The AI execution model is frozen as SYNCHRONOUS (no polling, no product-visible queued states). Does the deep-score / research flow need ANY product-visible run state machine (idle/running/complete/failed/cancelled), or does the synchronous request/response + `cap_reached` re-consent fully cover it? The `state-machines.md` "Research / match run" stub implies a single-in-flight guard.

**(ii) Recommended default.** NO product-visible run states. Synchronous execution + the embedded `AiRunEnvelope` (telemetry only) + `cap_reached` (402) re-consent + `rate_limited` (429) on queue overflow covers the MVP. Run records persist server-side as telemetry, never surfaced as workflow states.

**(iii) Consequence.** No `/ai-runs/{id}`, no polling, no run-status UI. If a future long-running research op needs async, it is a new decision -- does not retro-break the frozen synchronous ops. Reversible.

**(iv) Affected operationIds.** `runDeepMatchScore`, `previewDeepMatchScore`, `deriveAccomplishmentFromProject` (confirm none need a run-state surface). Confirms the frozen synchronous model; no new ops requested.

**RULING (2026-07-04): default accepted.**

## 5. `getCoachGreeting` -- canned vs generated

**(i) Question.** Is the per-scope Coach greeting canned client copy (then it does NOT belong in the API -- ship it with the client) or generated server-side (dynamic, context-aware -> it is an AI op)?

**(ii) Recommended default.** Treat as CANNED client copy for MVP -> the operation is NOT part of the backend contract; the client ships the greeting/chips. DEFER the generated variant.

**(iii) Consequence.** One fewer endpoint and one fewer AI provider method in MVP; greetings are static per scope. If generation is wanted later, it becomes a new AI op (add an `AIProvider` method then). Reversible.

**(iv) Affected operationIds.** `getCoachGreeting`.

**RULING (2026-07-04): default accepted.** `getCoachGreeting` and the `CoachGreeting` schema are REMOVED from `mvp-api.yaml`; the frontend ships canned per-scope copy (adapter returns a local constant, no HTTP). Contract op count 90 -> 89.

## 6. Posting-level dismiss (inbox listing) -- Application or posting record?

**(i) Question.** (`state-machines.md` Job-posting section, ~line 31.) When a user dismisses a raw INBOX LISTING (not a committed Application) with an 8-chip reason, does it create a `dismissed` Application, or stay a posting-level record that feeds match-score learning? The shipped `Stage` enum's `dismissed` value is a pre-commit application concept; a raw listing has no Application yet.

**(ii) Recommended default.** Posting-level record, NOT an Application. Dismissing a listing stays on the Job/posting side (feeds DEC-044 match-score learning); it does NOT mint a `dismissed` Application. DO NOT add an inbox-dismiss endpoint in this batch -- there is none in the contract today and none is invented.

**(iii) Consequence.** `dismissed` remains an application-only stage reached via `transitionApplication` from `saved`/`drafting`. The listing-dismiss endpoint is future work (the inbox slice can add it once ruled). No endpoint added now.

**(iv) Affected operationIds.** None (no endpoint exists; flagged so it is not silently assumed). Relates to `transitionApplication` `dismissed` semantics.

**RULING (2026-07-04): default accepted.**

## 7. Saved-search pause/activate

**(i) Question.** `Search.state` (`active|paused`) exists on the read model but there is NO mutation to change it. Should MVP ship a pause/activate operation?

**(ii) Recommended default.** DEFER. No pause/activate endpoint in MVP; `state` is read-only and defaults to `active`. DO NOT add the endpoint in this batch.

**(iii) Consequence.** Users cannot pause a search in MVP; the field is informational. Reversible: add `POST /searches/{id}/pause` (or a PATCH) in a later slice.

**(iv) Affected operationIds.** None added. Field `Search.state` stays read-only.

**RULING (2026-07-04): default accepted.**

## 8. Saved-search deletion

**(i) Question.** There is no `DELETE /searches/{id}`. Can users delete a saved search?

**(ii) Recommended default.** DEFER. No delete in MVP (searches accumulate; the D15 "My jobs" default must always exist). DO NOT add the endpoint now.

**(iii) Consequence.** Searches are create/edit only in MVP. Reversible.

**(iv) Affected operationIds.** None added.

**RULING (2026-07-04): default accepted.**

## 9. Notification deletion

**(i) Question.** Notifications support mark-read / mark-all-read but not delete. Can users delete/dismiss a notification?

**(ii) Recommended default.** DEFER. Mark-read only in MVP; no delete. DO NOT add the endpoint.

**(iii) Consequence.** Notifications persist once read; no removal. Reversible.

**(iv) Affected operationIds.** None added (`markNotificationRead`, `markAllNotificationsRead` stay frozen).

**RULING (2026-07-04): default accepted.**

## 10. Coach message-send

**(i) Question.** Coach threads exist (`getCoachThreads`, `getCoachThread`) but there is NO operation to POST a message into a thread. Is Coach conversational in MVP (user sends messages) or read-only?

**(ii) Recommended default.** READ-ONLY Coach in MVP -> no message-send endpoint. The product never sends mail (COA-024) and the proposal path is deferred (item 1); a send op would need the same unresolved machine. DO NOT add the endpoint.

**(iii) Consequence.** Coach shows threads/context/greetings but users cannot post to a thread from the app in MVP. Reversible: add `POST /coach/threads/{id}/messages` once the interaction model is ruled.

**(iv) Affected operationIds.** None added (`getCoachThreads`, `getCoachThread` stay frozen reads).

**RULING (2026-07-04): default accepted.**
