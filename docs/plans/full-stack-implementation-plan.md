# Employa-Bot: Implement the Whole Thing -- MVP backend, extension, infra, CI/CD, agentic enforcement

## Context

The repo has a frozen 89-op API contract (`mvp-api.yaml`), a fully-adopted mockup frontend (30 screens) running against an **in-memory mock backend**, and only auth/users DB-backed. `docs/operation-ownership.yaml`: 83 planned / 0 implemented / 6 deferred (founder rulings of 2026-07-04 stand). The mission plan (`docs/mvp-plan.md`) defines the slice order, ownership rules, append-only trigger, AI-seam hardening, and seeding conventions -- all binding. This plan executes the entire remaining build: real persistence for all non-deferred ops, the AI layer, a cross-browser capture extension, locally-simulated staging/prod infrastructure (Terraform + Ansible), full CI/CD, and Claude Code workflow enforcement. The user will hand-refactor afterward and hold a learning session, so every phase records its decisions in CHANGELOG.md and the plan biases toward legible, convention-following code.

**Founder rulings captured this session:** (1) infra is LOCAL-ONLY simulation -- zero cloud spend, architected to retarget a real cloud by swapping provider/inventory; (2) extension is capture-only, Chrome + Firefox via WXT; (3) additive contract changes allowed (captureJob, extension-token mint/revoke, extension auth scheme) -- the 6 deferrals stay; (4) "agent-ops" = Claude Code hooks/skills enforcement + AgentOps-style telemetry for the product's own AI runs.

**Note:** `../employa-bot-front-end` is unreachable from this environment (repo-scoped token). Its load-bearing docs were already distilled into this repo's `mvp-api.yaml`, `CONTRACT-NOTES.md`, `DECISIONS-NEEDED.md`, and the adopted frontend -- sufficient to proceed.

**Verified spot-checks:** `_STATUS_TO_KIND` in `backend/app/api/errors.py:45` lacks a 403 entry (must add `403: Kind.unauthorized`); `tests/contract/conftest.py` no-op-db override is as described; `test_contract_drift.py:40` pins 89 ops (bump to 92 in Phase 1).

## Phase ordering (10 phases, each = 1-5 commits, lint+tests green at every commit)

Enforcement first (it guards everything after), contract change once (all regen churn happens a single time), then mvp-plan slice order, then frontend completion, extension, infra, CI/CD close-out.

---

## Phase 0 -- Agentic enforcement + CI baseline

**`.claude/` tree (new):**
- `settings.json` -- hooks: `PreToolUse` matcher `Edit|Write|MultiEdit` -> `hooks/guard-generated.sh`; `PostToolUse` same matcher -> `hooks/autoformat.sh`.
- `hooks/guard-generated.sh` -- reads tool-input JSON from stdin; if `file_path` matches `frontend/src/client/**`, `backend/app/schemas.py`, or `frontend/openapi.json` -> exit 2 with a pointer to `/contract-change` / `scripts/generate-client.sh` / `backend/README.md` regen docs.
- `hooks/autoformat.sh` -- `*.py` -> ruff fix+format; `*.{ts,tsx,css,json}` under frontend/extension -> biome; `*.tf` -> terraform fmt. Always exit 0.
- `skills/contract-change/SKILL.md` -- the full regen chain checklist: edit contract -> datamodel-codegen + post-gen fixup -> wire.ts/types.ts -> routes with explicit operation_id -> manifest + CONTRACT-NOTES -> generate-client.sh -> contract+manifest tests + bun lint.
- `skills/slice-done/SKILL.md` -- definition-of-done runner (lint.sh, pytest >=90% cov, fidelity for slice ops, ownership-404 present, bun test+build, compose smoke, migration-upgrade test); flips manifest statuses in the same commit.
- `skills/db-swap-resource/SKILL.md` -- the per-resource store->DB recipe (Phase 2.4).
- `skills/verify-stack/SKILL.md` -- compose up + seed + httpx happy-path per slice.
- `agents/diff-reviewer.md`, `agents/migration-author.md` (migration conventions inlined).

**CI/image baseline:** new `.github/workflows/lint.yml` running `uv run prek run --all-files` (includes generated-client freshness). Harden `backend/Dockerfile`: digest-pinned `python:3.14-slim`, non-root uid-10001 `app` user, checksum-pinned Claude CLI install behind build-arg `INSTALL_CLAUDE_CLI`. Frontend image -> digest-pinned `nginx-unprivileged`. Root `mise.toml` with task stubs (`test`, `lint`, `seed`, `smoke`, later `infra:*`, `deploy:*`).

**AgentOps product telemetry (decided here, lands in Phases 4/6/9):** first-class `ai_run` table; `getUsageAggregate` + Settings spend computed FROM it (single source of truth for cap + display); correlation-ID middleware + one structured JSON log line per AI run; Prometheus counters `ai_runs_total{op,provider,status}`, `ai_cost_usd_total{op,model}`, `ai_queue_depth`.

## Phase 1 -- Contract additions (89 -> 92 ops, run via /contract-change)

- **`captureJob`** `POST /jobs`: body `CaptureJobInput {capturedVia (JobCaptureMethod, required), url (required when url/extension), description (required when jd-text), title, company, summary, location, workMode, employment, compensation, seniority, tags, requirements, posted, searchId?}` -> 201 `Job` (200 on same-user+same-source-URL dedup), 422 conditional validation. Security: `bearerAuth` OR `extensionToken` (the only op accepting the extension scheme).
- **`mintExtensionToken`** `POST /settings/extension-tokens` `{label}` -> 201 `{token: ExtensionToken, secret: string}`; secret shown once, format `ebx_<id-hex>_<32 urlsafe>`, stored hashed.
- **`revokeExtensionToken`** `POST /settings/extension-tokens/{id}/revoke` -> 200 ExtensionToken with `revokedAt`; 404 cross-user; 409 already-revoked. (POST not DELETE -- rows are audit history, stay visible in Settings.)
- Add `components.securitySchemes` (`bearerAuth` JWT, `extensionToken` apiKey header `X-Extension-Token`) + top-level `security` default. Safe: fidelity only checks `implemented` ops.
- Mock-serve the 3 new ops first (jobs.py + settings.py + new `store._extension_tokens`) so the drift guard stays green; bump drift expectation 89->92. Manifest entries: captureJob -> slice 2; mint/revoke -> slice 2 (needed by the extension). CONTRACT-NOTES gets a dated additive-change section; DEFERRED list unchanged. New `tests/contract/test_capture_tokens.py`.
- One atomic commit (contract + schemas.py regen + client regen + wire.ts + mocks + manifest + tests).

## Phase 2 -- Slice 1: Foundation (DB conventions, core tables, auth, test conversion, seed)

**Conventions (binding for all slices):** every domain table `id uuid pk`, `user_id` FK indexed RESTRICT (CASCADE only owner->owned-child), `created_at/updated_at`; enums = VARCHAR + named CHECK; opaque sub-objects (SearchCriteria, JobLocation, Employment, Salary, rubrics, diffs) = JSONB validated at the route boundary by the generated models; models stay in flat `models.py` with per-slice sections; no downgrades; `tests/migrations/test_upgrade.py` upgrades from empty AND previous head.

**Slice-1 migration tables:** `saved_search` (name, state CHECK, criteria JSONB; counts derived per-request), `job` (company/title, location/employment/compensation JSONB, source_url + source_channel CHECK + source_captured_at, tags/requirements text[], match JSONB, search_id FK; partial unique `(user_id, source_url) WHERE source_url IS NOT NULL` for capture dedup), `shortlist_entry` (job_id FK, unique (user_id, job_id)), `application` (job_id FK, search_id FK, stage CHECK(12), version int, resume_id plain-uuid-until-slice-3, snapshot_id, outcome_at, flags JSONB), `stage_transition` (application_id CASCADE, from/to CHECKs, reason, source, supersedes_id self-FK; **append-only PL/pgSQL trigger** via `op.execute` rejecting UPDATE/DELETE), `interview_round`.

**Auth reconciliation:** converted routes take `SessionDep` + `CurrentUser`; every query `.where(user_id == current_user.id)`; foreign/unknown id -> `NotFoundError` (404). Add `403: Kind.unauthorized` to `_STATUS_TO_KIND` + envelope test. `getCurrentUser` flips to real CurrentUser -> first `implemented` op.

**Contract-test conversion -- convert in place, single DB-backed suite (no dual):** rewrite `tests/contract/conftest.py`: real engine; session-scoped persona + intruder users; per-test `store.reset()` AND truncate-domain-tables + `seed_domain(session, persona_id)` reusing the exact `store.py` fixture builders (byte-compatible data keeps the ~110 existing assertions passing); `client` bakes in a Bearer token minted directly via `security.create_access_token` (mock routes ignore it, DB routes require it -> both work mid-transition); `intruder_client` for ownership tests. Documented transitional seam: slice-2 transitionApplication validates resumeId against still-mock resumes until slice 3.

**Seed:** `app/seed.py` + `uv run python -m app.scripts.seed [--reset]` -- idempotent, persona users with known passwords, well-known UUIDs verbatim, relative timestamps -> seed-relative instants; wired into prestart behind `SEED_DEMO_DATA=true` (never CI). Smoke script `app/scripts/smoke.py` as `mise run smoke`.

**Contract-fidelity test** (`tests/contract/test_contract_fidelity.py`): normalized runtime-openapi vs contract comparison (strip /api/v1 + auto-422s, deref, canonicalize; compare operationId/params/bodies/responses/security) scoped to manifest `implemented` ops. Lands now so every later flip is guarded.

## Phase 3 -- Slice 2: Core loop on DB (per-resource in-place swaps via /db-swap-resource)

Order, one commit each: **searches** (derived counts via aggregates) -> **jobs + captureJob** (dedup via the partial unique index; inbox projection) -> **extension_token** (slice-2 migration #2: id/user_id/label/secret_hash/created_at/revoked_at/last_used_at; mint hashes via the pwdlib context; new `get_capture_principal` dep accepting JWT OR X-Extension-Token, applied only to captureJob; mint/revoke flip implemented) -> **shortlist** -> **applications** (port mock behavior verbatim: LEGAL_TRANSITIONS matrix, transitionApplication with `UPDATE ... WHERE version=?` optimistic concurrency -> 409, stage_transition insert per change, markWon/undo from the transition timestamp (300s -> 409 undo_window_expired), dismiss dual-mode, reactivate, timeline projection, application_view() join helper in crud) -> **interviews**, **archive**.

Swap recipe per resource: table exists -> port `_seed_*()` builders into `app/seed.py` -> rewrite router functions in place (same file, same operation_ids, same response models, + SessionDep/CurrentUser) -> delete the resource from `store.py` + `reset()` -> ownership-404 tests -> flip manifest -> fidelity covers it.

Tests: exhaustive parametrized transition matrix (~144 legal+illegal pairs), version conflict, undo expiry (frozen time), trigger rejection via direct SQL, ownership-404 per id-addressed op, envelope-exactness per error kind.

## Phase 4 -- Slice 3: Resumes + Match + the AI layer

**Migration:** `resume` (kind CHECK, body, tags[], partial-unique default per user, locked, forked_from_id, job_id, scoring_enabled), `resume_snapshot` (**same immutability-trigger pattern**), `resume_upload`, `career_history_item`, `resume_template` (global, no user_id), `projection`, `resume_export`, `match_report` (rubric/gaps JSONB, ai_run_id FK), **`ai_run`** (operation/provider/status CHECKs, queued/started/finished timestamps, estimated/actual_cost_usd numeric(10,6), tokens, error_category, prompt/schema_version, synthetic bool, correlation_id; index (user_id, finished_at)). Add the deferred application FK, drop the Phase-3 seam.

**`backend/app/ai/` package:** `provider.py` (ABC with exactly two methods: `deep_match_score`, `derive_accomplishment`), `models.py` (typed in/out + PROMPT/SCHEMA_VERSION), `prompts.py`, `claude_cli.py`, `anthropic_api.py`, `fake.py`, `factory.py`, `limiter.py` (Semaphore 2 + queue 4 -> 429), `runs.py` (run-record context manager: INSERT queued -> running -> finalize in `finally`; spawn failure -> failed/spawn_error; cap check = SUM(actual_cost_usd) over non-synthetic succeeded runs this month vs monthly_cap_usd -> 402), `pricing.py` ($/MTok table; also powers the NON-AI previewDeepMatchScore).

- **ClaudeCLIProvider** hardening per mvp-plan verbatim: exec-only (no shell), untrusted text via stdin, tools disabled, empty cwd, minimal env (no secrets/DB URL), `start_new_session=True`, wait_for timeout -> killpg SIGTERM->SIGKILL->reap, same kill path on CancelledError, bounded IO, outer JSON envelope -> inner result validated against the task output model.
- **AnthropicAPIProvider** (new, for sim-prod): `AsyncAnthropic().messages.parse(...)` structured output; cost from usage x pricing; SDK errors -> RateLimitedError/ProviderUnavailableError. Consult the `claude-api` skill for current model IDs/pricing at implementation time.
- **FakeProvider**: deterministic canned outputs; explicit-only; **never a fallback** (provider failure = 503 + run failed).
- Settings: `AI_PROVIDER: Literal["claude_cli","anthropic_api","fake"]="fake"`, model/timeout/concurrency knobs, `ANTHROPIC_API_KEY`.

**Routes:** resumes/resume_lifecycle/match converted (fork-as-draft, set-default swap, delete-blocked-when-locked 409, snapshot read); transitionApplication does the real snapshot+lock at APPLIED; `previewDeepMatchScore` pure arithmetic; `runDeepMatchScore` cap->limiter->provider->persist match_report + envelope.

**AI tests (`tests/ai/`):** factory, fake determinism, never-fallback 503, cap 402 (synthetic excluded), limiter 429, run lifecycle + cancelled-on-disconnect, **process-cleanup via PATH-shim fake `claude`** (killpg verified), anthropic provider with respx-mocked transport.

## Phase 5 -- Slice 4: derive-accomplishment + CORE-JOURNEY GATE

Pull `project` + `accomplishment` tables forward (small migration, noted in manifest). `deriveAccomplishmentFromProject` = same cap/limiter/run-record path; result persisted as draft accomplishment with backlink.

**GATE -- `frontend/e2e/core-journey.spec.ts`** (fresh seed, AI_PROVIDER=fake): login -> capture (jd-text wizard) -> shortlist -> create application -> legal transitions to applied (resume required) -> one illegal transition rejected with the invalid_transition envelope -> deep score with synthetic envelope -> resume locked on APPLIED. Required check in `playwright.yml`. Gate, not stop -- flag for founder review and continue.

## Phase 6 -- Slices 5+6: Periphery + Coach/Agents read surfaces

**Slice-5 migration:** `notification`, `user_settings` (1:1: monthly_cap_usd, plan/privacy/integrations/providers/routing/notif_prefs/email_parser_fallback JSONB), `contact`, `answer`, `credential` + soft-delete `deleted_at` on all library tables, `data_export_request`, deletion-grace fields on user. Conversions: notifications, settings (assembled from User + user_settings + extension_token rows), **getUsageAggregate + monthSpendUsd computed from `ai_run`** (the AgentOps deliverable -- one query feeds cap AND display; property test comparing them), data export, deleteAccount, full library CRUD + trash/restore/purge/deletionImpact.

**Slice-6 migration:** `coach_thread`/`coach_message`/`coach_context_card`, `agent`/`agent_permission`/`agent_log_entry`. Convert the read surfaces + patchAgent (pause/run-now only). **The 6 deferred ops remain mock-served exactly as today** (drift guard needs them served; manifest keeps `deferred` so fidelity ignores them; code comment marks the founder deferral).

End state: `store.py` reduced to deferred-op fixtures only; manifest 86 implemented / 6 deferred.

## Phase 7 -- Frontend completion

1. Wire the 3 new ops through `data/api.ts` + `wire.ts`; extension-tokens panel gets real list/mint(one-time-secret card)/revoke; add-app wizard's url/jd-text paths call captureJob then continue to createApplication.
2. **Re-enable the 41 retired vitest suites via MSW** (decided; live-backend stays as the gated `adapter.integration.test.ts`): `src/test/msw/server.ts` + per-resource handlers returning contract wire shapes built from `fixtures.ts`; remove the vitest.config.ts exclusion list in batches; suites asserting mock-internal state either get stateful handlers or move to backend tests (bias backend).
3. Dashboard/usage/coach(read-only, proposal UI disabled)/notifications verified against compose; grep-gate: no fixture imports on the app path.

## Phase 8 -- Browser extension (`extension/` bun workspace, WXT)

- Entrypoints: `background.ts` (does the capture POST), popup (mirrors the three mock states in `frontend/src/screens/extension` -- signed-out paste-token / detected job card + Capture / empty + recent captures), content scripts per board (linkedin, indeed, greenhouse, lever, ashby) + `generic.content.ts`.
- `lib/extract/` = pure `(Document) -> DetectedJob | null` functions, JSON-LD `JobPosting` first, board DOM selectors as enrichment, og/meta fallback; `lib/api.ts` posts to `{base}/api/v1/jobs` with `X-Extension-Token`; `lib/storage.ts` (token, apiBase, 10 recent captures). Intentionally decoupled from `frontend/src` (own minimal wire types, documented).
- Permissions: storage, activeTab, host permissions for the five boards; generic capture on user gesture via scripting API.
- Build: `wxt build -b chrome|firefox`, `wxt zip` artifacts -- unpacked/zip only, no store submission. Tests: vitest extractors against saved fixture HTML; one chromium Playwright e2e with `--load-extension`; Firefox = manual `web-ext run` checklist in extension/README.md.

## Phase 9 -- Infra: local-only simulation

```
infra/
  terraform/modules/{env-network,node}/ + envs/{staging,prod}/   # kreuzwerker/docker provider, local state;
      # node = systemd-capable container with sshd (the "VM"); prod = 2 nodes to force real inventory shape
  ansible/{inventories (generated from terraform output via scripts/tf-to-inventory.py), roles/{base,docker,traefik,app_stack,pg_backup,monitoring}, playbooks/{site,deploy,backup-restore-drill}.yml}
  pki/make-ca.sh          # mkcert local CA, *.employa.local / *.staging.employa.local + /etc/hosts snippet
  secrets/                # sops + age per-env env files; documented upgrade path
```

- Ansible runs over **real SSH** into the node containers (port-mapped) -- the true prod motion; DinD privileged mode is the accepted local-sim compromise, documented in infra/README.md. Module/inventory boundary = exactly what swaps for a real cloud later.
- `app_stack` templates per-env compose files, pulls GHCR images, prestart runs `alembic upgrade head` (+ seed on staging only).
- Monitoring: prometheus + grafana + cadvisor + node_exporter + postgres_exporter; backend gains JSON structured logs (ENVIRONMENT!=local), `/metrics` via prometheus-fastapi-instrumentator, the Phase-0 AI counters; provisioned Grafana dashboards.
- `pg_backup`: nightly `pg_dump -Fc`, 7-day rotation, restore-drill playbook.
- Entry points: `mise run infra:up staging`, `mise run deploy staging -- TAG=<sha>`, `mise run infra:down`, `mise run backup:drill`.
- **CI/CD hand-off stated honestly:** GitHub Actions builds/scans/pushes images and runs all gates; deploy is a local command (hosted runners can't reach a laptop). Future options (self-hosted runner, webhook-pull) documented, not built.

## Phase 10 -- CI/CD completion + FINAL GATE

Workflows: `lint.yml` (prek all-files + client freshness) - `test-backend.yml` extended (pytest+Postgres, cov >=90%, drift 92, manifest, fidelity, migration-upgrade, AI tests w/ fake) - `test-frontend.yml` (bun test MSW+storybook, build) - `playwright.yml` extended (smoke + core-journey) - `extension.yml` (vitest, both builds, zips, chromium e2e) - `infra.yml` (terraform fmt/validate both envs, ansible-lint; heavy full-sim job on workflow_dispatch) - `images.yml` (buildx, **trivy fail on CRITICAL/HIGH**, push GHCR :sha/:latest) - keep zizmor + compose smoke.

**FINAL FULL-CONTRACT GATE** (in test-backend.yml): every contract op `implemented`+fidelity-passing or `deferred` with founder reason -- silent omission fails CI. Plus: founder journey green on reset seed; fresh clone -> compose watch -> seeded working app; `mise run infra:up staging` green + smoke over TLS; extension zips capture against staging-sim (manual checklist); README/CLAUDE.md updated (extension, infra, AI envs, hooks) + CHANGELOG per phase (feeds the learning session).

## Final table inventory

`user` (extended) - saved_search - job - shortlist_entry - application - stage_transition(trigger) - interview_round - extension_token - resume - resume_snapshot(trigger) - resume_upload - career_history_item - resume_template(global) - projection - resume_export - match_report - ai_run - project - accomplishment - notification - user_settings - contact - answer - credential - data_export_request - coach_thread - coach_message - coach_context_card - agent - agent_permission - agent_log_entry. One migration per slice, no downgrades, upgrade-path tests.

## Key risks & mitigations

1. **92-op scope stall** -> per-resource in-place swaps keep the app shippable at every commit; drift test guarantees nothing is un-served; manifest tracks progress exactly.
2. **Contract-test conversion breaks ~110 assertions** -> DB seed reuses the same store.py fixture builders (byte-identical data); conftest converts first while mocks still serve.
3. **Regen churn** -> single contract change (Phase 1); PreToolUse guard + pre-commit/CI freshness diff.
4. **claude_cli hardening gaps** -> process-group kill tests with PATH-shim, env allow-list asserted, fake is the default everywhere.
5. **Cap-vs-display drift** -> one ai_run aggregation feeds both; property test.
6. **Truncate+seed too slow** -> per-slice table scoping; SAVEPOINT rollback fallback where triggers allow.
7. **Board DOM churn / MV3-Firefox quirks** -> JSON-LD-first extractors + fixture-HTML tests; capture logic in pure lib modules; Firefox manual checklist.
8. **Ansible-into-containers flakiness** -> pinned node image, idempotent site.yml, heavy sim job not a PR gate.

## Verification

Per phase: `/slice-done` (lint.sh, pytest >=90%, fidelity, ownership-404s, bun test+build, compose smoke, migration-upgrade). Cross-phase gates: CORE-JOURNEY Playwright after Phase 5; FINAL FULL-CONTRACT GATE + infra smoke + extension capture checklist at Phase 10.

Estimated effort: ~22-26 working sessions. Critical files: `mvp-api.yaml`, `backend/app/store.py`, `backend/app/api/routes/applications.py`, `backend/tests/contract/conftest.py`, `docs/operation-ownership.yaml`, `backend/app/api/errors.py`, `frontend/src/data/{api,wire,types}.ts`, `vitest.config.ts`.
