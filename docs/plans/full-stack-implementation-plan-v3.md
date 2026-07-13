# Employa-Bot full implementation -- Plan v3

Third revision. Folds four adversarial reviews into a delivery-shaped plan:
- `full-stack-implementation-plan-critique.md` (scope/sequencing/contract -- drove v2)
- `full-stack-implementation-plan-v2-security-review.md` (14 findings)
- `full-stack-implementation-plan-v2-delivery-review.md` (estimate + abandonment)
- `full-stack-implementation-plan-v2-data-integrity-review.md` (18 findings)

## What changed from v2, and why

The reviews converged on one structural verdict: **v2 is still an "everything" map, not a delivery plan.** Three changes reshape it:

1. **The first shipment is ONE founder journey (Release 0.1), not 83 operations.** (Delivery #1.) Everything not on that journey stays mock-backed or is hidden. Release 0.1 is the real learning artifact -- a complete full-stack thread the founder hand-refactors.
2. **Abandonment safety is a hard rule: no release checkpoint may depend on a cross-store (DB<->mock) relationship.** (Delivery abandonment analysis + Data-integrity #2.) This *kills the v2 "validate resumeId against still-mock resumes" seam* -- which the data-integrity pass proved makes the APPLIED-snapshot invariant literally impossible anyway. **Applications, minimal resume, and resume_snapshot move together in one slice.**
3. **Concurrency/security/tenancy primitives are design conventions from commit one, not later hardening** -- because they shape the schema (composite FKs, `user_id` on every child, NUMERIC money, timestamptz, RLS) and can't be bolted on after tables exist.

Cut from the critical path (moved to "Later" or "Deferred"): MSW restoration of 41 suites, Phase-E productionization (Traefik/mkcert/GHCR/sops/backup-CI), the extension, ClaudeCLIProvider hardening, coach/agents + periphery persistence, the two-browser build. Rationale in the delivery review; each is real work, none is on the path to a working founder journey.

**Honest estimate (from the delivery pass):** Release 0.1 = **15-27 focused sessions** (p50 ~20), first browser demo by session 4-7. Everything through a "full contract" end state = **60-75 sessions p50, 95-125 p90** -- i.e. a multi-month project, not 22-26 sessions. v2's estimate was arithmetic, not experience.

---

## Design conventions (binding from the first migration)

These fold the security + data-integrity non-negotiables into the schema so they can't be retrofitted.

**Tenancy (Security #2 -- systemic, not per-query discipline):**
- Every tenant-owned table carries `user_id` -- including children (`stage_transition`, `resume_snapshot`, `match_report`, uploads). An FK proves existence, not ownership.
- Composite uniqueness `UNIQUE(user_id, id)` on owned tables; nested references use **composite FKs** `(user_id, resume_id) -> resume(user_id, id)` so a cross-tenant nested id (`transitionApplication.resumeId`, `createApplication.searchId`, capture `searchId`, deep-score `resumeId`) fails at the DB, not at a forgotten `.where()`.
- **PostgreSQL Row-Level Security** on tenant tables with a transaction-local `SET LOCAL app.user_id`, `FORCE ROW LEVEL SECURITY`, runtime role != table owner. This is the backstop for the one query that forgets its predicate.
- Every id-addressed miss returns a tenant-indistinguishable 404.

**Money & time (Data-integrity #16):** money is `NUMERIC(10,6)`, never float; all timestamps `timestamptz`; billing window is UTC `[month_start, next_month_start)`.

**Append-only tables (`stage_transition`, `resume_snapshot`) -- the trust boundary stated honestly (Data-integrity #3, #4):**
- Primary protection is **role permissions**: revoke `UPDATE/DELETE/TRUNCATE` from the runtime role. Triggers (`BEFORE UPDATE OR DELETE` row + `BEFORE TRUNCATE` statement) are defense-in-depth.
- Migrations run under a separate owner role. Superuser/owner actions are explicitly *outside* the immutability guarantee -- documented, not pretended away.
- **The parent projection (`application.stage`) is not independently writable.** One DB function is the only permitted stage mutation: it locks the application, validates version+stage, appends the transition (with a per-application `UNIQUE(application_id, seq)`), and updates the projection -- atomically. Direct `UPDATE(stage, version)` is revoked from the runtime role. This closes the parent/history divergence the mock has today (`applications.py:410,477`).

**JSONB (Data-integrity #15):** opaque sub-objects (SearchCriteria, JobLocation, Employment, Salary, rubrics) are JSONB with **named CHECK constraints** (json type, required keys, scalar types, ranges) -- because seed scripts, migrations, and direct SQL bypass Pydantic. Queryable fields are normalized to columns. An explicit `schema_version` rides evolving documents. Wire-schema-vs-DB-constraint drift is a tested artifact.

**Auth (Security #7, #11, cross-cutting #1):**
- Invalid/expired token, inactive user, and unknown user all return the **same 401 `"Could not validate credentials"`** via the same code path (no enumeration; fixes `deps.py` 403 + the 400/404 leaks). Do NOT add 403 to `_STATUS_TO_KIND` -- the contract maps `unauthorized`->401.
- Login is throttled *before* password verification (per-IP + per-account + global) and returns one message for unknown-user/bad-password/inactive.
- JWT gains `iss/aud/iat/nbf/jti` + a session-version claim; `SECRET_KEY` must be explicitly set outside local (fail closed). Access-token lifetime dropped from 8 days; localStorage retention is paired with a strict CSP (treat XSS as account takeover).
- `allow_credentials=False` on CORS while auth is bearer-only; methods/headers narrowed to what's used.

**Migrations (Data-integrity #10, #11, #14):**
- Merged revision files + `down_revision` edges are immutable; every new revision is tested from its *declared parent* and from empty, plus from each supported prior revision with **dirty representative data**. Multiple heads fail CI unless an intentional merge revision exists.
- One forward-fix policy (downgrades raise a consistent error); the stale destructive downgrade in `3bae06a61157` is either removed or documented as the boundary.
- Populated-table changes use the expand/backfill/validate dance: nullable -> backfill -> `NOT NULL`; FK `NOT VALID` -> repair -> `VALIDATE`; dedup before unique index.

**Test isolation (Data-integrity #13, Delivery #5):** each test runs in an **outer transaction rolled back at teardown** (savepoint-restart fixture if app code commits) -- never truncate (truncate can't coexist with append-only triggers, and rollback never violates append-only). One DB test world, introduced once, with explicit `db_client`/`store_client` fixtures -- no autouse-by-directory magic. Mixed contract test files are split by subsystem once, up front.

---

## Release 0.1 -- The founder journey (abandonment-safe, ~15-27 sessions)

The only entities that become DB-backed are those on this thread. Everything else stays entirely mock-served (drift guard still green) or is hidden in nav. **Nothing on the journey references a mock entity.**

### Phase 0 -- Gates (CI is enforcement; skills are convenience)
- Fix `scripts/generate-client.sh` to generate from `mvp-api.yaml` (contract-first, `docs/mvp-plan.md:84-90`), not runtime OpenAPI.
- CI: `generated-diff` job (regenerate `schemas.py` + `client/` -> `git diff --exit-code`); migration tests (empty-upgrade + head singularity + trigger behavioral tests under the runtime role); manifest validation. Existing 90% coverage gate relaxed to advisory during the prototype (Delivery #6 -- don't let a coverage gate block a throwaway spike).
- Claude skills (`contract-change`, `db-swap-resource`, `slice-done`) as documented aids; the `PostToolUse` autoformat **exits non-zero on formatter failure** (v1's exit-0 hid failures).

### Phase A -- Foundation (2-4 sessions)
- One DB test world (engine, outer-transaction fixture, explicit fixtures, `seed_domain`), authenticated `db_client` + `intruder_client`.
- **Auth boundary as one commit:** every mock route gains `CurrentUser` (401 without token) while persistence stays in-memory; the 401 normalization lands here; `getCurrentUser` (`/user`) -> real `CurrentUser`, first `implemented` op. Contract fidelity test lands now.
- Split the mixed contract test files by subsystem now, before any conversion.
- Seed module + `python -m app.scripts.seed [--reset]`, prestart behind `SEED_DEMO_DATA=true`.

### Phase B -- The journey vertical (13-20 sessions)
Order, each a demo-able increment ending in a visible browser win:

1. **Jobs (manual capture only)** -- 2-4 sessions. `job` table with the partial-unique dedup index reserved for later captureJob. First real DB row in the existing UI. *Gate: a created job persists and lists.*
2. **Shortlist** -- 2-4. `shortlist_entry` unique `(user_id, job_id)`.
3. **Applications + minimal Resume + Snapshot -- TOGETHER, split into 3 commits** -- 7-12. This is the tar pit *and* the invariant that forces resume to move with it. Tables: `application`, `stage_transition` (append-only, the mutation-function pattern), minimal `resume`, `resume_snapshot` (append-only). Commits:
   - **3a -- CRUD + read projection.** `application_view()` join helper. No transitions yet.
   - **3b -- transitions + concurrency + history + snapshot.** The guarded `UPDATE application SET ... WHERE id AND user_id AND version=:expected AND stage=:validated_from RETURNING` (Data-integrity #1 -- zero rows aborts before any child write; `from_stage` from the returned row). APPLIED does the real snapshot + resume-lock **in the same transaction** (now possible because resume tables exist). Two-connection test: exactly one of two same-version requests commits, loser leaves no child rows.
   - **3c -- markWon / undo / dismiss / reactivate / timeline.** Persistent `undo_grant` table (Data-integrity #7): consume atomically with `WHERE consumed_at IS NULL AND expires_at >= statement_timestamp() RETURNING`; timestamps from one PG expression; restart-safe. **Undo is a compensating transition** (`source=user_correction`, `corrects_transition_id`), never a history delete (Data-integrity #8 -- the mock's verbatim behavior *violates* the contract here, so it is explicitly NOT ported as-is). Set-default-resume swap locks the stable **user row** first, then demote/promote in fixed order (Data-integrity #9 -- avoids the A<->B deadlock).
   *Gate after 3c: manual job -> shortlist -> application -> legal transitions to applied (resume required) -> one illegal transition rejected with the invalid_transition envelope -> resume locked + snapshot visible.*
4. **Fake AI seam** -- 4-7. Minimal `ai_run` (NUMERIC cost, timestamptz, status CHECK) + `match_report`. `app/ai/` ABC + `fake.py` (deterministic, explicit-only, never a fallback) + `factory.py`. `previewDeepMatchScore` = pure arithmetic. `runDeepMatchScore` uses the **reservation cap** (Data-integrity #5, #6): short txn reserves a conservative max via `reserved += max WHERE spent+reserved+max <= cap` on a locked per-user budget row, inserts `ai_run(reserved)`, calls provider outside the txn, converts reservation->actual after; idempotency key + unique constraint so a retry after a DB failure returns the existing run (no double "charge"). `match_report` gets immutable-version + current-pointer semantics (no ambiguous "current"). *Gate: fake score persists and renders.*

### Gate 0.1 (session ~15-20)
`frontend/e2e/core-journey.spec.ts` (fresh seed, `AI_PROVIDER=fake`), required in `playwright.yml`. Fresh-clone drill: clone -> `docker compose watch` -> seeded working journey. **This is the shippable learning artifact.** Founder review here decides whether to continue.

**Frontend during Release 0.1:** the app already speaks HTTP (`data/api.ts`). Do NOT restore the 41 retired vitest suites (Delivery #3 -- largest hidden tax, no clean per-resource partition). Keep the gated `adapter.integration.test.ts` + a few hook tests + the Playwright journey. The retired suites stay retired with a written note that post-refactor test strategy is redesigned.

---

## Release 0.2+ -- Everything else (only if 0.1 proves worth continuing)

Each increment stays abandonment-safe (moves a whole subsystem DB-side; never DB<->mock across a relationship). Sketched, not fully specified -- re-plan each against the reviews when it starts:

- **Periphery** (notifications, settings, `getUsageAggregate` computed from `ai_run`, library CRUD + trash/restore/purge, data export, deleteAccount). The delivery pass calls this the "miscellaneous tar pit" (6-11 sessions). **Data export is an account-wide exfil endpoint** (Security #3): tenant-owned export record, streaming bounded writer, download endpoint rechecking JWT+ownership, no secret in URL, `Cache-Control: no-store`, excludes hashes/tokens/secrets. Exports/deletion are synchronous-MVP with documented manual purge.
- **Resume management (full)** -- uploads/templates/projections/exports. **File handling** (Security #10): stream with compressed-size enforcement, magic-byte validation, sandboxed parsing with expanded-size/CPU/time limits (zip-bomb defense), server-controlled filenames, per-user storage quota. Bodies in Postgres is an MVP call to revisit at real-prod.
- **Coach/agents read surfaces** -- the 6 deferred ops stay mock-served (drift needs them; manifest keeps `deferred`).
- **Contract revision + extension tokens** (Phase C from v2) -- full governance (`DECISIONS-NEEDED.md` ruling, `CONTRACT-NOTES.md` deltas, version bump, 89->92). **Extension-token verifier is selector+HMAC, NOT pwdlib** (Security #1 -- you can't index a bcrypt/argon2 hash; pwdlib on every capture is a DoS primitive): store `token_id` (opaque, non-enumerable) + `HMAC-SHA256(pepper, secret)`, indexed lookup by `token_id`, `hmac.compare_digest`. Tokens get `expires_at`, `capture:job` scope, active-token cap, rotation, recent-auth-to-mint (Security #5). `get_capture_principal` **rejects both credentials if both present**, returns a narrow `CapturePrincipal` (never a `User`), attached only to captureJob (Security #4). Capture semantics stated explicitly: **store-only, no server fetch** -> validation is URL normalization not "SSRF guard" (Security #6); if a fetch is ever added it needs a network-egress-restricted fetcher. Per-field length caps + daily quotas + canonical-URL dedup (Security #13). captureJob declares **both** 201-created and 200-deduped responses with `created: boolean` (Data-integrity/contract).
- **ClaudeCLIProvider hardening** (Security #9): stdin-only (never argv -- `/proc/cmdline` leak), absolute root-owned binary, close nonessential FDs, isolated temp HOME/XDG, telemetry off, dedicated no-network OS user, killpg lifecycle. `ai_run` is **metadata-only by default** (no raw prompts/outputs unless encrypted + short-retention); Sentry `send_default_pii=False` + scrub; canary-secret redaction tests. Prompt-injection *containment* (strict field length/count caps, output-context encoding, no-raw-HTML markdown, adversarial tests) lands *before* the residual risk is "documented" (Security #8).

## Productionization appendix (a separate project, not this plan)

Per Delivery #2, this is explicitly out of the implementation plan. When a real deploy target is chosen (homelab k3s is the leading candidate, per the infra-repo conventions), plan it separately. The only prod-adjacent things kept here: a `compose.production.yml` local profile, a migration-from-empty CI check, one seed/reset command, one smoke journey, and a manual `pg_dump`/restore note. No Terraform/Ansible/DinD, no metrics stack, no TLS/mkcert on the critical path.

## Deferred register (recorded, not forgotten)

Real cloud target + IaC - AnthropicAPIProvider (new ABC subclass later) - board-specific extension extractors (JSON-LD + manual-edit form first) - Prometheus/Grafana metrics - async job runner (exports/purge are synchronous-MVP) - store submission - GDPR-grade deletion design - accessibility gate beyond the axe dev-check - SBOM/provenance - error-message hygiene sweep (Security #14 -- stable public codes, redacted correlation-keyed diagnostics).

## Verification

Per commit: lint, both test suites, compose boot. Per resource: **ownership matrix** (collection filters, nested-id FKs in bodies, cross-resource reads -- not just id-addressed 404s), envelope exactness, fidelity flip, and -- for anything concurrent -- a **two-connection Postgres test**. Cross-phase: Gate 0.1 (the real checkpoint), fresh-clone drill. Migration tests run against dirty representative data, not just empty DBs, with the forbidden append-only operations actually executed under the runtime role.

## The one-paragraph version

Build the founder journey (login -> job -> shortlist -> application+transitions+snapshot -> fake match) as one abandonment-safe DB-backed vertical, with tenancy/immutability/money/concurrency baked into the schema from commit one and the actual SQL algorithms specified (guarded versioned UPDATE, reservation-based AI cap, compensating-transition undo, owner-row-lock default swap). Ship that as Release 0.1 in ~20 sessions with a browser demo by session ~5. Treat everything else -- periphery, extension, prod, CLI hardening -- as separately-planned increments that each move a whole subsystem and never straddle the DB/mock line. Don't restore the 41 frontend suites, don't build fake-cloud infra, don't use pwdlib for API tokens, and don't validate DB applications against mock resumes.
