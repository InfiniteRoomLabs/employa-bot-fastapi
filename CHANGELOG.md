# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sprint 02 shipped (B1 jobs, manual capture -- the first DB-backed vertical, merge b942a1f): the `job` table (migration `4c17ea8b5656`) as the exemplar under plan v3's binding Design conventions -- tenant `user_id` with a composite `UNIQUE(user_id, id)` anchor and `ON DELETE CASCADE`, PostgreSQL row-level security (`FORCE`, policy on a transaction-local `app.user_id` GUC) enforced under the non-owner `app_runtime` role, `timestamptz` columns, named JSONB CHECK constraints, an explicit `schema_version`, and the partial-unique dedup index reserved for later captureJob. `getJobs`/`getJob` are served from the database via a `TenantSession` dependency and `app/job_mapper.py`; manual capture (`createApplication`) persists a real caller-owned job row; the jobs screen's default view lists the DB collection while search-scoped views keep the mock inbox feed (`getJobsInbox` stays mock-served through Release 0.1). `frontend/e2e/core-journey.spec.ts` is born (login -> create job -> job lists, green from a fresh seed) and required in CI. Known gap: the shared mock Application/searches/resume/shortlist layer is not tenant-isolated (DEBT-5; structural fix when applications go DB-side in sprint-04). Full evidence + review ledger: `docs/progress.md`.
- Sprint 01 shipped (Phase 0 gates + Phase A foundation + v3 auth conventions, merge 0b83cd2): contract-first client/schema generation from `mvp-api.yaml` with a `generated-diff` CI gate; `migration-gates` and `manifest-validation` CI jobs (coverage gate relaxed to advisory); the `app_runtime` role + `enforce_append_only(regclass)` machinery with behavioral tests under `SET LOCAL ROLE`; one DB test world (outer-transaction rollback, explicit `db`/`client`/`db_client`/`intruder_client`/`seed_domain` fixtures, zero autouse); contract tests split per route module; the auth boundary (every mock route requires a bearer token; ONE normalized 401 envelope across missing/invalid/expired/unknown/inactive/garbage-sub; `getCurrentUser` served from the DB as the first implemented op); demo seed (`python -m app.scripts.seed [--reset]`, prestart-gated by `SEED_DEMO_DATA`); and the v3 auth conventions (login throttling before password verification, JWT `iss/aud/iat/nbf/jti/sv` claims with session-version invalidation, 60-minute tokens, fail-closed `SECRET_KEY` outside local, credential-free narrowed CORS, CSP header + build-time meta tag). Full evidence + review ledger: `docs/progress.md`.
- Sprint 01 run manifest recorded in `docs/progress.md` at S1 guard-on (run sprint-01-run-1 against GOAL.md/queue at 9d3a784): the completion audit for this run judges against the committed manifest, not later GOAL.md edits.

### Fixed

- Playwright CI: `Dockerfile.playwright` image (v1.58.2) had drifted behind the locked `@playwright/test` (1.61.1), so CI browsers were missing; image bumped to v1.61.1-noble and the container install is now `--frozen-lockfile` so future drift fails the build, not the run.
- The e2e smoke suite logs in once per run via a Playwright `globalSetup` (per-worker logins tripped the new per-IP login throttle) and sends the bearer token on its fixture-id fetches (mock routes now require auth).
- The smoke suite's console-error assertion filters `@axe-core/react`'s dev-only a11y logging -- on slow CI runners its debounced output landed before test end and flaked the suite (the a11y findings themselves are recorded as debt; the accessibility gate is deferred per plan v3). Verified: all four workflows green at 954bd00.

- Sprint-treadmill operating process activated for Release 0.1: `docs/plans/` committed (the v3 implementation plan + its four adversarial reviews, the hoyle-re goal-loop investigation, and `sprint-treadmill-process.md` -- the process spec, itself Codex-reviewed to SOUND-WITH-FIXES with a 14-finding ledger). Operating artifacts created: `docs/plans/loop-research/approved-queue.md` (Wes-only queue, rev 1: 5 sprints + terminal audit + pre-approved repair phase), `GOAL.md` (Sprint 01 work contract: Phase 0 gates + Phase A foundation + v3 auth conventions), `docs/progress.md` (resumable state scaffold). Sprint 01 is an attended dry run; nothing executes until `/goal` is invoked.

### Fixed

- Seeded job fixture URLs in the scaffold store now construct `AnyUrl` explicitly instead of passing raw strings past a type-ignore.
- `[tool.ty.environment] python = "../.venv"` in `backend/pyproject.toml`: ty roots at the backend pyproject and only auto-discovers a venv there, but the uv workspace keeps the shared `.venv` at the repo root — so ty run outside `uv run` (e.g. the PyCharm plugin) fell back to system site-packages and flagged every third-party import as unresolved.

### Changed

- Docs de-templated: root `README.md` rewritten for Employa-Bot (stack, quickstart, dev loops, project-document index), `CLAUDE.md` updated to the post-cleanup architecture, template `CONTRIBUTING.md` and `development.md` deleted (useful content folded into the READMEs).
- The generated OpenAPI client is retargeted at our own API: `scripts/generate-client.sh` + `openapi-ts` regenerate `frontend/src/client/` from the live backend OpenAPI (89 contract ops + auth/user/utils services) instead of the template's items/users surface. The `generate-frontend-sdk` pre-commit hook and the playwright-workflow generate step are restored to keep it synced. Migrating `src/data/api.ts` onto the generated client is follow-up work.
- The `app/scaffold/` namespace is dissolved into the normal backend layout: wire models at `app/schemas.py`, the in-memory store at `app/store.py`, the error envelope at `app/api/errors.py` (`ApiError`, `register_error_handlers`), one router per resource under `app/api/routes/` (`periphery.py` split into `notifications.py`, `settings.py`, `account.py`), aggregation inlined into `app/api/main.py`, and contract tests at `tests/contract/` (the empty `NOT_YET_SCAFFOLDED` ledger deleted, drift test now asserts the app serves all 89 contract ops). Mock-API docs moved from `app/scaffold/README.md` into `backend/README.md`.
- Alembic history squashed to a single `initial schema` migration (`3bae06a61157`) creating the `user` table with all profile fields. **Existing dev databases must be recreated** (`docker compose down -v && docker compose up -d --build`).

### Fixed

- Match-explorer's hardcoded fallback ids were pre-adapter legacy slugs (`distributed-systems`, `stripe-staff-engineer`) that 422 against the live backend's UUID-typed paths; they now use the `RESUME_ID_DISTRIBUTED` / `JOB_ID_STRIPE` fixture constants.
- The Playwright smoke suite (`frontend/e2e/smoke.spec.ts`) was dormant (the config's `testDir` pointed at the deleted template `tests/`) and had drifted: it now authenticates as `FIRST_SUPERUSER` before each route (real auth redirects unauthenticated visitors to `/login`), resolves application/agent ids from the live API instead of legacy slugs, and is wired up via `testDir: './e2e'`. All 35 routes pass.

### Removed

- Root/CI template residue: Copier machinery (`.copier/`, `copier.yml`, `hooks/`), template README screenshots (`img/`), upstream `release-notes.md` + its release-date pre-commit hook and script, `deployment.md`, `compose.traefik.yml`, `.vscode/`, and 10 inert GitHub workflows (deploys needing self-hosted runners, fastapi-org bots, labeler, smokeshow, detect-conflicts, guard-dependencies, pre-commit). Kept: test-backend, test-docker-compose, playwright (generate-client step dropped, single shard), zizmor, dependabot. Root `package.json` renamed to `employa-bot`; smokeshow dependency group and stale typos excludes dropped; biome pre-commit hook now invokes `bun run lint` (repo has no npm).
- Frontend template leftovers: the template Playwright suite (`frontend/tests/` -- old-UI selectors), unused deps (`@tanstack/react-query`, `form-data`, `dotenv`), and template svg assets.
- Template demo resource `Item`: routes (`/items`, `/private`), models, `crud.create_item`, the `User.items` relationship, and their tests. Template error-path tests now assert on the contract error envelope's `message` field (the app-wide handlers rewrite 404/409 bodies).

### Added

- Real login wired end-to-end: `User` gains profile fields (`initials`, `city`, `current`, `years`, `comp_floor`, `target_titles`; alembic `70eafafea7af`), the frontend data seam stores the JWT from `POST /login/access-token` and sends `Authorization: Bearer` on every request, auth failures (401, or 403 with the credential-validation detail) clear the token and redirect to `/login`, the login screen submits real credentials with inline error display, sign-out clears the token, and `getCurrentUser()` reads `/users/me`.
- Frontend data-seam swap: `frontend/src/data/api.ts` is now a real HTTP adapter over the scaffold backend (96 exports, `transitionApplication` added), with wire-to-app transforms in `src/data/wire.ts`, client-local presentation constants in `src/data/client-constants.ts`, and an HTTP-to-error-kind translator in `src/lib/mock-api-error.ts`. Base URL follows the template `VITE_API_URL` convention (no dev proxy). A gated integration test (`RUN_ADAPTER_IT=1`, backend on :8000 or `ADAPTER_IT_URL`) verifies seeded data, joined views, a transition round-trip with version bump, and 404 envelope translation against the live scaffold. 41 test files (148 tests) that asserted on the retired mock data layer are excluded in `vitest.config.ts` with a documented rationale; the remaining suite is green (323 passed).

- Scaffold backend phase 2: in-memory routes for the remaining contract operations, landed per resource group (periphery, resumes and lifecycle, jobs/shortlist/match, library, coach/agents with the 6 deferred operations as mock-parity stubs, applications/transitions), shrinking the `NOT_YET_SCAFFOLDED` ledger to zero.

- Scaffold backend phase 1 (`backend/app/scaffold/`): Pydantic v2 models generated from the frozen contract (121 classes, regeneration command in `app/scaffold/README.md`), in-memory fixture-seeded store with `reset()`, typed error hierarchy producing the contract error envelope via FastAPI exception handlers, searches resource as the pattern exemplar (4 operations), and DB-free scaffold tests including a contract-drift check driven by a `NOT_YET_SCAFFOLDED` ledger.
- Frontend integration commit: the mockup app (30 screens, components, hooks, mock data layer, tests) adopted wholesale under the template toolchain (Bun + Vite + Biome; React Router replaces TanStack Router). Template's generated OpenAPI client parked at `frontend/src/client/` for the later data-seam swap. 514 unit/component tests pass; build, lint, and dev server verified. `frontend/bunfig.toml` documents the lockfile-regeneration procedure under the machine-global frozen-lockfile policy.

- Frozen Slice 0 API contract (`mvp-api.yaml`): 89 operations normalized from the mockup review artifact per `docs/mvp-plan.md` (ISO-8601 timestamps, USD-number money fields, presentation fields removed or enum-kinded, UUID-only identity, shared error envelope wired as the `default` response on every operation, `AiRunEnvelope` on AI operations, settled 12-stage application taxonomy, new `transitionApplication` operation with optimistic concurrency).
- `CONTRACT-NOTES.md`: frontend adapter delta table plus AI-OPS and DEFERRED operation lists.
- `DECISIONS-NEEDED.md`: 10 category-(c) product decisions, all ruled by the founder on 2026-07-04 (recommended defaults accepted; `getCoachGreeting` removed from the contract as canned client copy).
- `docs/operation-ownership.yaml`: every operationId mapped to an owning slice with status, AI flag, frontend consumer, and required tests (6 operations deferred).
- `backend/tests/test_operation_manifest.py`: CI check validating the ownership manifest against the frozen contract.
- `docs/mvp-plan.md` and `CLAUDE.md` checked into the repository.
- `types-PyYAML` added to backend dev dependencies.
