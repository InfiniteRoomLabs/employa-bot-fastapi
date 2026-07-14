# Sprint-04 spec -- B3 WHOLE: applications + minimal resume + snapshot (run sprint-04-run-1)

Binding spec: plan v3 "Phase B" item 3 (3a/3b/3c) + "Design conventions" + Data-integrity #1/#3/#4/#7/#8/#9. Queue row: approved-queue.md rev 1, sprint-04 (ADVISORY, HIGH risk). Run manifest: docs/progress.md sprint-04-run-1 (guard-on commit 8e9b6e9). Dispositions the 10 Codex D1 findings (thread 019f6166-68d4-7b00-a49b-4f7eda562cbd, verdict UNSOUND on the pre-spec manifest; hardened here). Internal checkpoints 3a/3b/3c commit to branch sprint-04-apps-resume-snapshot; ONE final merge to master (v3 abandonment-safety). Codex D2 fires pre-merge (MUST: append-only mechanics + populated concurrency + the guarded-UPDATE exemplar).

## Investigation findings (S2)

Full surface map: docs/sprints/sprint-04-investigation.md (Sonnet mapper + lead verification). Key facts this spec consumes:

- CONFIRMED: 10 application ops in routes/applications.py incl. the LEGAL_TRANSITIONS matrix (12-stage wire enum), the check order (404 -> 409 conflict -> 422 invalid_transition -> 422 validation_error), markWon/undoMarkWon with an in-memory 300s UndoGrant dict keyed by a random token, dual-mode dismiss (pre-commit HARD DELETE / post-APPLIED -> withdrew+archive), reactivate (archive -> applied, source edge outside the matrix), timeline (seeded fixtures + appended events + synthetic fallback).
- CONFIRMED: mock undoMarkWon restores the ORIGINAL pre-win object (= history erase) -- explicitly NOT ported (recorded advisory default; PIN-3).
- CONFIRMED: mock markWon/dismiss do NOT bump version and do NOT append StageTransition rows; only transitionApplication does. The DB implementation deviates deliberately (PIN-12).
- CONFIRMED: no Application/StageTransition/Resume/ResumeSnapshot/UndoGrant DB models exist (models.py has Job + ShortlistEntry only). createApplication already dual-writes the minted Job to the DB (sprint-02 PIN-9) while the Application stays in-memory.
- CONFIRMED: enforce_append_only(regclass) (migration 075675058c67) = REVOKE UPDATE/DELETE/TRUNCATE from app_runtime + BEFORE UPDATE OR DELETE row trigger + BEFORE TRUNCATE statement trigger (raise regardless of role); test shape in tests/migrations/test_migration_gates.py. Its docstring already names stage_transition + resume_snapshot as the intended consumers.
- CONFIRMED: shortlist_entry (4317eb75f1cd) is the composite-FK child exemplar (MATCH SIMPLE optional refs, partial dedup, constraint-name 409 disambiguation, tenant-indistinguishable 404s); job (4c17ea8b5656) is the conventions exemplar; get_tenant_session is the tenancy dependency.
- CONFIRMED: "resume locked" in the mock is implicit -- deleteResume 409s when tag in {TAILORED, MASTER, DEFAULT} or usedIn > 0; the manifest names a resume-lock-conflict test for deleteResume. The APPLIED snapshot is a separate immutability concept.
- CONFIRMED: core-journey.spec.ts ends at the shortlist assertion; the UI already consumes the entire applications/resume surface (backend swap-out, no new UI).
- CONFIRMED: all 20 target ops are status: planned in docs/operation-ownership.yaml.
- DISPROVED (mapper section 0, "syntax error in deps.py:51"): identical to sprint-01 COR-1. The mapper ran the SYSTEM python3 (3.12); the project interpreter is 3.14.3 where PEP 758 makes unparenthesized multi-exception except legal. Evidence: `uv run python -m py_compile app/api/deps.py` exit 0 under Python 3.14.3, and the 354-test suite (which imports deps everywhere) passed minutes before the claim. GOAL.md Proven patterns already warns about exactly this trap.

## Operation boundary (PIN-6; FROZEN at spec freeze)

Flip to `implemented` (DB-backed) -- 20 ops:

| Op | Family | Note |
|---|---|---|
| getApplications | applications | DB-backed caller list for omitted/unrecognized searchId; the recognized mock search ids (BACKEND/AI_INFRA/PLATFORM fixtures) keep serving mock pools (searches stay mock through 0.1; sprint-03 PIN-3 precedent, PR-8 re-derivation) |
| createApplication | applications | persists the Application row (job dual-write already DB); searchId auto-assign via the existing mock _ensure_default_search retained (searches are mock) |
| getApplication | applications | DB view join |
| transitionApplication | applications | the mutation function (PIN-1) |
| getApplicationTimeline | applications | DERIVED from stage_transition rows + mock-parity synthetic fallback (PIN-13) |
| dismissApplication | applications | dual-mode; pre-commit = soft-remove (PIN-14) |
| markWon | applications | via the mutation function + undo_grant mint (PIN-4) |
| undoMarkWon | applications | atomic grant claim + compensating transition (PIN-3/4) |
| reactivateApplication | applications | via the mutation function, source=user_reactivation |
| getResumeSnapshot | snapshot | DB row; seed materializes snapshots for seeded stage-past-drafting rows (PIN-15) |
| getArchive | archive | outcome-bucketed SELECT over application (PIN-16: abandonment-safety corollary -- archive reads the same entity markWon/dismiss move; leaving it mock recreates the DEBT-5 seam on the journey's own resource) |
| getArchiveCounts | archive | same |
| getResumes | resumes | |
| createResume | resumes | |
| getResume | resumes | |
| patchResume | resumes | |
| deleteResume | resumes | 409 resume-lock-conflict preserved; constraint-name disambiguation for FK-referenced rows (PIN-17) |
| duplicateResume | resumes | |
| setDefaultResume | resumes | user-row lock + fixed order (PIN-5) |
| forkResumeAsDraft | resumes | fork_job_id provenance column with composite FK to job |

Stay mock (NOT flipped), with justification:

| Op | Why |
|---|---|
| getResumeUploads, getCareerHistory, getResumeTemplates, getResumeExports, getProjections, createProjection, assignTemplate, renderExport, regenerateExport | v3 line 96: full resume management (uploads/templates/projections/exports) is Release 0.2, a whole-subsystem move. Consequence documented: these ops keep reading the mock store; DB-created resumes do not appear in mock projection lists and vice versa -- off-journey, accepted like sprint-02 getJobsInbox and sprint-03 searchId views |
| getMatchReport | sprint-05 (B4 fake AI seam; match_report table arrives there) |
| interviews/match/coach reads | untouched mock fixtures; off-journey |

Changing this boundary mid-sprint is a permitted-stop PO question, not an implementer choice.

## Pinned decisions (PINs)

- PIN-1 (single stage-mutation DB function + privilege boundary, D1-2): exactly ONE DB function (owner-owned, SECURITY DEFINER, EXECUTE granted to app_runtime) performs every write of `application.stage`/`application.version`/outcome fields, implementing v3 line 38: lock the application row, guarded UPDATE `... WHERE id = :id AND user_id = <tenant> AND version = :expected AND stage = :validated_from RETURNING`, zero rows -> abort BEFORE any child write; append the stage_transition (seq via `UNIQUE(user_id, application_id, seq)`); update the projection -- atomically. The function derives the tenant from the `app.user_id` GUC itself (never a caller-passed user_id) and carries explicit user_id predicates because SECURITY DEFINER bypasses RLS. Lifecycle ops (markWon/dismiss/reactivate/undo) call the SAME function; they pass expected_version = the version read under the row lock (their wire inputs carry no expectedVersion), while transitionApplication passes the client's expectedVersion.
- PIN-2 (APPLIED atomicity, D1-1): the transition to applied, the resume_snapshot insert, the resume lock (used_in increment), and submitted_snapshot_id all happen inside the ONE function call = one transaction. Proven by an induced-failure test (a resume_id whose snapshot insert violates a constraint) asserting NO partial effect survives: stage/version unchanged, no transition row, no snapshot row, used_in unchanged.
- PIN-3 (undo predicate objectified, D1-3): undoMarkWon INSERTs a compensating stage_transition with `source='user_correction'` AND `corrects_transition_id` = the markWon transition (composite FK), returning the application to that transition's from_stage; outcome fields cleared; version bumps; the corrected row remains. All properties asserted.
- PIN-4 (persistent undo_grant + atomic claim, D1-4): `undo_grant` is a DB table; the grant id IS the wire undoToken. Claim is ONE statement inside the function: `UPDATE undo_grant SET consumed_at = statement_timestamp() WHERE id = :token AND user_id = <tenant> AND application_id = :app AND consumed_at IS NULL AND expires_at >= statement_timestamp() RETURNING ...`; zero rows with a matching-but-expired grant -> 409 undo_window_expired; unknown/foreign token -> 404 (mock parity). All timestamps from PostgreSQL expressions. Window from `Settings.UNDO_WINDOW_SECONDS` (closes DEBT-3; W-1 convention). Two-connection double-undo: exactly one winner.
- PIN-5 (setDefaultResume, D1-5): lock the stable user row first (`SELECT id FROM "user" WHERE id = <tenant> FOR UPDATE`), then demote old default -> VARIANT, promote target -> DEFAULT, fixed order (v3 Data-integrity #9). DB backstop: partial unique index `uq_resume_user_default ON resume(user_id) WHERE tag = 'DEFAULT'`. Concurrent opposite-direction swap test: no deadlock, exactly one DEFAULT after.
- PIN-6 (operation boundary): the table above; frozen.
- PIN-7 (TRUNCATE in the append-only predicate, D1-7): enforce_append_only already covers REVOKE UPDATE/DELETE/TRUNCATE + both trigger classes; the sprint's behavioral tests execute UPDATE, DELETE, AND TRUNCATE against stage_transition + resume_snapshot under app_runtime (all refused) and as owner (trigger refuses).
- PIN-8 (migration paths, D1-8): the new revision is tested from its declared parent and from empty, plus an upgrade against DIRTY REPRESENTATIVE DATA (pre-existing user/job/shortlist_entry rows survive the upgrade untouched). The five new tables are born empty: the expand/backfill/validate dance is N/A this sprint (recorded, not silently skipped). Forward-fix only (downgrade raises).
- PIN-9 (DB-backed discrimination, D1-9): every flipped op gets provenance discriminators (store-only fixture NOT served / DB-only row served) plus wire fidelity via the mapper model_validate funnel; conjunct-2 completion evidence cites the tests/api DB suites + discriminators, never the DB-free contract suite alone.
- PIN-10 (ledger-conjunct scope, D1-10): recorded, process-defined; same class as S02-D1-14. Waivers are Wes-only; disputed severity = release-blocking.
- PIN-11 (user teardown vs append-only triggers): append-only triggers block DELETE even for the owner, so a bare `DELETE FROM "user"` cascade would fail once histories exist. User deletion (users.py superuser op, seed --reset, test cleanup) goes through ONE owner-level helper that, in a single transaction, disables the append-only triggers on stage_transition + resume_snapshot, deletes the user (cascades), and re-enables them. This is inside v3 line 37's explicit boundary ("superuser/owner actions are outside the immutability guarantee -- documented, not pretended away"). EXECUTE is NOT granted to app_runtime. Tests: teardown of a user WITH history succeeds and leaves other tenants' histories intact; app_runtime DELETE remains refused.
- PIN-12 (version/transition semantics unified -- deviation from mock): every stage change (markWon, dismiss post-commit, reactivate, undo) bumps version and appends a stage_transition via the function; the mock skipped both for lifecycle ops. Mock's non-bump is a data-integrity bug, not contract behavior (the contract only requires expectedVersion mechanics on transitionApplication). Deviation recorded for the fidelity tests.
- PIN-13 (timeline is a projection, no fifth timeline table): getApplicationTimeline derives TimelineEvent rows from stage_transition (id = transition id, time = created_at, who = "You", message = "Moved to <stage>", actor = you) ordered by seq; when an application has no transitions yet, the route synthesizes the single mock-parity "Applied via <source>" event (pure function, deterministic uuid5, no storage). Seeded demo applications get seeded transition histories, which produce their timelines.
- PIN-14 (pre-commit dismiss is a soft-remove): no application row is EVER deleted at runtime (append-only children make runtime hard-delete impossible by design). dismissApplication on saved/drafting sets an internal `removed_at` (not on the wire) and returns DismissResult(removed); all reads and lifecycle ops filter `removed_at IS NULL`, so the wire behavior (404 afterward) is mock-identical. Post-APPLIED dismiss = function transition to withdrew + outcome=withdrawn + reasons (mock parity).
- PIN-15 (snapshot semantics): resume_snapshot is UNIQUE(user_id, application_id) (the mock keys snapshots by application id); getResumeSnapshot = 404 unknown/removed id, 409 conflict for stage in (saved, drafting), else the row. The mock's on-the-fly synthesis is NOT ported: seed materializes a real snapshot row for every seeded application past drafting, and reactivated applications already own one from their original applied transition. A stage-past-drafting application without a snapshot row is a seed/test-fixture bug and fails loudly.
- PIN-16 (archive ops flip): getArchive/getArchiveCounts become outcome-bucketed SELECTs over application (won -> outcome=won; passed -> outcome in (rejected, withdrawn)). Justification: markWon/dismiss move DB rows to terminal outcomes; serving archive reads from the mock store would split ONE entity across two stores -- the exact seam v3 abandonment-safety forbids and DEBT-5 documents.
- PIN-17 (resume delete taxonomy, PR-6): deleteResume 409s app-side on tag in LOCKED_TAGS or used_in > 0 (mock parity, resume-lock-conflict). DB backstops: resume_snapshot.resume_id composite FK (NO ACTION) and application.resume_id composite FK (NO ACTION) refuse deletion of a referenced resume; the route disambiguates BY CONSTRAINT NAME to the same 409 conflict envelope. Stricter than the mock for draft-app references (mock let app.resumeId dangle); recorded deviation.
- PIN-18 (search_id and mock-entity references): application.search_id, resume.source_upload_id, resume.template_id are plain uuid columns with NO FK -- searches/uploads/templates stay mock through 0.1 and a DB FK to a mock entity is impossible. v3 line 29's composite-FK rule is applied to every reference whose target IS a DB table this sprint: job_id, resume_id, application_id, corrects_transition_id, fork_job_id.
- PIN-19 (runtime privilege matrix -- hardened beyond v3's floor): app_runtime gets: application SELECT+INSERT (no UPDATE -- all mutations via the function; no DELETE -- PIN-14); stage_transition SELECT only (INSERT also revoked -- history is forge-proof, only the function writes it); resume_snapshot SELECT only; undo_grant SELECT only (mint+claim inside the function); resume full DML (CRUD ops legitimately write it). Introspection test asserts this matrix; behavioral tests prove direct writes refused under app_runtime.

## Tables (DDL summary; all: FORCE RLS + tenant policy on app.user_id GUC, user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, UNIQUE(user_id, id) anchor, timestamptz, schema_version int NOT NULL DEFAULT 1 CHECK >= 1, RLS/partial-index/FK raw op.execute with DEBT-6 autogenerate caveat)

- `application`: id PK; job_id uuid NOT NULL + composite FK (user_id, job_id) -> job(user_id, id) named fk_application_job (NO ACTION, exemplar copy -- the user_id CASCADE clears children within the same teardown statement, proven by the sprint-03 shortlist FK); resume_id uuid NULL + composite FK -> resume(user_id, id) MATCH SIMPLE named fk_application_resume; stage text NOT NULL CHECK (12 wire values); version int NOT NULL DEFAULT 1 CHECK >= 1; created_at timestamptz NOT NULL; flag text NULL CHECK (stale|offer); contact text NULL; coach_nudge bool NULL; resurrected bool NULL; outcome text NULL CHECK (won|rejected|withdrawn); outcome_at timestamptz NULL; outcome_reason text NULL; outcome_reasons jsonb NULL (named CHECK: string array, max 8; none_as_null); system_reasons jsonb NULL (same); submitted_snapshot_id uuid NULL + composite FK -> resume_snapshot(user_id, id) NO ACTION; search_id uuid NULL (no FK, PIN-18); removed_at timestamptz NULL (internal, PIN-14); index on user_id.
- `stage_transition` (append-only via enforce_append_only + PIN-19 SELECT-only): id PK; application_id uuid NOT NULL + composite FK -> application(user_id, id) ON DELETE CASCADE; seq int NOT NULL + UNIQUE(user_id, application_id, seq); from_stage text NULL CHECK; to_stage text NOT NULL CHECK; source text NOT NULL CHECK (user|user_correction|user_reactivation|system); reason text NULL; reasons jsonb NULL (max-8 CHECK); resume_id uuid NULL (plain historical column, validated at write time by the function); corrects_transition_id uuid NULL + composite FK -> stage_transition(user_id, id); created_at timestamptz NOT NULL.
- `resume`: id PK; name/subtitle/version(text, display string)/tag text NOT NULL CHECK (6 ResumeTag values); used_in int NOT NULL DEFAULT 0 CHECK >= 0; updated timestamptz NOT NULL; match int NULL; body text NULL; source_upload_id uuid NULL (no FK); template_id uuid NULL (no FK); target_role text NULL; scoring_enabled bool NULL; fork_job_id uuid NULL + composite FK -> job(user_id, id) MATCH SIMPLE (provenance, not on the wire); partial unique uq_resume_user_default (user_id) WHERE tag='DEFAULT'.
- `resume_snapshot` (append-only, SELECT-only): id PK; application_id uuid NOT NULL + composite FK -> application(user_id, id) ON DELETE CASCADE; UNIQUE(user_id, application_id); resume_id uuid NOT NULL + composite FK -> resume(user_id, id) NO ACTION (PIN-17 backstop); name text NOT NULL; body text NOT NULL; template_version text NOT NULL; captured_at timestamptz NOT NULL.
- `undo_grant` (SELECT-only for app_runtime): id PK (= wire undoToken); application_id uuid NOT NULL + composite FK CASCADE; corrects_transition_id uuid NOT NULL + composite FK -> stage_transition(user_id, id); created_at/expires_at timestamptz NOT NULL; consumed_at timestamptz NULL.

Wire mappers: per-resource `application_mapper.py` / `resume_mapper.py` (+ snapshot/transition mapping) funneling through schemas model_validate (drift guard), hand-verified field lists (no shared helper by design). ApplicationView = SQL join projection (application x job x resume), replacing store.application_view for DB rows.

## AC matrix

| AC | Conjunct/PIN | Proven by |
|---|---|---|
| AC-01a | anchors + composite FKs on every child | migration introspection + cross-tenant composite-FK negative inserts under app_runtime |
| AC-01b | FORCE RLS under app_runtime != owner (all 5 tables) | raw SQL under SET ROLE: GUC-scoped visibility, no-GUC zero rows, WITH CHECK rejects spoofed user_id, relforcerowsecurity |
| AC-01c | timestamptz everywhere | introspection: no timestamp-without-tz column |
| AC-01d | named JSONB CHECKs + none_as_null + schema_version + stage/outcome/source/tag CHECKs | introspection + negative inserts (jsonb 'null' cases included, PR-3) |
| AC-01e | PIN-19 privilege matrix | information_schema/aclexplode introspection + behavioral refusals |
| AC-01g | PIN-8 migration paths | declared-parent + empty + dirty-representative-data upgrade tests |
| AC-02 | append-only enforcement (conjunct 1) | UPDATE/DELETE/TRUNCATE (+INSERT per PIN-19) refused under app_runtime; owner blocked by trigger; INSERT via function succeeds |
| AC-03 | ops DB-backed + manifest flipped + fidelity (conjunct 2) | tests/api per-op fidelity + PIN-9 provenance discriminators + manifest diff (20 flips) + contract-drift guard still green |
| AC-03b | no stage mutation outside the function | direct UPDATE application.stage/version refused under app_runtime |
| AC-04a | guarded UPDATE zero-row abort before child writes (conjunct 3) | stale-version + stale-stage calls: error out, NO transition/snapshot rows |
| AC-04b | two-connection race (conjunct 3) | two same-version transition requests through the route: exactly one winner, loser leaves NO orphan child rows (DB-asserted under the runtime role; PR-7 connection hygiene) |
| AC-04c | PIN-2 APPLIED atomicity | induced-failure rollback test |
| AC-05 | invalid_transition envelope (conjunct 4) + mock check order | illegal edge -> 422 invalid_transition; order 404 -> 409 -> invalid_transition -> validation_error asserted |
| AC-06a | undo compensating, history intact (conjunct 5) | corrected transition still present; new row source=user_correction + corrects_transition_id; stage restored to its from_stage |
| AC-06b | PIN-4 grant mechanics | expired -> 409 undo_window_expired; foreign/unknown token -> 404; window from Settings |
| AC-06c | double-undo race | two-connection claim: exactly one winner |
| AC-07a | resume lock at APPLIED | used_in incremented in the same transaction; deleteResume -> 409 resume-lock-conflict; FK backstop via constraint-name 409 |
| AC-07b | PIN-5 default swap | concurrent swap test + partial unique index |
| AC-08 | ownership matrix (conjunct 6) | intruder_client across ALL 20 flipped ops + nested ids (transitionApplication resumeId, forkResumeAsDraft jobId, undo token, snapshot fetch): tenant-indistinguishable 404s, byte-identical |
| AC-09 | journey + CI (conjunct 7) | core-journey extended: job -> shortlist -> application -> legal transitions -> applied (resume required) -> one illegal transition rejected (invalid_transition) -> resume locked + snapshot visible; green from fresh seed; CI-required |
| AC-10 | ledger closed (conjunct 8) | every S04-* row terminal |
| AC-11 | retarget (conjunct 9) | GOAL.md -> sprint-05-fake-ai-seam in the ship commit |

## Codex D1 dispositions (S04-D1-1..10; ledger rows at ship)

| ID | Sev | Disposition | How |
|---|---|---|---|
| S04-D1-1 | HIGH | fixed | PIN-2 + AC-04c |
| S04-D1-2 | HIGH | fixed | PIN-1 + PIN-19 + AC-01e/AC-03b (hardened past the finding: history INSERT also function-only) |
| S04-D1-3 | HIGH | fixed | PIN-3 + AC-06a |
| S04-D1-4 | HIGH | fixed | PIN-4 + AC-06b/c |
| S04-D1-5 | MED | fixed | PIN-5 + AC-07b |
| S04-D1-6 | HIGH | fixed | PIN-6 operation boundary frozen with per-row justification; mid-sprint changes are a PO stop |
| S04-D1-7 | MED | fixed | PIN-7 + AC-02 |
| S04-D1-8 | MED | fixed | PIN-8 + AC-01g |
| S04-D1-9 | MED | fixed | PIN-9 + AC-03 |
| S04-D1-10 | MED | recorded (process-defined) | PIN-10 |

## Review panel charters (S6)

- QA (Sonnet): "Can intruder_client read or mutate another user's application, transition, snapshot, resume, or undo_grant via ANY of the 20 flipped ops or nested id (transitionApplication resumeId, forkResumeAsDraft jobId, undo token, snapshot/timeline/archive fetches) -- and is every id-addressed miss a tenant-indistinguishable 404? Attack the undo-grant claim path and the removed_at filter specifically."
- Correctness/security (Opus): "Does the guarded UPDATE abort on zero rows BEFORE any child write; does APPLIED snapshot+resume-lock happen in ONE transaction (induced-failure proven); is stage_transition/resume_snapshot append-only under app_runtime (REVOKE incl. TRUNCATE + triggers + PIN-19 SELECT-only); does the two-connection test leave exactly one winner and NO orphan child rows; is undo a compensating transition, never a history delete; can ANYTHING except the one function mutate stage/version/history (SECURITY DEFINER tenant derivation included); does PIN-11's teardown helper leak a bypass?"
- Simplification (Sonnet): "Did the child tables copy the shortlist composite-FK exemplar mechanically, or expose an accident? Is the single-function shape minimal for v3 line 38, or did scope creep in? Any 404/409/invalid_transition taxonomy conflation (PR-6)? Is the soft-remove (PIN-14) the smallest correct answer to the append-only cascade problem?"

## 3b: the stage-mutation function design (PIN-1 realized; frozen before 3b implementation)

ONE plpgsql function `application_stage_transition(...)`, owner-owned, SECURITY DEFINER, EXECUTE granted to app_runtime, created in a second migration (3b). Tenant = `NULLIF(current_setting('app.user_id', true), '')::uuid`; NULL tenant raises immediately (fail closed). Parameters: p_application_id, p_target_stage, p_allowed_from text[] (the per-op legal from-set the route validated), p_expected_version int NULL (NULL = lifecycle op without client optimistic guard), p_source, p_reason, p_reasons jsonb, p_resume_id uuid NULL, outcome-field params, p_mint_undo_grant bool + p_undo_window_seconds int (markWon), p_consume_grant uuid NULL (undo), p_set_resurrected bool (reactivate), p_clear_outcome bool (undo/reactivate).

Core (v3 line 79 verbatim shape, PG18 RETURNING old):

1. (undo only) atomic grant claim FIRST: `UPDATE undo_grant SET consumed_at = statement_timestamp() WHERE id = p_consume_grant AND user_id = tenant AND application_id = p_application_id AND consumed_at IS NULL AND expires_at >= statement_timestamp() RETURNING corrects_transition_id`; zero rows -> diagnose: unknown/foreign/wrong-app grant -> SQLSTATE EMP04 (404); matching-but-expired-or-consumed -> EMP4A (409 undo_window_expired). The compensating target stage and corrects_transition_id come from the claimed grant's corrected transition row.
2. THE GUARDED UPDATE: `UPDATE application SET stage = p_target_stage, version = version + 1, <outcome/resume field updates> WHERE id = p_application_id AND user_id = tenant AND removed_at IS NULL AND (p_expected_version IS NULL OR version = p_expected_version) AND stage = ANY(p_allowed_from) RETURNING old.stage, new.version`. ZERO ROWS -> abort BEFORE any child write, then diagnose in the mock's check order for the envelope: row absent/removed -> EMP04 (404); version mismatch -> EMP09 (409 conflict); else stage not in allowed set -> EMP22 (422 invalid_transition). A concurrent same-version loser blocks on the row lock, wakes to a bumped version, matches zero rows, aborts: exactly one winner, no orphan children (AC-04a/b).
3. seq = `COALESCE(MAX(seq), 0) + 1` over (user_id, application_id) -- serialized by the row lock just taken; INSERT stage_transition (from_stage = old.stage, to_stage, source, reason, reasons, resume_id when target = applied, corrects_transition_id when undo).
4. (target = applied only, PIN-2 same transaction) resume must exist AND belong to the tenant (`SELECT ... WHERE id = p_resume_id AND user_id = tenant`; missing/foreign -> EMP04 -- DEVIATION from the mock's tolerant synthesis, required by tenancy AC-08); INSERT resume_snapshot (name/body from the resume row, body falls back to the mock's 'Submitted resume -- locked at APPLIED.' literal when NULL, template_version 'v1'); UPDATE resume SET used_in = used_in + 1; UPDATE application SET submitted_snapshot_id = snapshot id, resume_id = p_resume_id.
5. (markWon only) INSERT undo_grant (id = gen token, corrects_transition_id = the transition just written, expires_at = statement_timestamp() + p_undo_window_seconds) -- window value passed from Settings.UNDO_WINDOW_SECONDS by the route.
6. RETURNS jsonb: new_version, from_stage, transition_id, snapshot_id?, grant_id?, grant_expires_at?. The route re-reads the application under RLS for the wire view.

Route-side envelope order (mock parity, best-effort on its own read exactly like the mock's non-atomic dict reads): the route pre-reads the application to apply the mock check order for applied-without-resumeId (validation_error only when the edge is legal); the function re-enforces everything under the lock, so the pre-read can only affect WHICH error a racing request gets, never data integrity. SQLSTATE -> envelope map in the route: EMP04 -> NotFoundError, EMP09 -> ConflictError, EMP22 -> InvalidTransitionError, EMP4A -> UndoWindowExpiredError.

Lifecycle op parameterization: transitionApplication (allowed_from = [route-validated current stage], expected_version = client's); markWon (allowed_from = all non-terminal stages, mint grant, outcome = won); dismissApplication post-commit (allowed_from = post-commit stages, target = withdrew, outcome = withdrawn); reactivateApplication (allowed_from = terminal-with-outcome stages, target = applied, source = user_reactivation, clear outcome, set resurrected); undoMarkWon (consume grant, allowed_from = [won], target = grant's corrected from_stage, source = user_correction, clear outcome). Pre-commit dismiss does NOT use the function (no stage change; it sets removed_at -- but application UPDATE is revoked from app_runtime, so removed_at is set by a tiny second SECURITY DEFINER helper `application_soft_remove(p_application_id)` guarded to stage IN (saved, drafting) AND removed_at IS NULL, tenant from the GUC; zero rows -> EMP04).

## Packets (S4; 3a -> 3b -> 3c explicitly sequential, inline)

- 3a: 5-table migration (DDL above; enforce_append_only on the two history tables; PIN-19 grants) + models + mappers + application/resume CRUD reads-and-writes that need no transitions (getApplications/getApplication/createApplication/getArchive/getArchiveCounts + all 8 resume ops except lock behavior arriving in 3b) + migration tests (AC-01*, AC-02) + api tests + manifest flips for the landed ops. Commit boundary (gated).
- 3b: the mutation function + transitionApplication + getResumeSnapshot + APPLIED snapshot/lock + AC-04a/b/c + AC-05 + two-connection tests + PIN-11 teardown helper. PIN-11 call sites to convert to `SELECT delete_user_with_history(:uid)` (all owner-session): app/scripts/seed.py:111 (--reset), app/api/routes/users.py:140 (deleteMe) + :227 (admin delete), tests/scripts/test_seed.py:40 (cleanup). Commit boundary (gated).
- 3c: markWon/undoMarkWon (undo_grant + Settings.UNDO_WINDOW_SECONDS)/dismiss/reactivate/timeline + AC-06*/AC-07* + ownership-matrix completion (AC-08) + seed extension (demo resumes incl. DEFAULT, applications across stages, transition histories, snapshots per PIN-15) + core-journey extension (AC-09). Commit boundary (gated).
