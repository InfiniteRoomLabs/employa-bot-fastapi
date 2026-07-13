# Employa-Bot full implementation -- Plan v2 (post-critique)

Revision of `full-stack-implementation-plan.md` after the GPT-5.6-sol adversarial review (`full-stack-implementation-plan-critique.md`). The five verdict items drive the restructure: (1) the frozen 89-op contract stays frozen for the core build, (2) thin vertical slices per resource, (3) founder journey before AI/extension hardening, (4) fake-cloud infra deleted, (5) enforcement moves to deterministic CI gates.

## Context

Current state: frozen 89-op contract (`mvp-api.yaml`), 30-screen frontend already HTTP-swapped onto the in-memory mock backend (`frontend/src/data/api.ts` is a live HTTP adapter; 41 vitest suites retired pending restoration, `frontend/vitest.config.ts:116-122`), DB-backed auth/users/utils only, single squashed migration. `docs/operation-ownership.yaml`: 83 planned / 0 implemented / 6 deferred (founder rulings 2026-07-04 stand). `docs/mvp-plan.md` remains binding: slice order, ownership rules, append-only trigger, AI-seam hardening, seeding conventions, **contract-first client generation** (generate from `mvp-api.yaml`, not runtime OpenAPI -- `docs/mvp-plan.md:84-90`), and the frozen provider set `claude_cli|fake`.

**Founder rulings this session (to be recorded in `DECISIONS-NEEDED.md` before Phase C executes):** extension is capture-only, Chrome + Firefox via WXT; capture/extension-token contract revision is approved in principle but runs through the full documented change process as its own phase; no cloud spend -- production deploy target selection is deferred (homelab k3s is the natural candidate; not in scope here); "agent-ops" = CI-enforced gates + Claude Code skills as conveniences + an `ai_run` ledger for the product's own AI runs.

**Dropped from v1 (with reasons):**
- **AnthropicAPIProvider** -- unapproved scope vs. the frozen `claude_cli|fake` ruling (`docs/mvp-plan.md:54-58`). Post-MVP; the ABC makes it a new subclass later.
- **Terraform/Ansible/DinD local cloud simulation** -- ceremony without representative failure modes; privileged DinD weakens the host. Replaced by a hardened compose production profile (Phase E).
- **Prometheus/Grafana/exporters stack** -- no persistent place to collect/alert yet. Replaced by structured logs + correlation IDs + Sentry + the `ai_run` ledger.
- **Board-specific extension extractors (5 boards)** -- a product, not a phase. JSON-LD + generic capture + manual-edit form ships first; board enrichment is measured follow-up.
- **Top-level contract `security` block in the core build** -- auth is introduced per-resource during conversion (Phase B), and only made a contract-wide default in the contract revision phase (Phase C) once every op actually enforces it.
- **"Byte-compatible seed keeps ~110 assertions passing"** -- replaced by per-resource test migration (each conversion moves only that resource's behavior tests onto DB fixtures).
- The v1 `claude-api`-skill dependency (moot with the provider dropped).

## Cross-cutting corrections (from the critique's factual findings)

1. **401, not 403.** The contract maps `unauthorized` -> 401 (`mvp-api.yaml` info.description; `KIND_TO_STATUS` at `backend/app/api/errors.py:30-40`). Fix `deps.get_current_user` to raise 401 for invalid/expired tokens AND normalize inactive-user (400) and user-not-found (404) to the same 401 `"Could not validate credentials"` -- one indistinguishable auth failure, no account enumeration. Do NOT add 403 to `_STATUS_TO_KIND`. Frontend simplification: `data/api.ts` drops its 403-detail-sniffing special case (`isAuthFailure` becomes `res.status === 401`).
2. **Contract-first client generation lands in Phase 0.** `scripts/generate-client.sh` switches input from runtime OpenAPI dump to `mvp-api.yaml` directly, per `docs/mvp-plan.md:84-90`. A separate runtime-fidelity test (not the client) covers "does the app serve what the contract says".
3. **`getCurrentUser` (`/user`) vs `/users/me`** -- explicitly two different things; the contract op flips to a real `CurrentUser`-backed implementation in Phase A and is the first `implemented` manifest entry.

## Phase structure

Phases are ordered by risk retirement: gates first, then the core journey vertical slices, then the approved contract revision + extension, then productionization. Per-resource commits; no phase-level commit-count promises. Every commit: lint green, tests green, compose boots.

---

## Phase 0 -- Deterministic gates (CI is the enforcement; skills are conveniences)

**CI (the actual enforcement):**
- `generated-diff` job: regenerate `backend/app/schemas.py` (datamodel-codegen from `mvp-api.yaml` + documented sed) and `frontend/src/client/` (openapi-ts from `mvp-api.yaml` after the script fix) -> `git diff --exit-code`. Catches hand-edits and stale regens regardless of what tool made them.
- `test-backend.yml` gains: migration tests (upgrade from empty; head singularity check), manifest validation, and later the fidelity suite. Existing 90% coverage gate stays.
- Branch protection: `lint`, `test-backend`, `test-docker-compose`, `playwright` required.
- `scripts/generate-client.sh` fixed to contract-first (input `mvp-api.yaml`).

**Claude Code layer (convenience, not enforcement):**
- `.claude/skills/`: `contract-change` (full regen-chain checklist), `db-swap-resource` (the Phase-B recipe), `slice-done` (definition-of-done runner). Documented as aids; CI is authoritative.
- Hooks: `PreToolUse` guard on generated files (advisory redirect to the skill) and a `PostToolUse` autoformat that **exits 2 loudly on formatter failure** (v1's always-exit-0 concealed failures).

**Image hardening (needed by Phase E, cheap now):** digest-pinned bases, non-root user in `backend/Dockerfile`, `nginx-unprivileged` for frontend.

## Phase A -- Foundation: DB conventions, auth boundary, test scaffolding, seed

**Conventions (binding):** every domain table `id uuid pk`, `user_id` FK indexed RESTRICT (CASCADE only owner->owned-child), `created_at/updated_at`; enums = VARCHAR + named CHECK; opaque sub-objects (SearchCriteria, JobLocation, Employment, Salary, rubrics, diffs) = JSONB validated at the route boundary by the generated wire models; flat `models.py` with per-slice sections; forward-fix (no downgrades) until a real prod target exists, then expand/contract rules apply.

**Migrations are per-slice, authored when the slice lands** (`docs/mvp-plan.md:61-65`). Phase A's migration contains ONLY: `saved_search`, `job` (with the partial-unique `(user_id, source_url) WHERE source_url IS NOT NULL` for later dedup), `application`, `stage_transition` (+ append-only PL/pgSQL trigger via `op.execute`). No shortlist, no interviews, no resume tables -- those come with their slices. `tests/migrations/` pins: single head, upgrade-from-empty; per-slice upgrade checkpoints are recorded as revision-id constants when each slice merges.

**Auth boundary (one explicit sub-phase, before any persistence swap):** every mock route gains `CurrentUser` (401 without a token) while persistence stays in-memory. This is the critique's "convert all mock routes to a shared authenticated principal without changing persistence" option -- one commit, one behavior change, testable in isolation. `tests/contract/conftest.py` gains an authenticated `client` (token minted via `security.create_access_token`) + an `intruder_client`; the DB-free store reset stays. The 401 normalization from cross-cutting correction #1 lands here. `getCurrentUser` flips to real `CurrentUser` -> first `implemented` op.

**Test architecture (hybrid, not big-bang):** existing DB-free contract behavior tests keep running against the store until their resource converts. New `tests/db/` fixtures (engine, per-test truncation of domain tables, `seed_domain(session, persona_id)`) land independently. Per-resource conversion moves ONLY that resource's behavior tests onto DB fixtures. Drift + fidelity tests stay fixture-agnostic.

**Contract-fidelity test** (`tests/contract/test_contract_fidelity.py`): normalized runtime-OpenAPI vs contract comparison scoped to manifest `implemented` ops. Lands now so every later flip is guarded.

**Seed:** `app/seed.py` + `python -m app.scripts.seed [--reset]` -- idempotent, persona users with known passwords, well-known fixture UUIDs verbatim (single canonical constants module shared with nothing mutable), wired into prestart behind `SEED_DEMO_DATA=true` (never CI).

## Phase B -- Core journey, thin vertical slices (FakeProvider on the critical path)

Per-resource recipe (each = one commit): slice migration (if this resource starts a slice) -> DB model section -> seed builders -> route conversion in place (same operation_ids, same response models, + SessionDep/CurrentUser, every query ownership-scoped) -> behavior + ownership tests moved to DB fixtures -> manifest flip -> **MSW handlers + that resource's retired vitest suites restored** -> compose smoke.

Order (mvp-plan slice order, core journey first):
1. **searches** (derived counts via aggregates)
2. **jobs** (manual-capture path only -- the contract's existing surface; captureJob waits for Phase C)
3. **shortlist** (slice migration #2: `shortlist_entry`, `interview_round`)
4. **applications** -- port mock behavior verbatim: LEGAL_TRANSITIONS matrix, `transitionApplication` with `UPDATE ... WHERE version=?` optimistic concurrency -> 409, transition insert per change, markWon/undo (300s window -> 409 undo_window_expired), dismiss dual-mode, reactivate, timeline projection. **Transaction boundary spec:** transition + snapshot-ref + resume-lock happen in ONE transaction; AI never inside a transaction. Documented transitional seam: resumeId validated against still-mock resumes until the resume slice.
5. **interviews**, **archive** (archive's slice-ownership deviation from mvp-plan periphery is recorded in the manifest change)
6. **resumes + lifecycle** (slice migration #3: `resume`, `resume_snapshot` (immutability trigger), `resume_upload`, `career_history_item`, `resume_template` (global), `projection`, `resume_export`, `match_report`, `ai_run`): fork-as-draft, set-default swap (row-lock to prevent the race), delete-blocked-when-locked 409, snapshot at APPLIED. **File storage decision:** resume/upload bodies live in Postgres (TEXT/BYTEA) for MVP -- single-node, backup story is pg_dump, revisit at real-prod time; size caps enforced at the route (413 -> envelope).
7. **AI layer, fake-first:** `app/ai/` package -- ABC (`deep_match_score`, `derive_accomplishment`), `fake.py` (deterministic, explicit-only, **never a fallback**), `factory.py`, `limiter.py` (Semaphore 2 + queue 4 -> 429), `runs.py` (run-record context manager; cap check = SUM(actual_cost_usd) non-synthetic this month -> 402), `pricing.py`. `previewDeepMatchScore` = pure arithmetic. `runDeepMatchScore` + `deriveAccomplishmentFromProject` (pull `project`/`accomplishment` tables in this slice's migration) work end-to-end with `AI_PROVIDER=fake` default.
8. **periphery** (slice migration #4: `notification`, `user_settings`, `contact`, `answer`, `credential` + soft-delete `deleted_at`, `data_export_request`, deletion-grace fields): notifications, settings assembly, `getUsageAggregate` + monthSpendUsd **computed from `ai_run`** (one query feeds cap AND display; property test), library CRUD + trash/restore/purge, data export (synchronous for MVP: inline dump with a hard size cap; the 202 shape is honored with an immediately-ready URL -- recorded as an accepted MVP simplification), deleteAccount (grace-period fields; actual purge is a documented manual/cron follow-up).
9. **coach/agents read surfaces** (slice migration #5): threads/messages/context cards, agents/permissions/log; patchAgent (pause/run-now). **The 6 deferred ops stay mock-served**; `store.py` shrinks to deferred-op fixtures only.

**CORE-JOURNEY GATE (after step 7, not after everything):** `frontend/e2e/core-journey.spec.ts` -- fresh seed, fake provider: login -> manual job add -> shortlist -> application -> legal transitions to applied (resume required) -> illegal transition rejected with envelope -> deep score (synthetic envelope) -> resume locked. Required check in `playwright.yml`. Founder reviews here before periphery conversion continues.

## Phase B' -- ClaudeCLIProvider hardening (after the gate)

Per mvp-plan verbatim: exec-only, untrusted text via stdin, tools disabled, empty cwd, minimal env allow-list (asserted in tests -- no secrets/DB URL), `start_new_session=True`, timeout -> killpg SIGTERM->SIGKILL->reap, same kill path on CancelledError, bounded IO, outer envelope -> inner result validated. Tests: PATH-shim fake `claude` binary verifying process-group kill, env allow-list, timeout, malformed-output -> ProviderUnavailable (503, run failed, never fake-fallback). **Prompt-injection posture documented:** captured job text is untrusted input to prompts; system prompts instruct output-schema-only; outputs are schema-validated and never executed; this is recorded as a residual risk, not solved.

## Phase C -- Contract revision (capture + extension tokens), full governance

Runs the documented change process (`docs/mvp-plan.md:27-44`) as its own phase, only after the core journey is green:
1. `DECISIONS-NEEDED.md`: record the three rulings (captureJob semantics incl. dedup; token mint/revoke lifecycle; extension auth scheme) with founder sign-off.
2. `mvp-api.yaml` version/date bump + additive ops: `captureJob` (explicit **both** 201-created and 200-deduped responses declared, response carries `created: boolean` -- clients must distinguish; conditional validation per capturedVia), `mintExtensionToken` (named schema `MintExtensionTokenResult {token: ExtensionToken, secret}`; secret format `ebx_<id>_<32 urlsafe>`, stored via pwdlib hash), `revokeExtensionToken` (POST, 409 already-revoked; rows are audit history and keep appearing in `Settings.extensionTokens` -- the existing frozen schema already carries them, `mvp-api.yaml:2870-2907`). `components.securitySchemes` (bearerAuth + extensionToken header) and -- because Phase A already made every route enforce auth -- the top-level `security` default now matches reality.
3. `CONTRACT-NOTES.md` structured delta rows; manifest entries with slice/status/AI-flag/consumer/tests; drift expectation 89->92; every affected frontend function listed.
4. One regen chain commit (schemas.py + client + wire.ts) then implementation: `extension_token` table migration, `get_capture_principal` dep (JWT OR X-Extension-Token, captureJob only), captureJob against the Phase-A dedup index, mint/revoke, Settings panel UI (list/mint-with-one-time-secret-card/revoke), add-app wizard url/jd-text paths.
5. **Token security model (explicit):** hashed at rest, shown once, per-token `last_used_at`, revocation immediate (no cache), rate limits on mint/revoke/capture (slowapi or equivalent: per-user mint 10/day, capture 60/min), capture URL validation (http/https only, no private-network/localhost targets -- SSRF guard), token never logged (redaction test).

## Phase D -- Extension (one vertical slice, minimal surface)

`extension/` bun workspace, WXT. Popup mirrors the three mock states from `frontend/src/screens/extension`; `background.ts` posts capture with `X-Extension-Token`; `lib/extract/` = JSON-LD `JobPosting` first, og/meta fallback, then a **manual review/edit form before submit** (the reliability strategy -- no board DOM selectors in MVP); `lib/storage.ts` (token, apiBase, 10 recent captures). Permissions: storage, activeTab; capture on user gesture. Build: `wxt build -b chrome|firefox`, `wxt zip`; unpacked only, no store submission. Tests: vitest extractors on fixture HTML; one chromium Playwright e2e with `--load-extension`; Firefox manual checklist. Board-specific extractors: backlog, added per measured extraction failure.

## Phase E -- Productionization (what survives a future cloud move)

- `compose.production.yml`: immutable GHCR image tags (no build), Traefik with mkcert local TLS (the one piece of infra theater kept -- TLS behavior is worth testing), restart policies, resource limits, healthcheck/readiness split (`/api/v1/utils/health-check/` stays liveness; new readiness checks DB).
- `images.yml` workflow: buildx, trivy (fail CRITICAL/HIGH), push GHCR `:sha`.
- Backups: nightly `pg_dump -Fc` sidecar + `scripts/restore-drill.sh` (automated: restore into a scratch container, run the smoke script) -- CI-runnable weekly.
- Secrets: sops+age env files, documented schema of every required variable; `.env` never in images.
- Observability: structured JSON logs (ENVIRONMENT != local) with correlation IDs propagated into AI runs, Sentry (already wired, `backend/app/main.py:15-16`), log-redaction tests (tokens, passwords, secrets never in logs). Metrics stack deferred to real-prod.
- Deploy interface: `mise run deploy -- TAG=<sha>` against the production profile locally. **Stated honestly: this is CI + image publishing + a manual deploy command.** Real target selection (homelab k3s via the existing infra-repo conventions is the leading option) is a separate decision with its own plan.

## Phase F -- Close-out gates

- **FULL-CONTRACT GATE** in `test-backend.yml`: every contract op `implemented`+fidelity-passing or `deferred` with founder reason; silent omission fails CI.
- Frontend: remaining retired suites restored (any suite left is deleted with a reason, not silently excluded); grep-gate: no fixture imports on the app path.
- Fresh-clone drill: clone -> `docker compose watch` -> seeded working app -> core journey green.
- Docs: README/CLAUDE.md/backend README updated (AI envs, extension, production profile, skills); CHANGELOG entry per phase (feeds the learning session).

## Explicitly deferred (recorded, not forgotten)

Real cloud target + Terraform/Ansible (needs a target decision) - AnthropicAPIProvider - board extractors - metrics stack (Prometheus/Grafana) - async job runner (exports/deletion purge are synchronous/manual MVP simplifications) - store submission - GDPR-grade deletion design (grace fields exist; purge procedure documented as manual) - accessibility gate beyond the existing axe dev-check - SBOM/provenance.

## Risks

1. **Auth-boundary phase breaks the frontend mid-stream** -> it's one commit; `data/api.ts` already attaches the token to every request; the 41-suite restoration hasn't started so blast radius is the live adapter test + e2e, both run in the same commit.
2. **Per-resource test migration stalls** -> each resource's suite move is scoped by the recipe; the DB-free suite keeps covering unconverted resources the whole time.
3. **Applications port drifts from mock semantics** -> the behavior tests move with the resource and must pass unchanged before any are rewritten; exhaustive transition matrix (~144 pairs) ports as-is.
4. **claude_cli hardening gaps** -> PATH-shim process tests; fake is default everywhere; provider failure is 503 + failed run, never fallback.
5. **Estimate optimism** -> v1 said 22-26 sessions for strictly more scope; v2's honest range is **30-40 working sessions** (Phase B alone is 9 resource conversions x 1-2 sessions each), with the core-journey gate at roughly session 15-18 as the go/no-go checkpoint.

## Verification

Per commit: lint.sh, pytest (both suites), compose boot. Per resource: ownership matrix (collection filters, nested ids, FKs in bodies -- not just id-addressed 404s), envelope exactness, fidelity flip. Cross-phase: CORE-JOURNEY gate (mid-Phase B), FULL-CONTRACT gate (Phase F), restore drill (Phase E), fresh-clone drill (Phase F).
