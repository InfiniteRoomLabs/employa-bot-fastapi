# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Seeded job fixture URLs in the scaffold store now construct `AnyUrl` explicitly instead of passing raw strings past a type-ignore.
- `[tool.ty.environment] python = "../.venv"` in `backend/pyproject.toml`: ty roots at the backend pyproject and only auto-discovers a venv there, but the uv workspace keeps the shared `.venv` at the repo root — so ty run outside `uv run` (e.g. the PyCharm plugin) fell back to system site-packages and flagged every third-party import as unresolved.

### Changed

- The `app/scaffold/` namespace is dissolved into the normal backend layout: wire models at `app/schemas.py`, the in-memory store at `app/store.py`, the error envelope at `app/api/errors.py` (`ApiError`, `register_error_handlers`), one router per resource under `app/api/routes/` (`periphery.py` split into `notifications.py`, `settings.py`, `account.py`), aggregation inlined into `app/api/main.py`, and contract tests at `tests/contract/` (the empty `NOT_YET_SCAFFOLDED` ledger deleted, drift test now asserts the app serves all 89 contract ops). Mock-API docs moved from `app/scaffold/README.md` into `backend/README.md`.
- Alembic history squashed to a single `initial schema` migration (`3bae06a61157`) creating the `user` table with all profile fields. **Existing dev databases must be recreated** (`docker compose down -v && docker compose up -d --build`).

### Fixed

- Match-explorer's hardcoded fallback ids were pre-adapter legacy slugs (`distributed-systems`, `stripe-staff-engineer`) that 422 against the live backend's UUID-typed paths; they now use the `RESUME_ID_DISTRIBUTED` / `JOB_ID_STRIPE` fixture constants.
- The Playwright smoke suite (`frontend/e2e/smoke.spec.ts`) was dormant (the config's `testDir` pointed at the deleted template `tests/`) and had drifted: it now authenticates as `FIRST_SUPERUSER` before each route (real auth redirects unauthenticated visitors to `/login`), resolves application/agent ids from the live API instead of legacy slugs, and is wired up via `testDir: './e2e'`. All 35 routes pass.

### Removed

- Frontend template leftovers: the generated OpenAPI client (`src/client/`, `openapi-ts.config.ts`, `scripts/generate-client.sh`, the `generate-client` script) which had zero importers in the app, the template Playwright suite (`frontend/tests/` -- old-UI selectors), unused deps (`@hey-api/openapi-ts`, `@tanstack/react-query`, `axios`, `form-data`, `dotenv`), template svg assets, `MAILCATCHER_HOST` from `frontend/.env`, and stale biome ignores.
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
