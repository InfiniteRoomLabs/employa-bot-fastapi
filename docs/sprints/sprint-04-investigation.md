# Sprint-04 investigation: applications / resume / snapshot mock surface

Scope: map the existing mock-API surface (applications, resume-lifecycle, resumes) plus the append-only and composite-FK/DB-job exemplar machinery sprint-04 will copy, so the spec author can freeze a mini-spec without re-reading the whole tree. Every claim below is labeled CONFIRMED (read the code), INFERRED (deduced but not directly read), or UNKNOWN (could not confirm).

Branch: sprint-04-apps-resume-snapshot. All file:line references below are current as of this branch's HEAD at investigation time.

## 0. TOP RISK -- CONFIRMED syntax error in backend/app/api/deps.py

`backend/app/api/deps.py:51` reads:

```
except InvalidTokenError, ValidationError:
```

This is Python 2 syntax. Python 3 requires `except (InvalidTokenError, ValidationError):`. Verified with `python3 -c "import ast; ast.parse(open('app/api/deps.py').read())"` -- it raises `SyntaxError: multiple exception types must be parenthesized` at that exact line.

`get_current_user` (deps.py:35) is what every mock router's `Depends(get_current_user)` resolves through, and `TenantSession`/`CurrentUser` (used by `createApplication` in applications.py and by the shortlist/jobs DB routes) both depend on it. As committed, `backend/app/api/deps.py` cannot be imported, which means the whole `app.api.deps` module -- and therefore the FastAPI app -- currently fails to import. CONFIRMED via `ast.parse`; not run against a live server. This blocks any work in this area and should be the very first fix, ahead of any sprint-04 feature work. Flagging it here rather than fixing it myself per the investigation-only mandate.

## 1. Mock applications surface (backend/app/api/routes/applications.py)

Router: `dependencies=[Depends(get_current_user)]`, tag `applications`. No tenant scoping (CONFIRMED -- no `TenantSession`/`user_id` filtering anywhere in this router except the one write path noted below). All state lives in `app.store` module-level dicts.

Ops (operationId, method, path, response_model):

- `getApplications` -- GET `/applications` (applications.py:141-165) -- `list[ApplicationView]`. Filters `store.applications` by `searchId` (BACKEND/AI_INFRA select their pool, else falls back to PLATFORM).
- `getApplication` -- GET `/applications/{id}` (168-178) -- `ApplicationView`. Looks in `store.applications` then `store.archive`; 404 via `NotFoundError` if neither.
- `createApplication` -- POST `/applications` (207-263) -- `ApplicationView`, 201. Takes `TenantSession` + `CurrentUser` (the only DB-touching op in this file). Mints a `Job` into `store.jobs` (mock join fixture) AND persists a real `JobRow` via `wire_job_to_row(job, user_id=current_user.id)` + `session.commit()` (job_mapper.py, sprint-02 pattern), then creates an ids-only `Application` (stage=drafting, version=1) in `store.applications` only -- the Application itself is NOT persisted to any DB table today. `searchId` auto-assigned via `_ensure_default_search()` (181-204, mirrors mock `ensureDefaultSearch`: prefer "My jobs" search, else last-added, else auto-create the "My jobs" sentinel).
- `transitionApplication` -- POST `/applications/{id}/transitions` (271-354) -- `TransitionResult`. The core op; see LEGAL_TRANSITIONS below.
- `getResumeSnapshot` -- GET `/applications/{id}/snapshot` (362-399) -- `ResumeSnapshot`. 404 unknown id; 409 `conflict` if stage in (saved, drafting) -- "no submitted copy exists until APPLIED". Prefers a captured `store.resume_snapshots[id]` (written by `transitionApplication` on `-> applied`); else synthesizes one on the fly from `app.resumeId`/`store.resumes` with a deterministic `uuid5` id.
- `markWon` -- POST `/applications/{id}/mark-won` (407-440) -- `MarkWonResult`. See section on undo below.
- `undoMarkWon` -- POST `/applications/{id}/undo-mark-won` (443-466) -- `ApplicationView`. Body: `{undoToken: UUID}` (hand-authored `UndoMarkWonBody`, no `$ref` in contract).
- `reactivateApplication` -- POST `/applications/{id}/reactivate` (474-501) -- `ApplicationView`. 404 if not in `store.archive`. Clears outcome fields, sets `stage=applied`, `resurrected=True`, bumps version, moves archive -> applications.
- `dismissApplication` -- POST `/applications/{id}/dismiss` (509-542) -- `DismissResult`. Dual-mode (D12), see below. Body: `{reasons: list[str] | None}` (hand-authored `DismissBody`).
- `getApplicationTimeline` -- GET `/applications/{id}/timeline` (550-577) -- `list[TimelineEvent]`. Returns `store.timelines[id]` if present, else synthesizes a single "Applied via <source>" event with a deterministic `uuid5` id. 404 if the app is in neither `applications` nor `archive`.

### LEGAL_TRANSITIONS (verbatim, applications.py:86-115)

```python
LEGAL_TRANSITIONS: dict[Stage, frozenset[Stage]] = {
    # [*] --> SAVED / DRAFTING are creation entries, not transitions.
    Stage.saved: frozenset({Stage.drafting, Stage.dismissed}),
    Stage.drafting: frozenset({Stage.applied, Stage.dismissed}),
    Stage.applied: frozenset(
        {Stage.screening, Stage.rejected, Stage.ghosted, Stage.withdrew}
    ),
    Stage.screening: frozenset(
        {Stage.interview, Stage.rejected, Stage.ghosted, Stage.withdrew}
    ),
    Stage.interview: frozenset(
        {
            Stage.offer,
            Stage.screening,  # backward, TRK-021 (extra tech screen)
            Stage.won,  # skip-ahead (informal offer; flagged non-canonical)
            Stage.rejected,
            Stage.ghosted,
            Stage.withdrew,
        }
    ),
    Stage.offer: frozenset(
        {Stage.won, Stage.offer_rescinded, Stage.withdrew, Stage.ghosted}
    ),
    Stage.won: frozenset({Stage.offer_rescinded}),  # company pulls AFTER accept
    Stage.offer_rescinded: frozenset({Stage.won}),  # company reverses (rare)
    Stage.rejected: frozenset(),
    Stage.ghosted: frozenset(),
    Stage.withdrew: frozenset(),
    Stage.dismissed: frozenset(),
}
```

Notes (CONFIRMED from the module docstring and code): this matrix deliberately EXCLUDES the `won -> offer` undo edge (owned by `undoMarkWon`) and terminal -> prior-stage reactivation (owned by `reactivateApplication`); it only carries the pre-commit `saved|drafting -> dismissed` edges for dismiss, not the post-APPLIED dismiss-to-WITHDREW edge (owned by `dismissApplication`, D12).

Check order in `transition_application` (CONFIRMED, applications.py:276-302): (1) unknown id -> 404 `NotFoundError`; (2) `expectedVersion != app.version` -> 409 `ConflictError`; (3) `targetStage` not in `LEGAL_TRANSITIONS[app.stage]` -> 422 `InvalidTransitionError` (kind `invalid_transition`); (4) `targetStage == applied and resumeId is None` -> 422 `ValidationTaggedError` (kind `validation_error`). On success: if targeting `applied` with a `resumeId`, a `ResumeSnapshot` is built and stored at `store.resume_snapshots[app.id]` (keyed by APPLICATION id, not a new snapshot id) and `updates["submittedSnapshotId"]`/`updates["resumeId"]` are set on the Application. Every transition appends a `StageTransition` to `store.transition_logs[app.id]` and a `TimelineEvent` to `store.timelines[app.id]`; version is bumped by 1.

### Exact Stage enum (schemas.py:74-91, 12 wire values, lowercase/snake_case)

`saved, drafting, applied, screening, interview, offer, won, rejected, ghosted, withdrew, dismissed, offer_rescinded`.

Frontend note (CONFIRMED, frontend/src/data/wire.ts:203-257): the app-facing `Stage` type is a COARSER 8-value bucket (`saved, draft, applied, screen, interview, offer, rejected, closed`) -- `won/ghosted/withdrew/dismissed/offer_rescinded` all collapse to app-Stage `closed` on the wire-to-app map (`WIRE_TO_APP_STAGE`), and the app-to-wire map (`APP_TO_WIRE_STAGE`) has no entry for `closed` at all (falls through to a `?? "applied"` default in `stageAppToWire`). This 12-vs-8 mismatch already exists in the frontend and is out of scope to fix here, but the spec author should know the frontend never round-trips a `closed`-bucket stage back to a specific wire value through this helper.

### Error envelopes raised (CONFIRMED, backend/app/api/errors.py)

`ApiError` subclasses, each with a fixed `kind -> HTTP status` (errors.py:30-40): `NotFoundError` (404), `UnauthorizedError` (401), `ValidationTaggedError` (422, `validation_error`), `ConflictError` (409, `conflict`), `CapReachedError` (402), `UndoWindowExpiredError` (409, `undo_window_expired`), `InvalidTransitionError` (422, `invalid_transition`), `RateLimitedError` (429), `ProviderUnavailableError` (503). All routes raise these directly (never `HTTPException`); `register_error_handlers` (errors.py:151-163) also normalizes FastAPI's own `RequestValidationError` and `StarletteHTTPException` into the same `{kind, path, message}` envelope.

### markWon / undoMarkWon (D18)

CONFIRMED, applications.py:77, 407-466. `UNDO_WINDOW_SECONDS = 300` is a hardcoded module constant (matches the Goal block's DEBT-3 claim -- not sourced from `Settings`/`.env`, which conflicts with the "every tunable goes through Settings" house rule noted in MEMORY.md's config-values-in-settings entry).

`markWon`: builds a `won` copy of the Application (`stage=won`, `outcome=Outcome.won`, `outcomeAt=now`, `outcomeReason=body.whatWorked`), deletes it from `store.applications`, inserts into `store.archive`, mints a random `uuid4()` token, and stores `store.undo_grants[token] = UndoGrant(application=<ORIGINAL pre-win app>, expires_at=now+300s)`. Note: the grant stores the ORIGINAL (pre-mutation) application object, not the won one -- `undoMarkWon` restores that exact original.

`undoMarkWon`: looks up the token in `store.undo_grants`; 404 (`NotFoundError`) if the token is unknown or its stored `application.id != id`; 409 `undo_window_expired` (`UndoWindowExpiredError`) if `store.now() > grant.expires_at` (also deletes the grant on expiry). On success: pops the app out of `store.archive`, reinserts the ORIGINAL application object into `store.applications`, deletes the grant.

`UndoGrant` is a plain `@dataclass` (store.py:2778-2784), in-memory only, keyed by a random token in a module dict (`store.undo_grants`). CONFIRMED: there is no `undo_grant` DB table -- `backend/app/models.py` defines exactly two `table=True` SQLModel classes today, `Job` (models.py:75) and `ShortlistEntry` (models.py:206). No `Application`, `StageTransition`, `Resume`, `ResumeSnapshot`, or `UndoGrant` DB models exist yet. This confirms the Goal block's claim that undo-grant persistence is mock-only.

### dismiss / reactivate (D12, D19)

`dismissApplication` (applications.py:509-542, dual-mode): if `app.stage in (saved, drafting)` -> hard delete from `store.applications`, returns `DismissResult(outcome=Outcome1.removed)` -- no archive entry, no timeline event. Otherwise (post-APPLIED) -> maps to `stage=withdrew`, `outcome=Outcome.withdrawn`, `outcomeReasons=body.reasons`, `outcomeReason=reasons[0] if reasons else None`, moves applications -> archive, returns `DismissResult(outcome=Outcome1.withdrew)`. `Outcome1` enum (schemas.py:258-264): `removed | withdrew` (distinct from the `Outcome` enum used elsewhere: `won | rejected | withdrawn`).

`reactivateApplication` (474-501): archive-only op, 404 if id not in `store.archive`. Clears `outcome`/`outcomeAt`/`outcomeReason`/`outcomeReasons`, sets `stage=applied`, `resurrected=True`, bumps `version`. Moves archive -> applications.

### Archive reads (backend/app/api/routes/archive.py, adjacent but not in the applications router)

`getArchive` (GET `/archive?kind=won|passed`, archive.py:22-38) and `getArchiveCounts` (GET `/archive/counts`, 41-49) both read `store.archive` directly, bucketed by `Outcome` (`won` -> `Outcome.won`; anything else, including `passed`, -> `{rejected, withdrawn}`). Also no tenant scoping (mock-only, module-level dict).

## 2. Resume routes

Two routers: `resume_lifecycle.py` (uploads/career-history/templates/exports/projections) and `resumes.py` (resume CRUD + lifecycle actions). Both `dependencies=[Depends(get_current_user)]`, no tenant scoping, all state in `app.store`.

Registration order constraint (CONFIRMED, backend/app/api/main.py:37-42): `resume_lifecycle.router` MUST be included before `resumes.router`. Comment: `resume_lifecycle`'s static paths (`/resumes/uploads`, `/resumes/templates`, `/resumes/exports`) would otherwise be shadowed by `resumes`' dynamic `GET /resumes/{id}` -- Starlette matches route registration order, not specificity, and would try to parse "uploads" etc. as a UUID path param. `applications.router` is included after `resumes`/`shortlist`/`jobs`/etc.; the module comment (main.py:49-51) says applications' own sub-paths don't shadow each other so its position among those three routers is free.

### resume_lifecycle.py ops (method/path/operationId/response_model)

- `getResumeUploads` -- GET `/resumes/uploads` -- `list[ResumeUpload]` (72-79)
- `getCareerHistory` -- GET `/career-history` -- `list[CareerHistoryItem]`, sorted by `ordinal` (82-89)
- `getResumeTemplates` -- GET `/resumes/templates` -- `list[ResumeTemplate]` (92-99)
- `getResumeExports` -- GET `/resumes/exports` -- `list[ResumeExport]` (102-109)
- `getProjections` -- GET `/projections` -- `list[Resume]`, filters `store.resumes` to `tag != ResumeTag.FORMAT` (112-115)
- `createProjection` -- POST `/projections` -- `Resume`, 201 (118-154). Body hand-authored (`CreateProjectionInput`: name, targetRole, itemIds, templateId, sourceUploadId -- inline object in contract, no `$ref`). Pins `itemIds` at creation time into `store.resume_projection_items[id]`; never recomputed from live career-history state.
- `assignTemplate` -- PUT `/projections/{id}/template` -- `Resume` (157-169). Body: `{templateId: UUID}`.
- `renderExport` -- POST `/exports` -- `ResumeExport`, 201 (172-194). Body: `{projectionId: UUID}`.
- `regenerateExport` -- POST `/exports/{id}/regenerate` -- `ResumeExport`, 201 (197-220). Creates a NEW export row (bumped `templateVersion` via `_bump_template_version`, regex `^v(\d+)$` -> `v{n+1}`, falls back to `"v2"` on non-matching strings); the original export is untouched.

### resumes.py ops

- `getResumes` -- GET `/resumes` -- `list[Resume]` (49-52)
- `createResume` -- POST `/resumes` -- `Resume`, 201 (55-75). No body; fixed blank defaults, `tag=ResumeTag.DRAFT`.
- `getResume` -- GET `/resumes/{id}` -- `Resume` (78-88). Id-only resolution (mock also resolved by name/index; dropped here per contract).
- `patchResume` -- PATCH `/resumes/{id}` -- `Resume` (91-104). Body: `{name?, body?, scoringEnabled?}` (hand-authored `PatchResumeBody`, collapses 3 mock mutations), `exclude_unset` merge.
- `deleteResume` -- DELETE `/resumes/{id}` -- 204 (107-119). 409 `conflict` if `tag in LOCKED_TAGS` (`TAILORED, MASTER, DEFAULT`, resumes.py:27) or `usedIn > 0`.
- `duplicateResume` -- POST `/resumes/{id}/duplicate` -- `Resume`, 201 (122-143). Copies with new id, `" (copy)"` suffix, `tag=DRAFT`, `usedIn=0`.
- `setDefaultResume` -- POST `/resumes/{id}/set-default` -- `list[Resume]` (146-165). Demotes the current DEFAULT to VARIANT, promotes the target to DEFAULT, returns the whole collection. `updated` is left untouched on both (mirrors mock).
- `forkResumeAsDraft` -- POST `/resumes/{id}/fork` -- `Resume`, 201 (168-198). Body: `{jobId: UUID}` (hand-authored `ForkResumeInput`). Copies the basis resume, `tag=DRAFT`, `usedIn=0` reset. `jobId` has no field on the `Resume` wire shape -- it is recorded in a private `store.resume_fork_jobs[fork.id] = jobId` provenance side-store rather than silently dropped.

### "Resume locked" in the mock

CONFIRMED: there is no explicit boolean "locked" field on `Resume`. Lock behavior is IMPLICIT, enforced only at delete time via `LOCKED_TAGS = frozenset({TAILORED, MASTER, DEFAULT})` (resumes.py:27) combined with `usedIn > 0` -- `deleteResume` 409s if either holds. Every other resume route (patch, duplicate, fork, set-default, assign-template) is unguarded by tag/usedIn today. Separately, the immutable `ResumeSnapshot` captured at APPLIED (D10, see section 1) is a DIFFERENT locking concept: once an application transitions to `applied`, the SNAPSHOT is frozen (never mutated by later resume edits), but the underlying `Resume` row itself remains editable -- only the snapshot copy is immutable.

## 3. Wire schemas (backend/app/schemas.py) and store fixtures (backend/app/store.py)

### Application (schemas.py:181-229)

Fields: `id: UUID`, `jobId: UUID` (FK->Job), `resumeId: UUID | None`, `stage: Stage`, `version: int`, `createdAt: AwareDatetime`, `flag: ApplicationFlag | None`, `contact: str | None`, `coachNudge: bool | None`, `resurrected: bool | None`, `outcome: Outcome | None`, `outcomeAt: AwareDatetime | None`, `outcomeReason: str | None`, `outcomeReasons: list[str] | None` (max_length=8), `systemReasons: list[str] | None`, `submittedSnapshotId: str | None` (note: `str`, not `UUID`), `searchId: UUID | None`. Required (no default): `id, jobId, resumeId, stage, version, createdAt`. Everything else optional/defaulted None.

### ApplicationView (schemas.py:1200-1217, extends Application)

Adds: `job: Job` (required), `resume: Resume | None` (required, nullable), `company: str`, `role: str`, `location: str`, `salary: SalaryPoint | SalaryRange | None`, `match: int`, `source: str`, `resumeName: str`. Built by `store.application_view()` (store.py:3562-3581): joins `app.jobId` against `store.jobs` then `store.application_jobs` (derived-job fallback), flattens job/resume display fields; raises `KeyError` (uncaught -> 500) if no job resolves, documented as "every application owns a resolvable job".

### StageTransition (schemas.py:105-128)

`id: UUID`, `applicationId: UUID`, `fromStage: Stage | None` (null for initial), `toStage: Stage`, `source: TransitionSource`, `reason: str | None`, `reasons: list[str] | None` (max 8), `resumeId: UUID | None` (snapshotted at APPLIED), `createdAt: AwareDatetime`. `TransitionSource` enum (94-102): `user, user_correction, user_reactivation, system`.

### TimelineEvent (schemas.py:284-292)

`id: UUID`, `time: AwareDatetime`, `who: str`, `message: str`, `actor: Actor | None`. `Actor` enum (274-281): `you, coach-on-behalf (coach_on_behalf), agent`.

### Resume (schemas.py:650-680)

`id: UUID`, `name: str`, `subtitle: str`, `version: str` (a display string like "v1", NOT an int -- distinct from `Application.version`), `usedIn: int`, `updated: AwareDatetime`, `tag: ResumeTag`, `match: int | None`, `body: str | None`, `sourceUploadId: UUID | None`, `templateId: UUID | None`, `targetRole: str | None`, `scoringEnabled: bool | None`.

### ResumeSnapshot (schemas.py:323-333, truncated read but structure confirmed from usage)

`id: UUID`, `applicationId: UUID`, `resumeId: UUID`, `name: str`, `body: str`, `templateVersion: str`, `capturedAt: AwareDatetime` (field seen used at applications.py:317-323/389-398 though the last field wasn't in the read window -- INFERRED from all call sites passing `capturedAt=...`).

### TransitionInput / TransitionResult / MarkWonInput / MarkWonResult / DismissResult

`TransitionInput` (131-143): `targetStage: Stage`, `expectedVersion: int`, `source: TransitionSource | None = user`, `reason: str | None`, `reasons: list[str] | None` (max 8), `resumeId: UUID | None`. `TransitionResult` (1267-1269): `application: ApplicationView`, `transition: StageTransition`. `MarkWonInput` (249-256): `startDate`, `negotiatedComp: SalaryPoint|SalaryRange|None`, `whatWorked: str | None` -- all optional, body itself is `MarkWonInput | None` at the route (applications.py:412). `MarkWonResult` (1220-1227): `application: ApplicationView`, `undoToken: UUID`, `undoExpiresAt: AwareDatetime`, `undoWindowSeconds: int`. `DismissResult` (267-271): `outcome: Outcome1`.

### Store fixtures

`store.applications` / `store.archive` / `store.application_jobs`: built once at import time by `_seed_application_state()` (store.py:3352-3367) from `_ACTIVE_SEEDS` / `_ARCHIVE_SEEDS` pools (not read in full -- INFERRED these are module-level seed-data lists elsewhere in store.py; not located/quoted here, out of budget). `APP_UUID_BY_SLUG` (3372-3380) maps 7 fixture slugs (stripe, linear, vercel, supabase, planetscale, sentry, be-column) to fixed UUIDs, used to cross-reference the ported timeline/interview fixtures onto those application ids.

`store.transition_logs: dict[UUID, list[StageTransition]] = {}` (3555) -- starts EMPTY; only populated by live `transitionApplication` calls (no seeded history).

`store.timelines: dict[UUID, list[TimelineEvent]]` (3556) -- seeded via `_seed_timelines()` (3439-3454+) from a hand-ported `_TIMELINE_FIXTURES` dict (3402-3436) keyed by the same 7 slugs, with synthetic monotonic timestamps (`iso_ago` offsets) since the original mock fixture only carried relative-ish date strings ("Jan 22" etc.) with no fixed anchor.

`store.undo_grants: dict[UUID, UndoGrant] = {}` (3558) -- starts EMPTY, in-memory only, never seeded, never persisted.

`store.resume_snapshots: dict[UUID, ResumeSnapshot] = {}` (3559) -- starts EMPTY; keyed by APPLICATION id (not by snapshot id); only populated by a live `-> applied` transition.

`store.resumes: dict[UUID, Resume] = _seed_resumes()` (574) -- seeded (function body not read in full; not required for this pass beyond confirming it exists and is a dict[UUID, Resume]).

`store.resume_uploads`, `store.resume_templates`, `store.resume_exports` (575-578): also seeded via their own `_seed_*` functions (not fully read).

`store.resume_projection_items: dict[UUID, list[UUID]] = {}` (588) and `store.resume_fork_jobs: dict[UUID, UUID] = {}` (592): both start EMPTY, private provenance side-stores, not part of any wire schema.

`store.reset()` (store.py:1626, body not fully read) is CONFIRMED to exist and to be the reset hook contract tests call between tests; INFERRED (not directly verified in this pass, but consistent with call sites seen at 1638/1706/1715/1718) that it re-seeds `resumes`, applications/archive/application_jobs, timelines, and clears `undo_grants` (and by extension should be assumed to clear `resume_snapshots`, `resume_projection_items`, `resume_fork_jobs`, and `transition_logs` too -- NOT individually confirmed for every dict in this pass; flag as UNKNOWN whether `reset()` clears every one of them exhaustively).

## 4. Frontend consumers (frontend/src/data/api.ts, wire.ts, hooks/, screens/)

`data/api.ts` calls essentially every applications/resume op described above (CONFIRMED via grep, line numbers approximate to the read window): `getApplications` (483-488), `getApplication` (490-491), `getArchive`-equivalent read at 493-498 (calls `/archive`), `createApplication` (505-542, resolves a resume name/index to a UUID client-side via `resolveResumeId` before posting), `getResumeSnapshot` (545-548), a mark-won wrapper (559-583ish), `undoMarkWon`-shaped call (591-596), `reactivateApplication` (599-604), `dismissApplication` (611-615ish), `transitionApplication` (666-712, converts app-Stage to wire-Stage via `stageAppToWire`), `getApplicationTimeline` (721-724), interview-round reads (731,747). Resume side: `getResumes` (875-877), `patchResumeScoring` via PATCH (880-884), `getResume` (887-889, resolves name/index client-side), `createResume` (892-893), and (not individually grepped further but present per hooks below) duplicate/fork/set-default/projection/export ops.

Hooks that wrap these (CONFIRMED via file listing): `hooks/use-applications.ts`, `hooks/use-application-lifecycle.ts`, `hooks/use-application-timeline.ts`, `hooks/use-apply-to-job.ts`, `hooks/use-create-application.ts`, `hooks/use-resumes.ts`, `hooks/use-resume-mutations.ts`, `hooks/use-resume-snapshot.ts`. Consuming screens include `screens/add-app/`, `screens/match-explorer/`, `screens/resume-editor/`, `screens/resume-preview/`, `screens/mark-won/`. This confirms the UI has REAL, wired consumers for this entire surface today (all against the mock backend) -- sprint-04 is a backend swap-out, not new UI work.

Stage-enum mismatch (CONFIRMED, wire.ts:203-257, already flagged in section 1): the frontend's app-facing `Stage` type is 8 values, coarser than the wire's 12-value `Stage` enum; several wire stages collapse to the app's `closed` bucket on read, and the app-to-wire map has no `closed` entry (defaults to `applied` if ever called with `closed`, which the comment says should never happen on a real forward transition). Sprint-04's DB layer must keep serving the full 12-value wire enum verbatim; this collapse is a frontend-only concern, not a backend contract change.

### e2e/core-journey.spec.ts

CONFIRMED (frontend/e2e/core-journey.spec.ts, 123 lines, single `test(...)` block at line 36): the journey is login -> create job (via `/applications/new` -> POST `/applications`, asserts 201 and `company` field) -> list/persist -> shortlist the created job (POST `/shortlist`, asserts 201 and `jobId` matches) -> assert the shortlist lists it (GET `/shortlist`). The spec ENDS at the shortlist assertion (line 122); it does NOT exercise any application-lifecycle transition, resume, or snapshot endpoint. Confirms the Goal block's claim that e2e coverage currently stops at shortlist.

## 5. Contract manifest (docs/operation-ownership.yaml)

File header (1-29) confirms: every one of 89 `mvp-api.yaml` operationIds appears exactly once; `status` is one of `planned | implemented | deferred`; `backend/tests/test_operation_manifest.py` is the CI check for completeness (every operationId present exactly once, no orphans) and schema shape.

All applications/resume/snapshot operationIds are currently `status: planned` (i.e. still mock-only, not yet DB-backed) as of this read:

- Applications (lines ~115-176): `getApplications` (115), `createApplication` (122), `getApplication` (129), `transitionApplication` (136, tests include `transition-matrix`), `getApplicationTimeline` (143), `dismissApplication` (150), `markWon` (157), `undoMarkWon` (164, tests include `undo-window-expired`), `reactivateApplication` (171). All `slice: 2`, all `planned`.
- Resumes/resume-lifecycle (lines ~207-338): `getResumes` (207), `createResume` (214), `getResume` (221), `patchResume` (228), `deleteResume` (235, tests include `resume-lock-conflict`), `duplicateResume` (242), `setDefaultResume` (249), `forkResumeAsDraft` (256), `getResumeUploads` (263), `getCareerHistory` (270), `getResumeTemplates` (277), `getResumeExports` (284), `getProjections` (291), `createProjection` (298), `assignTemplate` (305), `renderExport` (312), `regenerateExport` (319), `getResumeSnapshot` (326, tests include `snapshot-conflict`), `getMatchReport` (333). All `slice: 3`, all `planned`.

By contrast, `dismissFromShortlist` (line ~110) is already `status: implemented` with the comment "sprint-03: DB-backed; cross-tenant/unknown -> 404" -- confirms the manifest IS kept current as verticals ship, so sprint-04 will need to flip each op above from `planned` to `implemented` as it lands.

## 6. Append-only machinery (migration 075675058c67)

File: `backend/app/alembic/versions/075675058c67_runtime_role_and_append_only_machinery.py` (100 lines). Revises `3bae06a61157`.

Creates (verbatim behavior, quoted from the migration):

- `app_runtime` role: `CREATE ROLE app_runtime NOLOGIN` (guarded by an `IF NOT EXISTS` check against `pg_roles`, idempotent across scratch-DB reruns). Granted `USAGE` on schema `public`, `SELECT, INSERT, UPDATE, DELETE` on all current tables, `USAGE` on all sequences, plus `ALTER DEFAULT PRIVILEGES` so FUTURE tables/sequences created in `public` automatically grant the same to `app_runtime`. `REVOKE ALL ON alembic_version FROM app_runtime` -- the runtime role can never touch migration history.
- `raise_append_only()` trigger function: `RAISE EXCEPTION 'append-only table %: % is not permitted', TG_TABLE_NAME, TG_OP;` -- fires regardless of role (defense in depth, catches owner/superuser paths).
- `enforce_append_only(target regclass)` function: one call per append-only table. It (a) `REVOKE UPDATE, DELETE, TRUNCATE ON <target> FROM app_runtime` (primary protection, privilege-based), (b) creates a `BEFORE UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION raise_append_only()` trigger named `append_only_guard`, (c) creates a `BEFORE TRUNCATE ... EXECUTE FUNCTION raise_append_only()` statement trigger named `append_only_truncate_guard`.
- Docstring names the intended sprint-04 consumers explicitly: "sprint-04: stage_transition, resume_snapshot" -- i.e. this migration ALREADY anticipates sprint-04 will call `SELECT enforce_append_only('stage_transition')` and `SELECT enforce_append_only('resume_snapshot')` from its own table-creation migrations, the same way sprint-03's shortlist migration did NOT need to (shortlist is mutable/deletable, not append-only).
- `downgrade()` unconditionally raises `RuntimeError("forward-fix only: ...")` -- this project has a hard forward-fix-only migration policy (v3 plan), verified behaviorally by `test_downgrade_refused_forward_fix_only` in the gates test.

### backend/tests/migrations/test_migration_gates.py (151 lines) -- pattern

CONFIRMED tests present: `test_single_head` (exactly one alembic head), `test_empty_upgrade_reaches_single_head` (fresh scratch DB via real `alembic upgrade head` subprocess reaches that head), `test_runtime_role_exists_with_dml_but_no_alembic_version_access` (SET LOCAL ROLE app_runtime can INSERT into `user`, but `SELECT * FROM alembic_version` raises `DBAPIError` matching "permission denied"), an `append_only_probe` fixture that creates a throwaway `_ao_probe` table, grants the runtime role DML, calls `enforce_append_only('_ao_probe')`, seeds one row, and drops it after the test. Then: `test_append_only_insert_allowed_under_runtime_role` (INSERT still works under `app_runtime`), `test_append_only_mutations_refused_under_runtime_role` (parametrized UPDATE/DELETE/TRUNCATE all raise `DBAPIError` matching "permission denied" under `SET LOCAL ROLE app_runtime` -- the privilege-REVOKE layer), `test_append_only_trigger_blocks_even_the_owner` (same three statements, this time WITHOUT the role switch -- i.e. as the table owner -- still raise `DBAPIError` matching "append-only", proving the trigger layer). This is the exact test shape sprint-04's `stage_transition`/`resume_snapshot` tables should be exercised against once they call `enforce_append_only`.

## 7. Composite-FK child exemplar (shortlist_entry, migration 4317eb75f1cd)

File: `backend/app/alembic/versions/4317eb75f1cd_shortlist_entry_table_b2_first_.py` (115 lines). Revises `4c17ea8b5656` (the job table). Docstring explicitly calls this "the FIRST child table that composite-FKs a parent -- the exemplar sprint-04's children (stage_transition, resume_snapshot, match_report) copy."

Pattern copied from the job exemplar (tenancy + timestamptz + named JSONB CHECKs + `schema_version` + `UNIQUE(user_id, id)` anchor + `CASCADE` user FK). NET-NEW in this migration, specific to being a CHILD table:

- Composite FK: `sa.ForeignKeyConstraint(["user_id", "job_id"], ["job.user_id", "job.id"], name="fk_shortlist_job")` -- Postgres `MATCH SIMPLE` semantics mean this is enforced ONLY when `job_id` is non-null (a NULL `job_id` is a legal display-only entry, matching the optional wire `jobId`); when non-null, a cross-tenant `job_id` fails at the DB layer, not just the app layer.
- Partial dedup index: `CREATE UNIQUE INDEX uq_shortlist_user_job ON shortlist_entry (user_id, job_id) WHERE job_id IS NOT NULL` -- at most one shortlist entry per (user, job) for real jobs; NULL-job rows are never deduped.
- RLS: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + a `shortlist_tenant_isolation` policy identical in shape to the job table's: `USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid) WITH CHECK (...)`.
- Explicit callout: the composite FK, partial index, and RLS/policy are all raw `op.execute()`, NOT expressed in SQLModel model metadata -- documented as the "DEBT-6 autogenerate caveat" (autogenerate cannot express these, and in fact once proposed DROPPING the job table's unrelated `uq_job_user_source_url` index as a false-positive diff; that drop is intentionally not applied).
- `downgrade()` also unconditionally raises (forward-fix-only).

### backend/app/api/routes/shortlist.py (167 lines) + backend/app/shortlist_mapper.py (59 lines) -- the route/mapper pattern

`getShortlist` (60-85): default (no `searchId`) is DB-backed via `TenantSession`, queries `models.ShortlistEntry` filtered by `user_id == current_user.id`, ordered by `(saved, id)`; a RECOGNIZED `searchId` still falls back to a mock per-search projection (`store.SHORTLIST_BY_SEARCH`) since searches themselves stay mock through Release 0.1; an unrecognized `searchId` falls through to the DB default.

`addToShortlist` (88-141): pre-checks job ownership via a `SELECT ... WHERE Job.id == body.jobId AND Job.user_id == current_user.id` (app-level belt) before insert; on `IntegrityError` at commit, disambiguates by `_constraint_name(exc)` (reads `exc.orig.diag.constraint_name`, psycopg-specific) -- ONLY the `uq_shortlist_user_job` constraint name maps to a 409 `ConflictError`; any other integrity violation (e.g. the composite FK firing because the job was deleted between the ownership pre-check and the commit, a TOCTOU window) is re-raised rather than mislabeled a conflict. Comment explicitly says this disambiguation-by-constraint-name pattern is what sprint-04's children should inherit.

`dismissFromShortlist` (144-167): DELETE by id, filtered by `user_id`; unknown id and cross-tenant id are indistinguishable, both 404.

`shortlist_mapper.py`: `wire_shortlist_to_row` / `row_to_wire_shortlist`, funnels the row back through `schemas.ShortlistEntry.model_validate` as a "runtime drift guard" (any row shape the DB can hold that the wire schema can't express fails loudly). Notably: display fields (company/role/location/salary/match) are a CLIENT-SUPPLIED SNAPSHOT at save time, not derived from a live join to the job row -- same pinning pattern as `createProjection`'s `itemIds` snapshot in resume_lifecycle.py.

### get_tenant_session (backend/app/api/deps.py:63-93)

CONFIRMED: `get_tenant_session(session, current_user)` runs `SET LOCAL ROLE app_runtime` then `SELECT set_config('app.user_id', :uid, true)` on the request's DB connection (transaction-scoped `SET LOCAL`/`set_config(..., true)` -- both reset at commit). Docstring: "RLS is the systemic backstop; routes keep their explicit `user_id` predicates as the first line." Because `SET LOCAL` is transaction-scoped, tenant routes must commit ONCE at the end and never run tenant queries after that commit within the same request. Teardown does `RESET ROLE` wrapped in `contextlib.suppress(Exception)`, explicitly because in the test world the request shares one outer transaction with the test session (savepoint mode) and an already-aborted transaction would otherwise raise on `RESET ROLE`. `TenantSession = Annotated[Session, Depends(get_tenant_session)]` is the type alias routes import.

Note: this whole dependency chain currently fails to import because of the syntax error documented in section 0 (`get_current_user`, which `get_tenant_session` depends on, is defined in the same broken module).

## 8. DB job exemplar (migration 4c17ea8b5656) + jobs.py + job_mapper.py

File: `backend/app/alembic/versions/4c17ea8b5656_job_table_b1_exemplar_under_binding_.py` (106 lines). Revises `55770316f4ab`. Docstring: "the FIRST populated-schema tenant table -- the exemplar later sprints copy."

Conventions established here that sprint-04 should replicate for `stage_transition` / `resume_snapshot` (and any minimal resume table):

- `user_id` tenant column + `UNIQUE(user_id, id)` composite anchor (what shortlist's composite FK targets).
- `FORCE ROW LEVEL SECURITY` (not just `ENABLE`) with the `app.user_id` GUC policy pattern shown above -- comment notes superusers bypass RLS by definition, "documented, not pretended away."
- `timestamptz` everywhere (`sa.DateTime(timezone=True)`), named JSONB CHECK constraints (each wrapped in `(...) IS TRUE` because plain CHECK treats NULL as satisfied -- e.g. `ck_job_employment_shape`, `ck_job_location_shape`, `ck_job_source_shape`, `ck_job_compensation_shape`, `ck_job_requirements_array`, `ck_job_tags_array`, `ck_job_work_mode`, `ck_job_match_shape`, `ck_job_schema_version`), explicit `schema_version` column (`server_default='1'`).
- Partial-unique dedup index reserved for the capture flow: `uq_job_user_source_url ON job (user_id, source_url) WHERE source_url IS NOT NULL` (parallel structure to shortlist's `uq_shortlist_user_job`).
- `downgrade()` raises (forward-fix-only).

`jobs.py` (79 lines): `getJobs` and `getJob` are DB-backed via `TenantSession`, both filter by `user_id`; `getJob`'s unknown-id and cross-tenant-id paths both fall through to the same `NotFoundError` (tenant-indistinguishable 404, the pattern repeated everywhere in this sprint's DB verticals). `getJobsInbox` stays MOCK-served on purpose (PIN-2 -- it's a search-feed projection keyed by mock search ids, and searches stay mock through Release 0.1).

`job_mapper.py` (81 lines): `wire_job_to_row(job, *, user_id)` / `row_to_wire_job(row)`. Two deliberate wire/row asymmetries documented: (1) `source.url` is ADDITIONALLY normalized into a dedicated `source_url` column (needed by the partial-unique index) even though the JSONB `source` document also keeps the url, wire-verbatim; (2) the row stamps `user_id` and `schema_version`, neither of which exists on the wire. JSONB documents are stored in wire shape (camelCase, `mode="json"`) specifically so the named CHECK constraints and any drift test see the same bytes the API serves. `row_to_wire_job` funnels through `schemas.Job.model_validate` as the same "fails loudly on drift" pattern used by the shortlist mapper.

## 9. UNKNOWNs and risks

- CONFIRMED CRITICAL: `backend/app/api/deps.py:51` has a Python-2-style multi-exception `except` clause that is a hard `SyntaxError` under Python 3 (verified via `ast.parse`). This breaks import of `app.api.deps`, and therefore blocks `get_current_user`, `CurrentUser`, `get_tenant_session`, and `TenantSession` -- i.e. the entire backend app. See section 0. This is almost certainly the single highest-priority item for whoever picks up sprint-04, ahead of any schema/route work.
- CONFIRMED: the `undo_grant` "table" does not exist in `backend/app/models.py` (only `Job` and `ShortlistEntry` are `table=True` today) and is not referenced by any alembic migration found (only 075675058c67, 4317eb75f1cd, 4c17ea8b5656 were inspected plus a head-count check was not separately run for other migrations touching undo/grant -- UNKNOWN whether any OTHER not-yet-inspected migration touches it, but nothing in the three sprint-04-relevant migrations creates it). This matches the Goal block's claim: undo-grant persistence is mock-only (`store.undo_grants`, a plain dict of a `@dataclass`).
- UNKNOWN: what "APPLIED stage requires" beyond `resumeId` is not fully enumerated by this pass. CONFIRMED requirements are: `resumeId is not None` (422 `validation_error` otherwise) and a legal transition per `LEGAL_TRANSITIONS` (only `drafting -> applied` is a legal FORWARD entry into `applied`; the matrix also implicitly allows re-entry via `reactivateApplication`, which sets `stage=applied` directly, bypassing `LEGAL_TRANSITIONS` entirely since it's a different endpoint). Whether sprint-04's DB implementation needs additional invariants (e.g. a job must exist, a resume must belong to the same user) is NOT specified anywhere read in this pass -- UNKNOWN, needs a Goal-block or spec-author ruling.
- UNKNOWN: `store.reset()` (store.py:1626) was not read in full; confirmed it resets `resumes`, application state, and timelines (from call-site greps at lines 1638/1706/1715/1718) and explicitly clears `undo_grants` (1718), but whether it also clears `resume_snapshots`, `resume_projection_items`, `resume_fork_jobs`, and `transition_logs` was not directly verified. If sprint-04 adds DB-backed contract tests that assume a clean slate per test, this gap should be checked before writing test fixtures.
- UNKNOWN: `_ACTIVE_SEEDS` / `_ARCHIVE_SEEDS` (the actual seed data feeding `_seed_application_state()`) and `_seed_resumes()` were not read in full -- their exact seeded field values (which apps start at which stage, seeded resume tags/ids) are not captured in this report. If the spec author needs exact seeded fixture values (e.g. for writing DB-backed contract tests that must match current mock-seeded behavior), read store.py directly around those functions.
- INFERRED, not CONFIRMED: `ResumeSnapshot.capturedAt` field type/presence was inferred from call-site usage (`applications.py` passes `capturedAt=now` / `capturedAt=app.createdAt` at two call sites) rather than from directly reading schemas.py lines 323-350 in full (the read window cut off at line 333, mid-model). Spec author should re-read schemas.py:323-350 directly if the exact full field list of `ResumeSnapshot` matters (e.g. whether there are additional optional fields not surfaced by this report).
- CONFIRMED but worth flagging as a design question for the spec author: `createApplication` already writes a REAL `Job` row to the DB (via `wire_job_to_row` + commit) while leaving the `Application` itself in-memory only. This means sprint-04's `Application` DB table will need to join against an ALREADY-PERSISTED job most of the time (the sprint-02/03 job vertical), but the mock's `store.jobs`/`store.application_jobs` dual-write (one for DB, one for the mock's own joins in `application_view`) will need to be reconciled once `application_view`'s equivalent becomes DB-backed -- today `store.application_view()` reads from the in-memory `store.jobs`/`store.application_jobs`, not from the DB `Job` table at all.
