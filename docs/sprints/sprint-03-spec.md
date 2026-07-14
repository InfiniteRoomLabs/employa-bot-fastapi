# Sprint-03 spec -- B2 shortlist (run sprint-03-run-1)

Binding spec: plan v3 "Phase B" item 2 + "Design conventions". Queue row: approved-queue.md rev 1, sprint-03. Run manifest: docs/progress.md sprint-03-run-1. Dispositions the 11 Codex D1 findings (thread 019f5eaa-1626-7d02-b0f6-9b9d494efb77, verdict UNSOUND). The `shortlist_entry` table is the FIRST child table that composite-FKs a parent -- the exemplar sprint-04's children (stage_transition, resume_snapshot, match_report) copy, so Codex D2 fires pre-merge (D1-11).

## Investigation findings (S2, verified against code)

- CONFIRMED: contract ops getShortlist (GET /shortlist, optional searchId; mvp-api.yaml:400), addToShortlist (POST /shortlist, INLINE body -- no named schema; :420), dismissFromShortlist (DELETE /shortlist/{id}, 204; :447). Only dismiss is id-addressed.
- CONFIRMED: schemas.ShortlistEntry (schemas.py:344): id, jobId: UUID|None (OPTIONAL, "FK -> Job.id"), company, role, location, salary (SalaryPoint|SalaryRange|None), match:int, saved, source:Source, why?, stale?. Source enum (schemas.py:340) has ONE value: "you". Display fields (company/role/location/salary/match) are REQUIRED in the wire and sent by the client.
- CONFIRMED: the mock addToShortlist (routes/shortlist.py) takes jobId OPTIONAL + denormalized display fields, always creates a NEW entry (NO dedup today), source=you. dismissFromShortlist deletes by entry id, 404 on unknown.
- CONFIRMED: the frontend jobs-screen handleAddToShortlist + use-add-job-to-shortlist.ts currently pass company/role/location/compensation/match but NOT jobId. The DB-backed default /jobs view maps Job->jobToInboxItem which DOES set jobId (sprint-02), so the row has a jobId available to thread.
- CONFIRMED: getShortlist per-search views (store.SHORTLIST_BY_SEARCH) keyed by MOCK search ids; searches stay mock through Release 0.1.
- CONFIRMED: job anchor UNIQUE(user_id, id) exists (uq_job_user_id_id, models.py:96) -- the composite-FK target. get_tenant_session + the job exemplar (sprint-02-spec.md) are the copy template (ratified PR-1..PR-4).
- CONFIRMED (v3 vs contract tension): v3 imposes unique(user_id, job_id); the mock allows duplicate adds. PO ruled (2026-07-13, AskUserQuestion): duplicate add -> 409 conflict via the existing envelope (D1-3).

## Pinned decisions (PINs)

- PIN-1 (job_id NULLABLE -- no contract edit, D1-5): shortlist_entry.job_id is NULLABLE, matching the optional wire jobId. Making it NOT NULL would reject a contract-valid request (mvp-api.yaml edit -> HUMAN-DECISION stop); avoided. The composite FK (user_id, job_id) -> job(user_id, id) is MATCH SIMPLE, so it is enforced only when job_id is non-null (Postgres skips the FK check when any column is NULL). user_id is always NOT NULL.
- PIN-2 (dedup = PARTIAL unique + 409, D1-3/D1-4): `UNIQUE(user_id, job_id) WHERE job_id IS NOT NULL` named `uq_shortlist_user_job`. Job-linked entries dedup; NULL-job (display-only) entries are intentionally NOT deduped (unlimited allowed -- matches the optional wire field). On a violation, the route raises ConflictError -> 409 `conflict` envelope (the same envelope transitionApplication uses); NOT idempotent (no dedup-merge product logic; the jobs UI removes shortlisted jobs from the inbox so re-add is unreachable through the product).
- PIN-3 (routing split, D1-2/D1-8): getShortlist DEFAULT view (no searchId) is DB-backed; searchId-scoped views stay mock (searches are mock through Release 0.1 -- abandonment-safety). Manifest note mirrors sprint-02 PIN-2. Provenance discriminators prove it: a DB-only default entry is served, a store-only default entry is NOT, and a recognized mock searchId still returns the mock fixture. getShortlist flips to implemented with the split noted; addToShortlist + dismissFromShortlist flip to implemented (fully DB).
- PIN-4 (display snapshot semantics, D1-6): company/role/location/salary/match are stored denormalized as a CLIENT-SUPPLIED SNAPSHOT at add time (the contract requires them; the mock stores them verbatim; not validated/canonicalized against the job). This is NOT a tenancy hole: the composite FK independently rejects a cross-tenant job_id regardless of attacker-supplied display fields. Documented as snapshot-at-save (the shortlist shows what the user saw when they saved).
- PIN-5 (journey exercises the FK, D1-1): the frontend threads jobId through addToShortlist (jobs-screen handleAddToShortlist passes row.job.jobId). core-journey asserts (a) the addToShortlist POST body carries the created job's jobId (network-level) AND (b) an AC-level DB assertion that the persisted shortlist_entry.job_id equals the created job's id. Without both, a NULL-job entry could pass the browser list while the FK is never exercised.
- PIN-6 (JSONB + schema_version + drift, D1-7): salary is JSONB with a named CHECK `ck_shortlist_salary_shape` (IS-TRUE-wrapped: NULL, or object with extra array + either value:number or min+max:number -- same shape as job compensation), `sa_type=JSONB(none_as_null=True)` (PR-3). `schema_version int NOT NULL DEFAULT 1 CHECK >= 1`. `ck_shortlist_source` (source IN ('you')). `ck_shortlist_match_int` not needed (match is a plain int column). Wire-schema-vs-DB drift is a tested artifact: every seeded/created row round-trips wire->row->wire unchanged.
- PIN-7 (tenancy, D1-9): dismissFromShortlist on another tenant's entry id returns the SAME 404 as an unknown id (byte-identical, tenant-indistinguishable) -- the RLS-filtered lookup finds nothing either way. The partial dedup is per-user, so a cross-tenant duplicate cannot leak another tenant's existence (each tenant dedups only against their own rows).
- PIN-8 (D2 fires, D1-11): the composite-FK-to-parent is first-of-kind; Codex D2 fires pre-merge.

## The `shortlist_entry` table (child-exemplar DDL)

Columns: `id uuid PK`, `user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`, `job_id uuid NULL`, `company text NOT NULL`, `role text NOT NULL`, `location text NOT NULL`, `salary jsonb NULL`, `match int NOT NULL`, `saved timestamptz NOT NULL DEFAULT now()`, `source text NOT NULL`, `why text NULL`, `stale boolean NULL`, `schema_version int NOT NULL DEFAULT 1`.

Constraints/indexes: `UNIQUE(user_id, id)` anchor `uq_shortlist_user_id_id`; composite FK `(user_id, job_id) -> job(user_id, id)` named `fk_shortlist_job` (MATCH SIMPLE, enforced when job_id non-null); partial dedup `uq_shortlist_user_job UNIQUE(user_id, job_id) WHERE job_id IS NOT NULL`; `ck_shortlist_salary_shape`, `ck_shortlist_source`, `ck_shortlist_schema_version`; RLS policy `shortlist_tenant_isolation` (ENABLE + FORCE, on the app.user_id GUC, copied from the job exemplar); index on `user_id`. (RLS/policy + partial indexes live in the migration via raw op.execute, not model metadata -- DEBT-6 caveat carried.)

## AC matrix (per Done-when conjunct; sub-ACs per convention)

| AC | Conjunct | Proven by |
|---|---|---|
| AC-01a | tenant user_id + composite UNIQUE(user_id, id) anchor | migration introspection + duplicate-insert rejection |
| AC-01b | FORCE RLS under app_runtime != owner | raw SQL under SET ROLE app_runtime: GUC-set-no-WHERE sees only own; no-GUC zero; WITH CHECK rejects cross-tenant insert; relforcerowsecurity; owner != app_runtime |
| AC-01c | timestamptz | introspection: saved is timestamptz; no timestamp-without-tz column |
| AC-01d | named JSONB CHECK on salary + none_as_null + schema_version | introspection + negative inserts (bad salary shape rejected; schema_version 0 rejected); drift round-trip test (PIN-6) |
| AC-02 | composite FK rejects cross-tenant job_id at the DB | under app_runtime: insert shortlist_entry with (own user_id, a job_id owned by ANOTHER tenant) -> FK/RLS rejection; with own job_id -> accepted; NULL job_id -> accepted (FK skipped) |
| AC-02b | dedup UNIQUE(user_id, job_id) partial | second insert of same (user_id, job_id non-null) rejected; two NULL-job rows accepted; route maps the violation to 409 conflict |
| AC-03 | ops DB-backed + manifest flipped + fidelity | getShortlist(default)/addToShortlist/dismissFromShortlist served from DB (wire-valid); provenance discriminators (store-only default absent, DB-only served, mock searchId still served); manifest diff flips the three ops with the PIN-3 note |
| AC-04 | ownership matrix, tenant-indistinguishable 404 | intruder getShortlist sees zero victim rows; intruder dismiss on victim entry id -> 404 byte-identical to unknown id; intruder addToShortlist with victim's job_id -> rejected (no cross-tenant link) |
| AC-05 | journey extended: job -> shortlist, FK exercised | core-journey: create job -> add to shortlist (POST body carries the created jobId, network-asserted) -> shortlist lists it; AC-level DB assert that the row's job_id = the created job |
| AC-06 | core-journey required in CI, fresh seed | playwright.yml runs the whole e2e dir; CI run green at the master SHA (evidence binding) |
| AC-07 | ledger closed | every S03-* row terminal |
| AC-08 | retarget | GOAL.md -> sprint-04, committed |

## Codex D1 dispositions (S03-D1-1..11; ledger rows at ship)

| ID | Sev | Disposition | How |
|---|---|---|---|
| S03-D1-1 | HIGH | fixed | PIN-5: journey network-asserts the created jobId in the POST + AC-05 DB-asserts the row's job_id |
| S03-D1-2 | HIGH | fixed | PIN-3: routing split recorded (default DB, searchId mock) with a manifest note + provenance discriminators, mirroring sprint-02 PIN-2 |
| S03-D1-3 | HIGH | fixed (PO decision) | duplicate add -> 409 conflict via the existing envelope (Wes, AskUserQuestion 2026-07-13); AC-02b asserts |
| S03-D1-4 | MED | fixed | PIN-2: partial dedup; NULL-job entries intentionally not deduped, stated + tested |
| S03-D1-5 | HIGH | disproved-with-evidence | PIN-1: job_id stays NULLABLE -> no contract-valid request is rejected -> no mvp-api.yaml edit -> no HUMAN-DECISION stop |
| S03-D1-6 | MED | fixed | PIN-4: display fields are a client snapshot (contract-required, mock-verbatim); the composite FK independently blocks cross-tenant job_id; documented |
| S03-D1-7 | HIGH | fixed | PIN-6 + AC-01d: named salary JSONB CHECK, schema_version, drift round-trip test |
| S03-D1-8 | MED | fixed | AC-03 provenance discriminators + searchId boundary test |
| S03-D1-9 | MED | fixed | PIN-7 + AC-04: cross-tenant dismiss byte-identical 404; per-user dedup, no existence leak |
| S03-D1-10 | MED | fixed | copy-map ratified into GOAL.md Proven patterns and committed (cae09d4) |
| S03-D1-11 | HIGH | fixed | PIN-8: Codex D2 fires pre-merge |

## Review panel charters (S6)

- QA (Sonnet): "Can intruder_client see or mutate another user's shortlist entry via list, dismiss, dedup-create, or the composite job reference -- and is every id-addressed miss a tenant-indistinguishable 404? Attack: cross-tenant job_id in addToShortlist, cross-tenant dismiss, the searchId mock boundary, and the denormalized-snapshot path."
- Correctness (Opus): "Does the composite FK (user_id, job_id) -> job(user_id, id) make a cross-tenant job_id fail at the DB (under app_runtime, not just app-level), does the PARTIAL unique(user_id, job_id) hold under a two-request race (exactly one 201, the other 409), and is the NULL-job path (FK skipped, no dedup) correct and intentional?"
- Simplification (Sonnet): "Did shortlist_entry actually copy the job exemplar mechanically, or did the copy expose a job-specific accident in the sprint-02 pattern? Is the exemplar-coverage mapping honest -- can sprint-04's composite-FK children copy this?"

## Exemplar-coverage mapping (queue promotion artifact, Codex F13) + rubric

Which sprint-02 patterns cover sprint-03's work: tenancy (RLS + get_tenant_session) = CLEAN-COPY from job; migration shape (ENABLE/FORCE RLS + raw op.execute) = CLEAN-COPY; per-convention migration tests = CLEAN-COPY; api/route tests = CLEAN-COPY; e2e journey extension = CLEAN-COPY; wire mapper = NEEDS-JUDGMENT (per-resource field list). NET-NEW (not covered by sprint-02, hence D2): the composite FK (user_id, job_id) -> parent, the partial dedup index + 409 mapping, the nullable-FK MATCH-SIMPLE behavior, the denormalized-snapshot child. Rubric score (representativeness of the job exemplar for child tables): 7/10 -- tenancy/migration/test scaffolding copies cleanly; the composite-FK + dedup + nullable-reference mechanics are genuinely new and are why D2 fires. This is the recorded artifact the queue's sprint-03->AUTONOMOUS promotion path requires (Wes-only queue edit; NOT self-advanced).

## Packets (S4; inline, sequential)

- P1: models.ShortlistEntry + migration (DDL above; copy the job exemplar's RLS/policy) + tests/migrations/test_shortlist_entry.py (AC-01a..d, AC-02, AC-02b). Commit boundary.
- P2: shortlist_mapper.py + DB-backed getShortlist(default)/addToShortlist(409 on dup)/dismissFromShortlist via get_tenant_session + tests/api/routes/test_shortlist.py (AC-03, AC-04) + manifest flips + contract test split (mock searchId branch retained). Commit boundary.
- P3: seed extends to demo shortlist entries (linked to the demo jobs) + seed tests. Commit boundary.
- P4: frontend threads jobId through addToShortlist; core-journey extended (job -> shortlist, FK-exercised per PIN-5). Commit boundary.
