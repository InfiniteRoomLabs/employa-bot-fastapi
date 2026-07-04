# CONTRACT-NOTES.md -- Slice 0 frozen-contract work order

Generated 2026-07-04 for the frontend adapter that replaces `../employa-bot-front-end/src/data/api.ts`. One row per changed shape. Columns:

- **Mockup field** -- what `types.ts` / `api.ts` ships today.
- **Frozen wire field** -- what `mvp-api.yaml` now says.
- **Adapter transformation** -- what the new `api.ts` must do at the HTTP boundary so the unchanged `types.ts` / hooks / screens still work.
- **api.ts fns** -- the exported functions that touch the shape.
- **Tests** -- test surfaces that assert on the shape.

Classification tags: **(a)** representation-only, **(b)** ruled by a settled machine / locked founder decision, **(c)** product decision -> see `DECISIONS-NEEDED.md` (deferred, NOT frozen).

The frozen contract wins every future dispute. Where the mockup disagrees, the contract wins; the adapter absorbs the difference.

---

## 1. Timestamps: relative strings -> ISO-8601 `date-time` (all (a))

Every mock relative-time string ("just now", "2d ago") is now `format: date-time` (UTC). The adapter must map the ISO instant BACK to the display strings the components expect (the mockup renders "2d ago" etc.), OR the components already accept a real date -- either way the derivation moves client-side. Ages (`Application.days`) are DERIVED from `createdAt`, not sent.

| Mockup field | Frozen wire field | Adapter transformation | api.ts fns | Tests |
| --- | --- | --- | --- | --- |
| `Application.days` (int, relative age) | `Application.createdAt` (date-time) + `version` (int) | Compute `days` client-side from `createdAt` (`now - createdAt`). `stageLabel` also dropped (see sec 4). | getApplications, getApplication, createApplication, markWon, undoMarkWon, reactivateApplication, dismissApplication | application view tests, kanban/age rendering |
| `Application.outcomeAt` (string) | date-time | parse ISO -> display | getArchive, markWon, dismissApplication | archive tests |
| `TimelineEvent.time` (string) | date-time | parse ISO -> "2d ago" | getApplicationTimeline, saveCoachProposal | timeline tests |
| `InterviewRound.date` (string) | date-time | parse ISO | getInterviewRounds, patchInterviewRound | interview tests |
| `ResumeSnapshot.capturedAt` (string) | date-time | parse ISO | getResumeSnapshot | snapshot tests |
| `ShortlistEntry.saved` (string) | date-time | parse ISO -> "saved 2d ago" | getShortlist, addToShortlist | shortlist tests |
| `JobInboxItem.posted` / `capturedAt` (string) | date-time | parse ISO | getJobsInbox | inbox tests |
| `Job.posted` (string), `JobSource.capturedAt` (string) | date-time | parse ISO | getJobs, getJob | job-detail tests |
| `Agent.lastActivity` (string) | date-time | parse ISO | getAgents, getAgent, patchAgent | agent tests |
| `AgentLogEntry.time` (string) | date-time | parse ISO | getAgentLog | agent-log tests |
| `ReviewQueueItem.time` (string) | date-time | parse ISO | getReviewQueue (DEFERRED) | -- |
| `Resume.updated` (string) | date-time | parse ISO | getResumes, patch/create/duplicate/setDefault/fork, getProjections, createProjection, assignTemplate | resume tests |
| `ResumeUpload.uploadedAt` (string) | date-time | parse ISO | getResumeUploads | -- |
| `ResumeExport.generatedAt` (string) | date-time | parse ISO | getResumeExports, renderExport, regenerateExport | export tests |
| `CoachThread.when` (string) | date-time | parse ISO | getCoachThreads, getCoachThread | coach tests |
| `Contact/Accomplishment/Answer/Project.updated` (string) | date-time | parse ISO | library get/create/update fns | library tests |
| `Credential.updated` (string) | date-time; `Credential.expiry` -> `format: date` | parse ISO | getCredentials | -- |
| `ExtensionToken.createdAt/revokedAt` (string) | date-time | parse ISO | getSettings | settings tests |
| `AgentTrustTierView.unlockedAt` (`format: date`) | date-time | parse ISO | getAgentTrustTier | trust-tier tests |
| `IntegrationRow.lastSync` (string) | date-time | parse ISO | getSettings | settings tests |
| `Settings.privacyLastUpdated`, `plan.nextCharge` (string) | date-time | parse ISO | getSettings | settings tests |
| `InvoiceRow.date` (string) | date-time | parse ISO | getSettings | settings tests |
| `MarkWonInput.startDate` (string) | `format: date` | send ISO date | markWon | mark-won tests |
| `account/delete.gracePeriodEndsAt` | unchanged (`format: date`) | -- | deleteAccount | -- |

## 2. Money: strings -> numbers suffixed `Usd` (all (a))

Structured `Salary` (integer dollars) STAYS structured -- it is compensation data, not a cost. String-money display fields become plain USD numbers (<=6 dp).

| Mockup field | Frozen wire field | Adapter transformation | api.ts fns | Tests |
| --- | --- | --- | --- | --- |
| `ShortlistEntry.compensation` (string "$180k") | `ShortlistEntry.salary` (`Salary` \| null) | format `salary` -> display string via existing `formatSalary()` | getShortlist, addToShortlist | shortlist tests |
| `JobInboxItem.compensation` (string) | `JobInboxItem.salary` (`Salary` \| null) | format via `formatSalary()` | getJobsInbox | inbox tests |
| `Agent.cost` (string "$0.00") | `Agent.costUsd` (number) | format USD client-side | getAgents, getAgent, patchAgent | agent tests |
| `Search.spendMo` (string) | `Search.spendMoUsd` (number) | format USD | getSearches, getSearch, createSearch, updateSearchCriteria | search tests |
| `SearchCriteria.baseFloor/baseCeiling` (string) | `baseFloorUsd/baseCeilingUsd` (number) | format USD | getSearch(es), createSearch, updateSearchCriteria | criteria form tests |
| `SearchCriteria.remotePolicy` enum `[OK, Hybrid OK, Required]` | `[remote-ok, hybrid-ok, required]` (machine tokens) | map token -> display copy client-side (review M3) | getSearch(es), createSearch, updateSearchCriteria | criteria form tests |
| `SearchCriteria.yearsExperience` (string "8-14 yrs") | `yearsExperienceMin`/`yearsExperienceMax` (optional integers) | parse band string into two ints; render the band client-side (review n3) | getSearch(es), createSearch, updateSearchCriteria | criteria form tests |
| `MarkWonInput.negotiatedComp` (string "$280k + equity") | `negotiatedComp` (`Salary` \| null) | parse user input into structured `Salary`; qualifiers (equity, sign-on) go in `SalaryPoint.extra` (review M4) | markWon | mark-won tests |
| `CostPreviewItem.estCostUsd` | unchanged (number) | -- | previewDeepMatchScore | cost-preview tests |
| `DeepMatchResult.costUsd` | unchanged (number) | -- | runDeepMatchScore | -- |
| `Settings.monthSpend/monthlyCap` (string) | `monthSpendUsd/monthlyCapUsd` (number) | format USD | getSettings, previewDeepMatchScore (cap math) | settings/cap tests |
| `Settings.profile.compFloor` (string) | `compFloorUsd` (number) | format USD | getSettings | settings tests |
| `Settings.plan.price` (string) | `plan.priceUsd` (number) | format USD | getSettings | settings tests |
| `ProviderRow.balance` (string) | `balanceUsd` (number) | format USD | getSettings | settings tests |
| `UsageRow.cost` (string) | `costUsd` (number); `UsageRow.tokens` string -> integer | format USD / int | getSettings | usage tests |
| `InvoiceRow.amount` (string) | `amountUsd` (number) | format USD | getSettings | settings tests |
| `UsageAggregate.monthSpend/monthlyCap/avgPerSession` (string) | `monthSpendUsd/monthlyCapUsd/avgPerSessionUsd` (number); `tokensIn/tokensOut` string -> integer | format USD / int | getUsageAggregate | usage tests |

## 3. Counts / tokens -> integers (a)

`UsageRow.tokens`, `UsageAggregate.tokensIn/tokensOut` were preformatted strings ("1.2M"); now integers. Adapter formats abbreviations client-side.

## 4. Presentation fields removed / converted to enums

| Mockup field | Call | Frozen result | Rationale | Tag |
| --- | --- | --- | --- | --- |
| `Agent.icon` | remove | gone | pure UI; client owns icon | a |
| `Agent.stateLabel` | remove | gone; `state` enum carries the semantics | display copy | a |
| `Notification.icon` | remove | gone | pure UI | a |
| `IntegrationRow.icon` | remove | gone | pure UI | a |
| `Application.stageLabel` | remove | gone | `stage` enum carries it; client labels | a |
| `Search.eyebrow` | remove | gone | display copy | a |
| `TimelineEvent.badge` | remove | gone; `actor` enum (you/coach-on-behalf/agent) is the branch key | badge was display copy, actor is the real discriminator | a |
| `TrustTierRung.label/blurb` | remove | `TrustTierRung` = `{tier}` only | display copy; client owns ladder copy | a |
| `RoutingRow.label/value` | rename | `{task, model}` | generic display pair -> semantic keys (data kept) | a |
| `NotifPref.consequence` | remove | gone; `category` (key) kept | consequence was copy; category is data | a |
| `NotifPref.category` | keep | kept (key) | identifies the row (client maps to copy) | a |
| `CoachThread.title` | keep | kept | thread title is data | a |
| `Settings.danger` (`DangerAction[]`) | remove | whole field + `DangerAction` schema gone | rows are literal button copy; the actions have real endpoints (`deleteAccount`, `requestDataExport`) | a |
| `Settings.privacy` (`PrivacyToggle`) | split | `{key, on}`; `title/description` dropped | toggle STATE is data, copy is client-owned; client maps `key` -> copy | a |
| `CostPreviewItem.label` | replace | `CostPreviewItem.resumeId` (uuid) | label was "Deep match score -- {name}" copy; the line identifies a resume | a |
| `CreateApplicationInput.stageLabel` + `.days` | remove | both gone from the request | mock quirks: server derives initial stage; age derives from `createdAt`. Adapter stops sending them (also `resume` label -> `resumeId`, sec 5) | a |

## 5. UUID-ification (all (a)/(b) -- identity normalization)

The shared `id` path param is now `format: uuid`; slug/name leniency text is removed from the contract (see slug<->UUID section). Specific identity changes:

| Mockup | Frozen | Adapter | api.ts fns | Tests |
| --- | --- | --- | --- | --- |
| `DELETE /shortlist/{role}` (role string) | `DELETE /shortlist/{id}` (uuid) + `ShortlistEntry.id` added | pass entry `id` not role; a 404 is now possible (mock was idempotent) | dismissFromShortlist | shortlist-dismiss tests |
| `/agents/review-queue/{ref}` (approve/reject) | `/agents/review-queue/{id}` (uuid); `ReviewQueueItem.ref` -> `id` | pass `id` | approveAgentAction, rejectAgentAction (DEFERRED) | -- |
| `getResume(nameOrIndex)` name/index resolve | `GET /resumes/{id}` uuid-only | drop the name/index branch; pass uuid | getResume | resume-by-id tests |
| `getMatchReport` `{resumeId,jobId}` string query | uuid query params | pass uuids | getMatchReport | match tests |
| `runDeepMatchScore(resumeName)` | request `resumeId` (uuid) | pass resume uuid, not name | runDeepMatchScore | deep-score tests |
| `previewDeepMatchScore(resumeNames[])` | request `resumeIds` (uuid[]) | pass resume uuids | previewDeepMatchScore | cost-preview tests |
| `deriveAccomplishmentFromProject(projectId string)` | request `projectId` uuid | pass uuid | deriveAccomplishmentFromProject | derive tests |
| `createApplication({resume: label})` | `CreateApplicationInput.resumeId` (uuid \| null) | resolve label -> uuid client-side before POST; server no longer name-prefix-resolves | createApplication | create-app tests |
| all entity `id`, FK, `appId/roundId`, projection/upload/template ids | `format: uuid` | none (already uuid at runtime) | many | -- |

## 6. Structural additions

### 6a. `POST /applications/{id}/transitions` (`transitionApplication`) -- NEW, (b)

The core-loop operation. **Not consumed by `api.ts` today** -- the mockup only has special-case actions (mark-won/dismiss/reactivate) and lacks a generic forward-transition function (applied->screening->interview->offer). The frontend adapter ADDS a `transitionApplication(id, input)` fn and wires the stage-tracker UI to it. Request: `{targetStage, expectedVersion, source?, reason?, reasons?, resumeId?}`. Response `{application, transition}`. Legal moves = the settled application-stage machine ONLY; illegal -> 422 `invalid_transition`; version mismatch -> 409 `conflict`. `resumeId` required when `targetStage=applied` (materializes + locks the D10 snapshot).

### 6b. `AiRunEnvelope` embedded in AI responses -- NEW, (b)

`DeepMatchResult.aiRun` and `AccomplishmentDeriveResult.aiRun` (a new wrapper: `{accomplishment, aiRun}`). Adapter for `deriveAccomplishmentFromProject` UNWRAPS `result.accomplishment` to keep the `Accomplishment` return type the hook expects. `runDeepMatchScore` gains `aiRun` on the existing result -- ignore it in the adapter unless surfacing run telemetry. `AiRunStatus` on the wire is terminal-only (`succeeded|failed|cancelled`) since execution is synchronous; the full 5-state lifecycle is server-side telemetry (review m2).

### 6c. `Application.version` -- NEW, (b)

Integer optimistic-concurrency counter. Adapter must round-trip it into `expectedVersion` on transitions. The mock has no version; seed/back it from the app record.

## 7. Stage enum expansion (b) -- settled machine is normative

Old (mock): `saved | draft | applied | screen | interview | offer | rejected | closed` (8).
Frozen: `saved | drafting | applied | screening | interview | offer | won | rejected | ghosted | withdrew | dismissed | offer_rescinded` (12, lowercase, snake_case for multiword).

**Delta map (adapter, old -> new):**

| Old | New |
| --- | --- |
| `saved` | `saved` |
| `draft` | `drafting` |
| `applied` | `applied` |
| `screen` | `screening` |
| `interview` | `interview` |
| `offer` | `offer` |
| `rejected` | `rejected` |
| `closed` | terminal set: resolve via `outcome` -> `won` / `rejected` / `withdrew`; else `dismissed` |

`Application.outcome` (`won|rejected|withdrawn`) is KEPT as the archive bucket; note `withdrawn` (outcome) vs `withdrew` (stage) -- the adapter maps between them. Affected: every application fn, kanban columns, filter chips. Tests: kanban/stage tests, archive bucket tests.

## 8. Error envelope (b)

Single shared `Error` schema retained. `kind` enum is now exactly:
`not_found, validation_error, conflict, cap_reached, undo_window_expired, invalid_transition, rate_limited, provider_unavailable, unauthorized`.

- **Added:** `provider_unavailable` (503, AI provider down/failed).
- **Dropped from the wire:** `network`, `unknown`. The frontend translator SYNTHESIZES these itself: fetch reject / DNS / TCP -> `network`; unmapped status -> `unknown`. They are client-only kinds now (keep them in `src/lib/mock-api-error.ts`, just don't expect them on the wire).
- Every operation carries a `default:` -> `Error` response. Typed statuses (404/409/402/422/429/503) stay explicit where they exist.
- `kind` -> HTTP status map is documented in `info.description`.

**Error-kind translator changes (`api.ts` `call()`):** extend the recipe in the wiring guide with:
```
if (res.status === 402) throw new MockApiError('cap_reached', path);
if (res.status === 409) throw new MockApiError(body.kind, path);   // conflict | undo_window_expired
if (res.status === 422) throw new MockApiError(body.kind, path);   // validation_error | invalid_transition
if (res.status === 503) throw new MockApiError('provider_unavailable', path);
```
Prefer the response body `kind` when present (409 and 422 are ambiguous by status alone). Keep the existing `network`/`unknown` fallbacks for transport failures.

## 9. Slug <-> UUID note

The contract drops ALL slug/name leniency (applications by slug, resumes by name/index, shortlist by role). Resolution is UUID-only server-side. The frontend keeps its **client-side** `APP_UUID_BY_SLUG` / `APP_SLUG_BY_UUID` maps (in `fixtures.ts` / seed) so existing deep-links and demo references keep working -- the adapter translates slug->uuid before calling, and the timeline lookup that keys by slug (`TIMELINE_BY_APP`) resolves via the client map. No leniency crosses the wire.

## 10. Cross-check result (api.ts exports vs frozen contract)

Walked every exported fn in `../employa-bot-front-end/src/data/api.ts` minus the 4 mock-only exclusions (`getUserMenu`, `getExtensionState`, `getBudgetSnapshot`, `__resetForTests`). **Every consumed fn maps to a frozen operation, the DEFERRED list, or a client-constant. No consumed operation was dropped silently.** Wiring-guide tables also walked -- all rows map. Notes:

- `getCoachGreeting` -- **founder ruled 2026-07-04 (DECISIONS-NEEDED #5): REMOVED from the contract.** Greetings are canned per-scope client copy (same class as `getUserMenu` / `getExtensionState`). Adapter: `getCoachGreeting(scope)` returns a local `COACH_GREETING_BY_SCOPE[scope]` constant -- NO HTTP call. Contract op count is now **89**; the DEFERRED list is now **6**.
- `renameResume`, `saveResumeBody`, `patchResumeScoring` all collapse onto `PATCH /resumes/{id}` (`patchResume`) -- 3 mock fns -> 1 frozen op (already the mock's documented intent).
- `getApplications(searchId?)`, `getShortlist(searchId?)`, `getJobsInbox(searchId?)` are dual-mode; the contract keeps a single operation with an optional `searchId` query (the wiring guide's nested-resource form is an implementation choice, not a contract split).
- `transitionApplication` is net-new (no api.ts consumer yet); the adapter adds it. Flagged, not dropped.
- The 4 exclusions confirmed ABSENT from the contract (no `/user-menu`, no `/extension`, no budget-snapshot route); `getCoachGreeting` joins them as a client-constant.
- DEFERRED operations still have api.ts consumers today; they remain in the spec but are NOT frozen-implementable (see manifest + DECISIONS-NEEDED.md).

Mismatches / judgment calls flagged for orchestrator re-check:
1. `ShortlistEntry.salary` and `JobInboxItem.salary` (was `compensation` string): I represented these as structured `Salary` (matching `Job.compensation`) rather than a bare number, because the data IS compensation, not a cost. If the founder prefers a flat `compensationUsd` number, that is a one-line change.
2. `CostPreviewItem.resumeId` replaced `label`: assumes each preview line is per-resume (true in the mock). Confirm no non-resume preview lines are planned.
3. `RoutingRow {task, model}`: kept as data (rename) rather than removed. If routing config is not a real MVP surface, it could be dropped instead.
4. `PrivacyToggle {key, on}`: introduces a `key` the mock lacks; the backend must assign stable keys and the client needs a `key -> copy` map. Confirm the toggle set is fixed.
5. RESOLVED (review M4): `MarkWonInput.negotiatedComp` is now structured `Salary` (not a flat `...Usd` number) -- the mark-won screen collects qualifier-bearing input ("$280k + equity + sign-on") which `SalaryPoint.extra` carries.

## 11. Pass-through operations (coverage traceability, review m5)

Every one of the 89 frozen operations is accounted for in exactly one bucket below. Only bucket A needs field remapping in the adapter. (`getCoachGreeting` was removed from the contract by the founder ruling -- it is now a client-constant, not an operation.)

**Bucket A -- structural / field-remap changes:** covered by the delta rows in sections 1-8 and the additions in section 6. 61 operations.

**Bucket B -- mechanical-only (no field remap; timestamp string -> ISO and/or `id` -> `format: uuid` only, plus the blanket `default:` response):** the adapter's generic ISO-parse + uuid pass covers these; no per-field work. 12 operations: `getInterviewRounds`, `getResumeSnapshot`, `getJobs`, `getJob`, `getResumeUploads`, `getResumeExports`, `getCoachThreads`, `getCoachThread`, `getCredentials`, `renderExport`, `regenerateExport`, `deleteAccount` (`gracePeriodEndsAt` date -> date-time, review m4). (These also appear in the section-1 timestamp table where applicable.)

**Bucket C -- zero-touch pass-through (no request/response/param change beyond the blanket `default:` response; adapter does nothing special):** 16 operations, verbatim operationIds:

`getCurrentUser`, `getArchiveCounts`, `dismissApplication`, `getAgentPermissions`, `requestDataExport`, `deleteResume`, `deleteContact`, `deleteAccomplishment`, `deleteAnswer`, `deleteProject`, `restoreLibraryItem`, `purgeLibraryItem`, `getDeletionImpact`, `getTrash`, `getCareerHistory`, `getResumeTemplates`.

Note: the cold review estimated ~32 "unchanged" ops; that figure folds buckets B and C together (mechanical + zero-touch = 28). Under a strict "no adapter transformation whatsoever" definition it is 16 (bucket C). Either way, all 89 are traceable: A (61) + B (12) + C (16) = 89.

---

## AI-OPS (drives the `AIProvider` interface)

Operations that invoke a model. The `AIProvider` ABC gets one typed method per FROZEN AI op; deferred AI ops get their method when the founder rules.

| operationId | Frozen? | AIProvider method | Notes |
| --- | --- | --- | --- |
| `runDeepMatchScore` | YES | `deep_match_score` | 402 cap / 429 queue / 503 provider; `aiRun` embedded |
| `deriveAccomplishmentFromProject` | YES | `derive_accomplishment` | 429/503; `{accomplishment, aiRun}` wrapper |
| `proposeCoachEdit` | NO (deferred) | `propose_coach_edit` (deferred) | AI, but blocked on the proposal-approval machine |

`getCoachGreeting` is NO LONGER an AI op (or any op): founder ruled 2026-07-04 to ship it as canned client copy (DECISIONS-NEEDED #5). Removed from the contract.

Confirmed NON-AI (reads / arithmetic, no provider method): `previewDeepMatchScore` (cost math), `getMatchReport` / `getCoachThread` / `getCoachThreads` (reads of stored results).

## DEFERRED (founder ruled 2026-07-04: DEFERRED -- NOT frozen as implementable)

These 6 stay in `mvp-api.yaml` (marked DEFERRED in their descriptions) but are excluded from the implementable set per the founder ruling. See `DECISIONS-NEEDED.md`. (`getCoachGreeting` is NOT here -- it was removed from the contract entirely, not deferred.)

- `proposeCoachEdit` -- proposal-approval machine (item 1)
- `saveCoachProposal` -- proposal-approval machine (item 1)
- `getReviewQueue` -- proposal-approval machine (item 1)
- `approveAgentAction` -- proposal-approval machine (item 1)
- `rejectAgentAction` -- proposal-approval machine (item 1)
- `patchAgentTrustTier` -- granted-vs-pending (item 2)
