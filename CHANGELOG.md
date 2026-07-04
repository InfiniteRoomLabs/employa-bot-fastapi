# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Scaffold backend phase 1 (`backend/app/scaffold/`): Pydantic v2 models generated from the frozen contract (121 classes, regeneration command in `app/scaffold/README.md`), in-memory fixture-seeded store with `reset()`, typed error hierarchy producing the contract error envelope via FastAPI exception handlers, searches resource as the pattern exemplar (4 operations), and DB-free scaffold tests including a contract-drift check driven by a `NOT_YET_SCAFFOLDED` ledger.
- Frontend integration commit: the mockup app (30 screens, components, hooks, mock data layer, tests) adopted wholesale under the template toolchain (Bun + Vite + Biome; React Router replaces TanStack Router). Template's generated OpenAPI client parked at `frontend/src/client/` for the later data-seam swap. 514 unit/component tests pass; build, lint, and dev server verified.

- Frozen Slice 0 API contract (`mvp-api.yaml`): 89 operations normalized from the mockup review artifact per `docs/mvp-plan.md` (ISO-8601 timestamps, USD-number money fields, presentation fields removed or enum-kinded, UUID-only identity, shared error envelope wired as the `default` response on every operation, `AiRunEnvelope` on AI operations, settled 12-stage application taxonomy, new `transitionApplication` operation with optimistic concurrency).
- `CONTRACT-NOTES.md`: frontend adapter delta table plus AI-OPS and DEFERRED operation lists.
- `DECISIONS-NEEDED.md`: 10 category-(c) product decisions, all ruled by the founder on 2026-07-04 (recommended defaults accepted; `getCoachGreeting` removed from the contract as canned client copy).
- `docs/operation-ownership.yaml`: every operationId mapped to an owning slice with status, AI flag, frontend consumer, and required tests (6 operations deferred).
- `backend/tests/test_operation_manifest.py`: CI check validating the ownership manifest against the frozen contract.
- `docs/mvp-plan.md` and `CLAUDE.md` checked into the repository.
- `types-PyYAML` added to backend dev dependencies.
