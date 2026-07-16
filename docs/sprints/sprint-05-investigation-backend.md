# Sprint-05 Investigation: Backend Match/Scoring Surface

Investigation for B4 "fake AI seam": ai_run + match_report tables, per-user budget/reservation cap, app/ai/ fake provider. Read-only pass over `backend/` on branch `sprint-05-fake-ai-seam`. Every claim below is CONFIRMED (read the code), INFERRED (deduced from adjacent evidence), or UNKNOWN (not resolvable by reading).

All file paths are relative to `backend/` unless stated otherwise.

## 1. Contract ops

### 1a. Direct match/scoring ops -- `app/api/routes/match.py`

CONFIRMED. Three ops, all `dependencies=[Depends(get_current_user)]`, tag `"match"`.

**`previewDeepMatchScore`** (match.py:64-92)
- `POST /jobs/{id}/preview-deep-score`, operation_id `previewDeepMatchScore`
- Request body: route-local `PreviewDeepScoreBody` (not in schemas.py -- inline in `mvp-api.yaml`, `datamodel-codegen` skips inline request bodies): `{ resumeIds: list[UUID] }`
- Response model `CostPreview` (schemas.py:527-535): `{ items: list[CostPreviewItem], totalUsd: float, capRemainingUsd: float, overCap: bool }`
- `CostPreviewItem` (schemas.py:518-524): `{ resumeId: UUID, model: str, estCostUsd: float }`
- Errors: 404 `not_found` if `id` not in `store.jobs` (path job id, `jobId` is NOT itself a wire field on this op -- it's the path segment)
- **NON-AI**: pure arithmetic. `unit_cost = store.DEEP_MATCH_SCORE_COST_USD` per resumeId; `overCap = totalUsd > store.cap_remaining_usd()`. No provider call today, and the sprint-05 spec (GOAL.md line 25) requires this stay pure arithmetic post-migration -- no reservation, no ai_run row.
- Manifest (docs/operation-ownership.yaml:366-371): slice 3, `status: planned`, `ai: false`, tests required: `[contract-fidelity]`

**`runDeepMatchScore`** (match.py:95-150)
- `POST /jobs/{id}/deep-score`, operation_id `runDeepMatchScore`
- Request body: route-local `RunDeepScoreBody`: `{ resumeId: UUID }` -- note this is the NESTED id sprint-05 must protect (job id is the path `{id}`, resumeId is in the body; both need tenant ownership checks once DB-backed)
- Response model `DeepMatchResult` (schemas.py:542-550): `{ jobId: UUID, resumeId: UUID, score: int, kind: Kind2 (enum, only value "deep"), strengths: list[str], gaps: list[str], costUsd: float, aiRun: AiRunEnvelope }`
- Errors: 404 `not_found` (unknown job); 402 `cap_reached` via `CapReachedError` if `unit_cost > store.cap_remaining_usd()`, checked BEFORE any spend recorded (module docstring: "unit cost > remaining headroom -> 402 cap_reached ... checked BEFORE any spend is recorded")
- Today's mock behavior: synchronous, builds an `AiRunEnvelope` inline (provider="fake", model=`store.DEEP_MATCH_SCORE_MODEL`, status=succeeded, synthetic=True), bumps `store.month_spend_usd` by the flat unit cost -- NOT via any shared `app/ai/` seam (that module doesn't exist yet)
- Manifest (docs/operation-ownership.yaml:373-378): slice 3, `status: planned`, `ai: true` (one of only two ops marked `ai: true`, the other being `deriveAccomplishmentFromProject`), tests required: `[contract-fidelity, ownership-404, ai-envelope, provider-unavailable, cap-reached, rate-limited]` -- note `rate-limited` and `provider-unavailable` are REQUIRED test tags even though today's mock never raises them; the real `app/ai/` seam presumably needs to support these error kinds (`Kind.rate_limited` -> 429, `Kind.provider_unavailable` -> 503 both already defined in `app/api/errors.py` KIND_TO_STATUS)

**`getMatchReport`** (match.py:153-172)
- `GET /match-report?resumeId={uuid}&jobId={uuid}`, operation_id `getMatchReport`
- Query params: `resumeId: UUID`, `jobId: UUID` (both `Query(...)`, required, wire names verbatim per `# noqa: N803` comments)
- Response model `MatchReport` (schemas.py:509-515): `{ resumeId: UUID, jobId: UUID, score: int, rubric: list[MatchRubricRow], gaps: list[MatchGap], strengths: list[str] }`
  - `MatchRubricRow` (schemas.py:492-495): `{ label: str, score: int, note: str }`
  - `MatchGap` (schemas.py:504-506): `{ severity: Severity (enum: high/medium/low), text: str }`
- Errors: none today -- route docstring explicitly says resumeId/jobId are ECHOED, not validated against the resume/job stores ("out of this slice's scope"). This is a documented gap sprint-05 must close if match_report becomes DB-backed with real versions/current-pointer semantics (GOAL.md: "match_report immutable-version + current-pointer semantics (no ambiguous 'current')").
- Manifest (docs/operation-ownership.yaml:359-364): slice 3, `status: planned`, `ai: false` (NOT an AI op -- it's a read of a persisted report, matches the plan's "match_report" table being a persisted artifact of a prior `runDeepMatchScore`/scoring call, not itself invoking a model), tests required: `[contract-fidelity]`

### 1b. AI-adjacent ops that touch `ai_run`-shaped telemetry (per system prompt: "any other op that touches match reports, scores, or AI-run/usage data")

CONFIRMED. Two more ops build an ad-hoc `AiRunEnvelope` today, independently of match.py:

**`deriveAccomplishmentFromProject`** (library.py:186-227)
- `POST /accomplishments/derive-from-project`, response model `AccomplishmentDeriveResult` (schemas.py:1246-1253): `{ accomplishment: Accomplishment, aiRun: AiRunEnvelope }`
- Also `ai: true` in the manifest (the ONLY other AI op besides `runDeepMatchScore` per the ownership.yaml header comment at line 13-15)
- Builds its own `AiRunEnvelope` inline with `provider="fake"`, `model="fake-1"` (a DIFFERENT model string than match.py's `store.DEEP_MATCH_SCORE_MODEL = "gemini-1.5-pro"`) -- confirms there is currently NO shared fake-provider module; each route hand-rolls its own envelope. This is exactly what `app/ai/` is meant to unify.
- Manifest (docs/operation-ownership.yaml:381-386): slice 4, `status: planned`, tests: `[contract-fidelity, ownership-404, ai-envelope, provider-unavailable, rate-limited]`
- Out of sprint-05's stated scope (GOAL.md only names match/scoring + ai_run/match_report/budget) but shares the `AiRunEnvelope` wire shape -- worth flagging as a FUTURE consumer of whatever `app/ai/` seam ships, not something sprint-05 needs to migrate itself. INFERRED that sprint-05 should leave this route's ad-hoc envelope alone unless the spec says otherwise.

**`proposeCoachEdit`** (coach.py) -- `ai: true`, but `status: deferred` (docs/operation-ownership.yaml:607-613): "founder ruled 2026-07-04: deferred, DECISIONS-NEEDED.md #1", `tests: []`. Not implemented at all today (no route body reviewed beyond the manifest entry) -- CONFIRMED deferred, out of scope.

### 1c. Usage/aggregate/analytics ops that would read ai_run rows

CONFIRMED. **`getUsageAggregate`** (settings.py:27-31)
- `GET /usage-aggregate`, response model `UsageAggregate` (schemas.py:1184-1192): `{ monthSpendUsd: float, monthlyCapUsd: float, tokensIn: int, tokensOut: int, avgPerSessionUsd: float }`
- Currently a singleton read of `store.usage_aggregate` (seeded once by `_seed_usage_aggregate()`, store.py:1039), completely disconnected from `store.month_spend_usd`/`cap_remaining_usd()` (the two live independently today -- `runDeepMatchScore` bumps `month_spend_usd` but never touches `usage_aggregate`). INFERRED: once ai_run/budget are real DB tables, `getUsageAggregate` is the natural candidate to aggregate real `ai_run` rows and the persisted budget row instead of a static fixture, but nothing in GOAL.md's Done-when criteria names this op, so this is a FUTURE-sprint concern, not S05 scope, unless spec time decides otherwise.
- Manifest (docs/operation-ownership.yaml:417-422): slice 5, `status: planned`, `ai: false`, tests: `[contract-fidelity]`

**`getSettings`** (settings.py:20-24) -- returns `store.settings` (a `Settings` wire model, NOT to be confused with `app/core/config.py`'s `Settings`), no AI/budget fields observed in its schema beyond what a grep would need to confirm; not investigated further as no evidence ties it to ai_run. UNKNOWN whether the wire `Settings` schema has a routing-model field that should get wired to `AI_PROVIDER` -- worth a spec-time grep of `class Settings` in schemas.py if the seam needs to expose provider choice to the UI.

No other routes reference `AiRunEnvelope`, `month_spend_usd`, `cap_remaining_usd`, or `MONTHLY_CAP_USD` (CONFIRMED via grep across `app/`).

## 2. Store fixtures -- `app/store.py`

CONFIRMED, all in `app/store.py`.

- **`jobs: dict[UUID, Job]`** (store.py:2050, via `_seed_jobs()`) -- each `Job` optionally carries `match: JobMatch | None` (schemas.py:456-463: `{ score: int, strengths: list[str], gaps: list[str], kind: Kind1 | None }`, `kind` distinguishes rough (free heuristic) vs deep (paid) per D8). `runDeepMatchScore` reads `job.match.score/.strengths/.gaps` as a baseline and returns `min(99, base_score + 3)` if present, else falls back to a hardcoded score of 80 with a canned strength/gap. This is the ONLY "derived" computation in the mock match layer -- deterministic, no randomness.
- **`MATCH_REPORT_SCORE = 92`**, **`MATCH_REPORT_RUBRIC`** (4 `MatchRubricRow` fixtures), **`MATCH_REPORT_GAPS`** (3 `MatchGap` fixtures, one per Severity), **`MATCH_REPORT_STRENGTHS`** (4 strings) -- store.py:2641-2705. ONE canonical fixture, ignoring the `resumeId`/`jobId` query params entirely (echoed onto the response, not looked up). No per-(resume,job) variation exists today.
- **Deep-match-score budget block** (store.py:2707-2718), all MODULE-LEVEL CONSTANTS, not in `Settings`:
  ```python
  DEEP_MATCH_SCORE_COST_USD = 0.14
  DEEP_MATCH_SCORE_MODEL = "gemini-1.5-pro"
  MONTHLY_CAP_USD = 20.00
  _INITIAL_MONTH_SPEND_USD = 3.42

  month_spend_usd: float = _INITIAL_MONTH_SPEND_USD  # mutated in place

  def cap_remaining_usd() -> float:
      return round(max(0.0, MONTHLY_CAP_USD - month_spend_usd), 2)
  ```
  `month_spend_usd` is reset to `_INITIAL_MONTH_SPEND_USD` in `reset()` (store.py:1723). It is a single GLOBAL spend counter, not per-user -- there is no per-user budget row in the mock at all. Sprint-05's "per-user budget row with a reservation cap" is entirely new; nothing to port from the mock except the flat-rate arithmetic shape (`cap_remaining_usd`) and the two constants (`DEEP_MATCH_SCORE_COST_USD`, `MONTHLY_CAP_USD`).
- **`_seed_usage_aggregate()`** (store.py:1039) seeds `usage_aggregate: UsageAggregate` (store.py:1061) -- a static fixture, independent of `month_spend_usd`.

## 3. Exemplars to copy (sprint-04)

### 3a. `resume_snapshot` append-only child shape -- migration `5f1fb22cd505` (`app/alembic/versions/5f1fb22cd505_applications_resume_snapshot_tables_b3_.py`)

CONFIRMED. Full DDL read. Key shape for `resume_snapshot` (lines 113-129):

```sql
CREATE TABLE resume_snapshot (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  application_id uuid NOT NULL,
  resume_id uuid NOT NULL,
  name varchar NOT NULL,
  body varchar NOT NULL,
  template_version varchar NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  schema_version integer NOT NULL DEFAULT 1,
  CHECK (schema_version >= 1),
  UNIQUE (user_id, application_id),   -- ONE snapshot per application (not general-purpose append-only!)
  UNIQUE (user_id, id)                -- composite-FK anchor
)
```

Composite FKs added AFTER all tables exist (lines 210-217):
```sql
ALTER TABLE resume_snapshot ADD CONSTRAINT fk_resume_snapshot_application
  FOREIGN KEY (user_id, application_id) REFERENCES application (user_id, id);
ALTER TABLE resume_snapshot ADD CONSTRAINT fk_resume_snapshot_resume
  FOREIGN KEY (user_id, resume_id) REFERENCES resume (user_id, id);
```

RLS (lines 241-259, one loop over all 5 sprint-04 tables):
```sql
ALTER TABLE resume_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY resume_snapshot_tenant_isolation ON resume_snapshot
  FOR ALL
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
```

Append-only enforcement call (line 266): `SELECT enforce_append_only('resume_snapshot')` -- see 3b below for what that does.

Privilege narrowing (PIN-19, lines 268-279):
```sql
REVOKE INSERT ON resume_snapshot FROM app_runtime;  -- writes go ONLY through the stage-mutation function
```
`resume_snapshot` ends up SELECT-only for `app_runtime` -- it never gets a direct INSERT grant; the only writer is the SECURITY DEFINER `application_stage_transition` function (see 3c/4 below).

**IMPORTANT CAVEAT for ai_run/match_report**: `resume_snapshot` is NOT a general append-only log -- `UNIQUE(user_id, application_id)` means at most ONE snapshot per application ever (a "write-once, not append-many" shape). If `ai_run` is meant to have one row PER RUN (many rows per user, no such 1:1 constraint), the exemplar's uniqueness constraint should NOT be copied verbatim -- only the REVOKE+trigger append-only MACHINERY (3b) applies, not the 1-row-per-parent cardinality. This is a judgment call for spec time, flagged here as a real divergence, not a copy-paste trap.

### 3b. Append-only machinery -- migration `075675058c67` (`app/alembic/versions/075675058c67_runtime_role_and_append_only_machinery.py`)

CONFIRMED. Creates the `app_runtime` role (NOLOGIN, broad default DML grant) once, plus two reusable functions:

```sql
CREATE OR REPLACE FUNCTION raise_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'append-only table %: % is not permitted', TG_TABLE_NAME, TG_OP;
END $$;

CREATE OR REPLACE FUNCTION enforce_append_only(target regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM app_runtime', target);
    EXECUTE format('CREATE TRIGGER append_only_guard BEFORE UPDATE OR DELETE ON %s
                     FOR EACH ROW EXECUTE FUNCTION raise_append_only()', target);
    EXECUTE format('CREATE TRIGGER append_only_truncate_guard BEFORE TRUNCATE ON %s
                     EXECUTE FUNCTION raise_append_only()', target);
END $$;
```

This is a ONE-LINE call (`SELECT enforce_append_only('ai_run')`) any new append-only table can reuse directly -- no new migration machinery needed for ai_run's append-only enforcement itself. Primary protection is the REVOKE (app_runtime literally cannot UPDATE/DELETE/TRUNCATE); the triggers are defense-in-depth that also block the table OWNER (documented as NOT covering superuser/owner paths -- "Owner actions remain outside the guarantee, documented, not pretended away").

### 3c. Guarded/locked-row concurrency pattern -- migration `7a2c91d40e88` + `app/stage_flow.py` + `applications.py`'s `transitionApplication`

CONFIRMED. This is the "budget/locked-row pattern" GOAL.md line 24 references. The core shape, inside a SECURITY DEFINER plpgsql function (`application_stage_transition`, migration `7a2c91d40e88_stage_mutation_function_b3b.py`):

```sql
UPDATE application
SET stage = v_target, version = version + 1, ...
WHERE id = p_application_id
  AND user_id = v_tenant
  AND removed_at IS NULL
  AND (p_expected_version IS NULL OR version = p_expected_version)
  AND stage = ANY (p_allowed_from)
RETURNING old.stage, new.version INTO v_from_stage, v_new_version;

IF v_from_stage IS NULL THEN
    -- diagnose: not-found vs version-conflict vs invalid-transition, in that check order
    ...
END IF;
```

Zero matched rows aborts BEFORE any child write (history append, snapshot insert, etc. all happen AFTER this guarded UPDATE succeeds, in the SAME transaction). Concurrency proof: a racing connection BLOCKS on the row lock (real contention, demonstrated with `lock_timeout` in the two-connection SQL test, see section 5), and the loser -- retried after the winner commits -- gets a genuine version-mismatch error (EMP09), never silently double-applies.

**This is the direct analog for the reservation cap** (GOAL.md spec line: "a short transaction reserves a conservative max via `reserved += max WHERE spent + reserved + max <= cap` on a locked per-user budget row"). The shape to copy is: single `UPDATE budget SET reserved = reserved + :max WHERE user_id = :uid AND spent + reserved + :max <= cap RETURNING reserved` -- zero rows returned means cap would be exceeded, abort before calling the provider or inserting `ai_run`. Same "guarded versioned UPDATE, zero-rows-aborts" idiom as stage_transition, just keyed on a budget row instead of an application row.

Tenant identity inside the function comes from `current_setting('app.user_id', true)::uuid` (the GUC set by `get_tenant_session`), NEVER a function parameter -- SECURITY DEFINER bypasses RLS so the function must re-check tenancy explicitly. Same pattern would apply if ai_run reservation goes through a function.

Route-side driver pattern (`app/stage_flow.py`, `call_stage_transition`): maps typed PostgreSQL SQLSTATEs (custom 5-char codes like `EMP04`, `EMP09`, `EMP22`, `EMP4A`) onto `ApiError` subclasses, re-raises anything else untouched (PR-6: "never a catch-all"). If sprint-05 uses a mutation function for the reservation, this file is the copy-template for the Python-side error mapping.

`get_tenant_session` (app/api/deps.py:63-93) is the dependency every DB-backed route uses: `SET LOCAL ROLE app_runtime` + `set_config('app.user_id', ...)`, both transaction-scoped (die at commit). Routes must build their entire wire response BEFORE `session.commit()` (documented trap in resumes.py:22-27 and applications.py comments at lines ~432, ~569) -- a post-commit lazy-refresh runs outside the tenant role/GUC and silently returns zero rows under RLS.

## 4. Mutation-function question

CONFIRMED + INFERRED, with GOAL.md's own explicit steer.

Evidence FOR needing a mutation function: `resume_snapshot` writes do NOT go through a standalone mutation function of their own -- they are written as a side effect INSIDE `application_stage_transition` (the single stage-mutation function), specifically the `IF v_target = 'applied' ...` block (migration `7a2c91d40e88`, lines 167-192) which does a plain `INSERT INTO resume_snapshot (...) VALUES (...)` as one statement among several in the SAME transaction as the guarded UPDATE. `resume_snapshot` itself has NO dedicated mutation function; `app_runtime` has no direct INSERT grant on it either (REVOKE'd, PIN-19) -- the ONLY writer is the stage-transition function, acting under SECURITY DEFINER.

So the exemplar's actual lesson is: **plain INSERT is fine for a write-once child row, AS LONG AS it happens inside the same transaction as whatever guarded operation it's a consequence of.** The mutation function exists in sprint-04 because the PARENT operation (`application.stage`) needed the guarded versioned UPDATE (multiple legal-transition predicates, optimistic concurrency via `expectedVersion`, self-referential undo-grant claiming) -- the snapshot INSERT just rides along in that same function because it's causally triggered by one specific transition (reaching `applied`).

**For `ai_run`/`match_report`:** GOAL.md is explicit and reasoned about this already (line 19: "decide at spec time whether ai_run/match_report need a mutation function AT ALL (write-once tables likely need only INSERT + the resume_snapshot-style append-only shape) -- reflexively copying sprint-04's function pattern would be scope creep"; line 25 repeats the simplification-panel charter question verbatim). The one piece of sprint-05's design that DOES need guarded-UPDATE semantics is the RESERVATION step on the budget row (cap-never-exceeded under concurrency) -- that's the part analogous to `application.stage`'s guarded UPDATE and plausibly DOES want either a SECURITY DEFINER function or an equivalent single guarded UPDATE statement executed directly from the route (not necessarily wrapped in a plpgsql function -- a single parameterized `UPDATE budget SET reserved = reserved + :amt WHERE ... RETURNING ...` run directly from Python inside the tenant session could satisfy the same guarantee without a new function, IF `app_runtime` is granted UPDATE on the budget row's `reserved`/`spent` columns directly rather than having them locked down PIN-19-style).

Once the reservation succeeds, the `ai_run` INSERT (status=reserved) and later UPDATE-to-actual (converting reservation to spend) are plain writes; `match_report` INSERT is plain too. None of THOSE need a function -- only the reservation arithmetic has the "many concurrent writers touching one shared counter, must not overshoot" property that justified `application_stage_transition`'s existence.

**Recommendation surfaced for spec time (not a decision I'm authorized to make): a mutation function is NOT required for `ai_run`/`match_report` writes themselves; it MAY be justified for JUST the reservation step on the budget row, and even that could plausibly be a bare guarded UPDATE run inline from the route (no plpgsql wrapper) if `app_runtime` retains direct UPDATE on the budget table -- unlike `application`, where UPDATE was revoked from app_runtime entirely (PIN-19) forcing everything through a SECURITY DEFINER function.** UNKNOWN whether the spec will want `ai_run`/budget UPDATE revoked from `app_runtime` the same way `application` was; if it does, a function becomes mandatory for the reservation step by the same logic as sprint-04. This is exactly the "resolve the exact enforcement shape... at spec time with D1" GOAL.md line 25 flags.

## 5. Test patterns

CONFIRMED, several files read in full or in relevant part.

### 5a. `tests/migrations/test_sprint04_tables.py`
Mirrors `test_shortlist_entry.py`. DB-free-of-ORM: raw SQL via `sqlalchemy.text`, asserting DB state under the runtime role directly, "never code shape" (file docstring). Uses `server_url`/`BACKEND_DIR` from `tests/migrations/conftest.py`. Constants at top: `TABLES = ("application", "stage_transition", "resume", "resume_snapshot", "undo_grant")`, `APPEND_ONLY = ("stage_transition", "resume_snapshot")`. Helper functions `_mk_user(conn, email)`, `_mk_job(conn, user_id)` insert raw rows via plain `INSERT` + `RETURNING`-free `text()` calls, no ORM. Multiple tests at lines 343, 496, 509, 521, 574, 594, 631, 644 do `conn.execute(text("SET LOCAL ROLE app_runtime"))` before asserting behavior (e.g. append-only triggers actually fire, REVOKEs actually block, RLS actually filters cross-tenant rows) -- this is the "app_runtime-role tests" pattern: connect as normal, `SET LOCAL ROLE app_runtime` + set the `app.user_id` GUC, THEN attempt the operation and assert it's blocked/allowed per spec.

### 5b. `tests/api/routes/test_resumes.py` -- intruder/tenancy tests
CONFIRMED via function name grep. Pattern: `test_intruder_sees_zero_victim_rows`, `test_get_resume_cross_tenant_404_indistinguishable`, `test_patch_resume_cross_tenant_404_indistinguishable`, `test_delete_resume_cross_tenant_404_indistinguishable`, `test_duplicate_resume_cross_tenant_404_indistinguishable`, `test_set_default_resume_cross_tenant_404_indistinguishable`, `test_fork_resume_as_draft_cross_tenant_resume_id_404_indistinguishable`, `test_fork_resume_as_draft_foreign_job_id_404_indistinguishable` (lines 289-403). One test PER MUTATING OP PER cross-tenant vector, named `test_<op>_cross_tenant_404_indistinguishable`, using the `intruder_client` fixture (from `conftest.py` per GOAL.md's Proven-patterns section) against a victim's resource -- always asserting the SAME 404 envelope a genuinely-unknown id would produce (indistinguishability, no enumeration). This naming/assertion convention is exactly what sprint-05's ownership-matrix sweep needs to replicate for `runDeepMatchScore`'s nested `resumeId` body field, plus any budget/ai_run id a future op might expose.

### 5c. Two-connection concurrency tests -- PR-7 (invalidate() / SET LOCAL)
CONFIRMED, two live exemplars:
- `tests/api/routes/test_shortlist.py:279` `test_two_connection_duplicate_add_one_winner` -- route-level race.
- `tests/api/routes/test_transitions.py:571` `test_two_connection_sql_level_row_lock_serializes` -- deterministic SQL-level proof (full text read, quoted above in section 3c's spirit): opens two raw `engine.connect()` connections, both `SET LOCAL ROLE app_runtime` + set the GUC on their OWN transaction, connection A calls the guarded function and leaves its transaction OPEN (holds the row lock), connection B sets a short `lock_timeout` and calls the SAME row -> raises `OperationalError` (blocked, not sequential -- proves real contention), A commits, B retries in a fresh transaction and gets the typed SQLSTATE error (`EMP09` here) because the row already moved. Every connection gets `.invalidate()`'d in a `finally` block before being returned to the pool -- **PR-9..PR-12 ratified convention (PR-7 specifically, sprint-03, re-ratified at sprint-04 S0 per GOAL.md's Proven-patterns list)**: "two-connection/concurrency tests using session-level SET ROLE MUST invalidate() their connections (or use SET LOCAL) -- a pooled connection left as app_runtime breaks later owner-role inserts under FORCE RLS." Sprint-05's reservation-cap concurrency test (GOAL.md Done-when: "a two-connection test where concurrent runs never exceed the cap") should copy `test_two_connection_sql_level_row_lock_serializes` almost verbatim, swapping the target function/table.

### 5d. Contract-drift / manifest guard
CONFIRMED. `tests/contract/test_contract_drift.py`: loads `mvp-api.yaml` directly (no DB, no app state beyond `app.openapi()`), asserts `len(contract_operation_ids) == 89` (`test_contract_has_89_operations`) and that every contract operationId is served by the live app (`test_app_serves_every_contract_op`, set-difference `missing = contract - actual`, asserts empty). `tests/test_operation_manifest.py` (repo root of `tests/`, standalone, not under `tests/contract/`) is presumably the "manifest vs contract" check per CLAUDE.md's mention ("tests/test_operation_manifest.py (manifest-vs-contract, standalone)") -- file exists, not read in full for this pass but its purpose (per repo CLAUDE.md and the ownership.yaml docstring) is asserting `docs/operation-ownership.yaml` stays 1:1 with the 89 contract ops. Sprint-05 flips `getMatchReport`/`previewDeepMatchScore`/`runDeepMatchScore`'s manifest `status:` from `planned` to `implemented` -- both this test and the drift guard should be re-run as part of S5/S7 gates.

## 6. Config -- `app/core/config.py`

CONFIRMED. `Settings` (pydantic-settings `BaseSettings`, reads root `../.env`) is where EVERY tunable lives per Wes's standing rule; the sprint-04 precedent is `UNDO_WINDOW_SECONDS: int = 300` (config.py:117), with the comment: "markWon's undo grace window, in seconds (mock default 300; sprint-04 spec PIN-4/DEBT-3, W-1 convention -- every tunable through Settings)." This is the exact exemplar to copy for sprint-05's tunables.

**Currently NOT in Settings, and NOT tunable via env** (all in `app/store.py` as bare module constants, confirmed section 2 above):
- `DEEP_MATCH_SCORE_COST_USD = 0.14`
- `DEEP_MATCH_SCORE_MODEL = "gemini-1.5-pro"`
- `MONTHLY_CAP_USD = 20.00`
- `_INITIAL_MONTH_SPEND_USD = 3.42`

There is currently NO `AI_PROVIDER` setting anywhere in `config.py` (grep confirms zero hits for `AI_PROVIDER`, `PROVIDER`, or anything AI-shaped in `Settings`). Sprint-05 needs to ADD at minimum:
- `AI_PROVIDER: str = "fake"` (or a `Literal["fake", ...]` if other providers are anticipated) -- this is the switch `app/ai/factory.py` reads
- Some monetary cap setting, e.g. `MONTHLY_AI_CAP_USD` or similar, replacing the bare `MONTHLY_CAP_USD` module constant -- exact name is a spec-time decision (UNKNOWN)
- Possibly a per-run cost/model setting if the deep-match-score cost table is meant to be configurable rather than hardcoded (UNKNOWN, not stated in GOAL.md)

No other AI-provider-shaped settings (API keys, base URLs, timeouts) exist in `config.py` today -- CONFIRMED via full-file read. Since `AI_PROVIDER=fake` is explicit-only per GOAL.md ("never a fallback"), the factory presumably raises rather than defaulting silently if `AI_PROVIDER` is unset or unrecognized -- worth confirming as a design decision at spec time (UNKNOWN whether Settings should default it to `"fake"` or require it explicitly set, matching the `SECRET_KEY` fail-closed-outside-local pattern already used elsewhere in this same file for a precedent of "explicit-only, no silent default in non-local envs").

## Summary of UNKNOWNs surfaced

1. Whether `app_runtime` will retain direct UPDATE on the new budget table (making a bare guarded UPDATE sufficient) or have it revoked like `application` (forcing a SECURITY DEFINER function for the reservation step) -- explicitly deferred to spec-time D1 per GOAL.md.
2. Exact env var name(s) for the monthly cap once it moves from `store.MONTHLY_CAP_USD` into `Settings`.
3. Whether `getUsageAggregate` is in scope for sprint-05 to wire to real ai_run/budget data, or stays a static fixture until a later sprint -- GOAL.md's Done-when criteria don't name this op.
4. Whether the wire `Settings` model (schemas.py, distinct from `app.core.config.Settings`) has any field that should surface `AI_PROVIDER` or cap info to the frontend -- not grepped in this pass.
5. Exact contents of `tests/test_operation_manifest.py` (file located, not read) and whether it needs updates beyond the ownership.yaml status flips.
