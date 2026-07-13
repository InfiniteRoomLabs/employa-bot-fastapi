# Plan v2 -- Data-integrity / concurrency pass (GPT-5.6-sol via Codex, 2026-07-10)

> Attack angle: data-integrity, transaction, concurrency, migration correctness ONLY. Postgres assumed. Read-only.

The persistence design is not concurrency-safe as written. Several claimed invariants exist only in route logic, and the slice ordering makes the APPLIED snapshot invariant impossible to implement when applications are converted.

## Critical findings

### 1. transitionApplication has an underspecified read-check-write race

Plan v2:68; existing sequence applications.py:274; contract mvp-api.yaml:149. The plan says `UPDATE ... WHERE version=? -> 409` but doesn't say whether that update occurs before/after snapshot, resume-lock, transition-insert, nor that the stage validated against LEGAL_TRANSITIONS is the stage actually replaced.

Under READ COMMITTED: app is (drafting, v7); T1 reads (drafting,7) validates; T2 reads same validates; T1 updates WHERE version=7 -> v8, inserts transition, commits; T2's conditional update waits, Postgres rechecks predicate, affects zero rows. If T2 checks affected-row count before child writes and rolls back -> correct 409. If it follows the mock's order (snapshot -> parent mutate -> transition append, applications.py:297-330) the loser can create orphan snapshot/lock/log before discovering the conflict. Worse: an ORM flush doing a broad UPDATE rather than the exact guarded statement lets T2 overwrite T1.

Fix: specify the algorithm -- either `SELECT ... FOR UPDATE` then reread+validate+write, OR one guarded `UPDATE application SET ... WHERE id=:id AND user_id=:user AND version=:expected AND stage=:validated_from RETURNING ...`. Zero returned rows aborts before any child insert. Transition from_stage comes from the locked/returned row, not a detached ORM object. All writes roll back together. Add a two-connection test proving exactly one of two same-version requests commits and the loser leaves no child rows.

### 2. Application/resume slice order makes the APPLIED invariant impossible

Phase A creates application+stage_transition but no resume tables (plan:50); applications converted before resumes (plan:68); resume_snapshot not created until the resume slice (plan:70); contract requires snapshot at APPLIED (mvp-api.yaml:155). The applications slice promises "transition + snapshot-ref + resume-lock" in one transaction while snapshot/resume tables don't exist. "Validate against still-mock resumes" doesn't solve it: application.resume_id can't FK a mock dict; submitted_snapshot_id can't reference a nonexistent table; a PG transaction can't atomically lock an in-memory resume; a restart can change/lose the object; later adding FKs can fail because persisted UUIDs may not exist in the new table.

Fix: move minimal resume + resume_snapshot tables into the migration that introduces applications, OR delay application persistence until they exist. If staged: nullable unenforced columns, backfill, FKs NOT VALID, validate, THEN enable APPLIED. Do not claim snapshot/lock atomicity during the seam.

### 3. Parent stage and append-only history can disagree permanently

Mutable application.stage + transition table (plan:50); every transition appends (mvp-api.yaml:158); version bumps per transition (mvp-api.yaml:1923). A trigger preventing edits to stage_transition does NOT enforce: stage = latest transition.to_stage; version matches transition count/sequence; new from_stage = previous to_stage; every parent mutation has a transition; ordering when timestamps tie. Any migration/seed/admin/mark-won/dismiss/reactivate can mutate the parent without appending. The mock already does this: mark-won mutates stage without bumping version or appending (applications.py:410-422); reactivate bumps version without appending (applications.py:477-488).

Fix: one DB function is the only permitted stage mutation (locks app, validates version/stage, appends transition, updates projection); revoke direct UPDATE(stage,version) from the runtime role; per-application transition sequence with UNIQUE(application_id, version); enforce from/to/projection consistency in the function. OR derive stage from the latest transition. "Port mock behavior verbatim" conflicts directly with the append-only contract.

### 4. The append-only trigger is incomplete

A row trigger rejecting UPDATE/DELETE does not reject TRUNCATE (needs BEFORE TRUNCATE statement trigger). It also doesn't stop: owners/superusers disabling triggers; session_replication_role=replica; migration/admin roles dropping/replacing the table; CREATE TABLE AS / rename-swap / restore; owner-run seed/reset. No mechanism makes rows immutable to a superuser -- state the trust boundary honestly.

Fix: BEFORE UPDATE OR DELETE row triggers + BEFORE TRUNCATE statement triggers; app/test roles neither own the tables nor have TRUNCATE; revoke UPDATE/DELETE/TRUNCATE from runtime role as primary protection (trigger = defense in depth); migrations under a separate owner; test under the runtime role not the owner; document that superuser/migration-owner actions are outside the guarantee.

### 5. runDeepMatchScore cannot enforce the cap using completed actual cost

Cap = SUM(actual_cost_usd) (plan:71); provider synchronous/slow (mvp-api.yaml:542-549); mock checks before + increments after (match.py:99, match.py:127). Interleaving: spend $19.90 vs $20 cap; T1 reads $19.90 passes; T2 reads $19.90 passes; both call provider; each $0.14; both persist; spend $20.18. SERIALIZABLE around only the precheck can't help after the txn ends for the provider call, and holding a serializable txn open for minutes is unacceptable. Actual cost is unknown before execution, so a strict cap on completed actual cost is impossible. The process-local semaphore doesn't serialize multiple workers/hosts.

Fix: reserve a conservative max charge before the provider call in a short txn; serialize by locking a per-user/period budget row OR atomic `reserved += max WHERE spent+reserved+max <= cap`; record ai_run reserved/running in that txn; after execution convert reservation to actual and release the difference; on failure/timeout release/expire via reconciliation; if no defensible max exists a hard cap can't be promised -- impose provider-side token limits first; money as NUMERIC never float; test cap contention with separate connections and processes.

### 6. Provider success + DB failure loses paid work and invites duplicate charges

Provider outside txn then persist match_report. Failure: provider charges + returns; DB insert fails/crashes; no report (maybe no completed ai_run); client retries; provider charged again. A context manager doesn't give exactly-once across PG and an external provider.

Fix: insert run+reservation before the provider call; durable idempotency key + unique constraint per logical request; pass idempotency key to providers that support it; persist provider request/run ids; on retry return/resume the existing run; persist raw validated result before/with the report projection; reconcile running rows whose process died; acknowledge at-least-once without provider idempotency. Also define match_report uniqueness/versioning (immutable versions + current pointer, or unique pair + guarded upsert) else two runs create ambiguous "current" reports.

### 7. mark-won/undo is neither restart-safe nor concurrency-safe

300s window (plan:68); token in process memory (store.py:3537); undo restores an old object wholesale (applications.py:443-454). No persistent undo-grant table named -- in-memory grants die on restart. Clock undefined (app time vs PG now(); PG now() is txn-start, unsuitable if a txn stays open). Concurrent failures: two mark-won each mint a valid token; undo races a transition/reactivate and restores a stale whole row erasing intervening changes; two undo calls both validate the same token; mark-won succeeds but token persist fails unless one txn.

Fix: persist undo_grant(token, application_id, transition_id, prior_stage, prior_version, created_at, expires_at, consumed_at); timestamps from one PG expression (statement_timestamp() + interval '300 seconds'); consume atomically `UPDATE ... SET consumed_at WHERE token=:t AND consumed_at IS NULL AND expires_at >= statement_timestamp() RETURNING`; lock/version-guard the app; mark-won + transition + parent update + grant insert in one txn; undo APPENDS a compensating StageTransition (never deletes history or restores a stale snapshot); restart + two-connection tests.

### 8. "Undo" doesn't contradict append-only only if it's compensating

Contract: corrections are compensating transitions (mvp-api.yaml:1822-1823). Undo may reverse current state but must not remove/rewrite the mark-won transition. The mock restores the prior object + deletes the grant, no compensating transition -- cannot be ported verbatim without violating the contract. Fix: undo = new transition source=user_correction, corrects_transition_id; preserve both events forever.

### 9. The default-resume row lock is unspecified and can deadlock

plan:70; contract mvp-api.yaml:862-878. "Row-lock" is meaningless without a stable lock row. Locking the current default is insufficient when none exists. Locking requested-then-current can deadlock (T1 A->B, T2 B->A). A partial unique index ensures at most one default but doesn't implement a race-free swap; non-deferrable promote-before-demote fails immediately.

Fix: serialize all default swaps for one user by locking the stable owner row `SELECT id FROM "user" WHERE id=:user FOR UPDATE`; then demote old + promote new in fixed order in one txn; keep `UNIQUE(user_id) WHERE is_default` as the final invariant; don't rely on locking "all existing resumes" (empty set is unlocked -> two first defaults); test default->A/B, no-default->A/B, A/B cross-swap contention.

## Migration and test failures

### 10. "Previous head" checkpoints are not a coherent migration-test definition

Per-slice revisions + checkpoint constants (plan:50); CI promises only empty-upgrade + head-singularity (plan:36). A revision ID is immutable once merged; "previous head" is not. Parallel branches can both target the same old head; merge order creates multiple heads / a merge revision. Fix: treat merged revision files + down_revision edges as immutable; test every new revision from its declared parent; test full upgrade from empty; test upgrades from every supported production revision with representative data; fail on multiple heads unless an intentional merge revision exists; never rewrite a merged revision.

### 11. "Forward-fix only" conflicts with the existing migration

Current initial migration has a real downgrade (3bae06a61157_initial_schema.py:42); plan declares no downgrades (plan:48). Some revisions reversible, later ones throwing/no-op makes `alembic downgrade` stop arbitrarily. Fix: pick one policy; if forward-only, downgrades fail explicitly with a consistent message, tooling never depends on downgrade, recovery is restore/forward-fix; don't leave stale destructive autogenerated downgrades undocumented.

### 12. Trigger DDL needs transactional + behavioral migration tests, not "idempotence"

CREATE OR REPLACE FUNCTION may be repeatable; CREATE TRIGGER is not. Broad idempotence hides half-applied/drifted schema. Fix: deterministic schema-qualified function/trigger names; rely on PG transactional DDL to roll back on failure; test parent->revision upgrade then assert insert succeeds / update fails / delete fails / truncate fails if promised / failures leave rows intact / runtime role can't disable-drop protection; execute the forbidden ops (don't just inspect pg_trigger); test dump/restore + forward upgrade; correct via a new forward revision.

### 13. Truncate-per-test conflicts with real append-only enforcement

Per-test truncation (plan:54) + append-only triggers (plan:50). Either the trigger blocks only DELETE (TRUNCATE succeeds -> append-only has a hole) or a real BEFORE TRUNCATE exists (fixture can't truncate). TRUNCATE CASCADE doesn't solve it. Running as owner / disabling triggers means tests no longer exercise production permissions. "SAVEPOINT rollback fallback where triggers allow" is conceptually wrong -- rollback never violates append-only and needs no trigger permission; uncommitted rows never became durable history.

Fix: each test in an outer transaction, rolled back; if app code commits, use the nested-transaction/savepoint-restart fixture; seed inside the outer txn; reserve truncate/reset for a privileged suite-level rebuild outside the runtime role; run dedicated trigger tests with committed transactions in an isolated DB.

### 14. Slice migrations need data-aware constraints + validation phases

Dangerous: non-null user_id on seeded rows; resume/snapshot FKs after applications hold mock UUIDs; partial-unique default-resume when seed has multiple defaults; NOT NULL/enum/unique before dedup; application.submitted_snapshot_id circular with resume_snapshot.application_id. Fix: nullable->backfill->validate->NOT NULL; FKs NOT VALID->repair->VALIDATE; dedup before unique index (define winner); define circular-FK insertion order or use a deferred FK; put invariant checks in migration tests with DIRTY representative fixtures, not empty DBs.

## JSONB integrity

### 15. Route-boundary validation is not database validation

plan:48. Pydantic/generated models validate only routed requests -- nothing for seed scripts, migrations/backfills, SQL consoles, future workers, bulk imports, direct ORM writes, older app versions. Malformed JSONB commits and later makes reads fail response validation; the DB silently becomes incompatible with the wire model. Fix: normalize queryable/important fields relationally; named CHECK constraints (JSON type, required keys, scalar types, ranges, array length, mutually exclusive variants); explicit schema version in evolving docs; validate existing rows before tightening; if full JSON Schema is required use a reviewed extension/maintained function; round-trip + direct-SQL negative tests; treat wire schema and DB constraints as two artifacts whose drift is tested.

## Additional omissions

### 16. Money/timestamps/month boundaries undefined

Cap uses actual_cost_usd but no NUMERIC, no timezone-aware timestamps, no billing timezone; processes disagree about "this month" near UTC/local boundaries. Fix: NUMERIC(p,s), timestamptz, specified boundary (UTC [month_start, next_month_start)); index (user_id, started_at) or a serialized monthly budget row.

### 17. Versioning not universal across stage-changing operations

Contract: version bumps every transition. Mock mark-won doesn't bump, dismiss doesn't bump, reactivate bumps without logging. "Port verbatim" preserves the contradiction. Fix: every stage-changing op uses the same DB transition primitive + version guard; if mark-won/undo can't take expectedVersion (frozen contract lacks it) acquire a row lock and still bump server-side version; define the conflict response precisely.

### 18. Snapshot cardinality + ownership need DB constraints

Contract: one immutable submitted snapshot per application; plan doesn't state uniqueness. Concurrent/retried APPLIED can create multiple snapshots; a snapshot/reference pair can cross applications/users. Fix: UNIQUE(resume_snapshot.application_id) if exactly one; composite ownership-consistent FKs or function checks so application/resume/snapshot share a user; ensure submitted_snapshot_id points to the snapshot whose application_id is that application; prefer making the snapshot row authoritative and deriving the pointer.

## Verdict

The plan uses optimistic versioning, append-only triggers, row locks, and "one transaction" as labels rather than executable concurrency protocols. Before implementation it needs explicit SQL-level algorithms, stable lock targets, durable reservation/undo records, database-enforced cross-table invariants, and real two-connection PostgreSQL migration/concurrency tests. Without those: a mutable application projection that disagrees with its immutable history, non-enforced AI caps, lost paid results, and migrations that pass on empty databases but fail on real state.
