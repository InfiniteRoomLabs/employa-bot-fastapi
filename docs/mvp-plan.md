# Mission: Employa-Bot MVP v1 -- implement the mockup for real

Turn this repo (forked FastAPI Full Stack template) into the first working MVP of Employa-Bot by implementing the API contract and adopting the mockup UI from the sibling repo `../employa-bot-front-end` (read-only reference -- never modify it).

## Source of truth, in priority order

1. **`mvp-api.yaml`** (repo root) -- the API contract. **As committed it is still a mockup-derived review artifact, not implementation-ready** -- Slice 0 below freezes it into a real contract. After Slice 0, the frozen contract wins every dispute.
2. **`../employa-bot-front-end/src/data/types.ts` + `src/data/api.ts` + `src/data/fixtures.ts`** -- exact shapes, behaviors, and seed data the UI expects.
3. **`../employa-bot-front-end/docs/wiring-guide.md`** -- 1:1 mapping from each frontend hook to its backend resource. Load-bearing: it defines the swap-seam strategy the frontend adoption relies on.
4. **`../employa-bot-front-end/docs/product/story-map/state-machines.md`** -- lifecycle/transition rules. **Only the application-stage machine and interview records are settled/normative.** Research-run, rescission-rollback, and proposal-approval sections are explicitly unresolved stubs: do NOT implement them, do NOT infer missing transitions. During Slice 0, compile every question these blocks into `DECISIONS-NEEDED.md` -- each with a recommended default and its consequence -- and present the whole batch to the founder ONCE for ruling. Ruled items get frozen into the contract; unruled items stay contractually deferred (see the deferred list mechanism below).
5. This repo's `CLAUDE.md` -- template conventions (SQLModel, uv, Bun, test/lint scripts). Follow them; don't fight the template.

## Orchestration model (you are the orchestrator)

You (Fable) orchestrate; subagents implement. Do not write implementation code in the main loop -- dispatch it.

- **Dispatch policy**: use the Agent tool with explicit model selection. `model: "opus"` (Opus 4.8) for complex programming -- the Slice 0 contract revision, domain models + migrations, state-machine enforcement, exception-handler error envelope, the AIProvider seam, the frontend API-seam swap. `model: "sonnet"` for everything else -- boilerplate CRUD routes, seed-data porting, test scaffolding, docs, scripts, mechanical work following an established pattern.
- **Review every step**: after each subagent returns, review its diff yourself before moving on -- contract fidelity against the frozen `mvp-api.yaml`, state-machine correctness, ownership enforcement, template-convention adherence. For complex slices, also dispatch an independent reviewer subagent (Sonnet) that reads the diff cold; you adjudicate. Nothing merges into a slice commit unreviewed.
- **Escalation rule**: when a subagent hits an unsettled product decision (unresolved state machine, ambiguous contract shape, scope question), it must NOT invent an answer. Log it in `DECISIONS-NEEDED.md` and either proceed on the narrowest reversible interpretation or skip.
- **Slice gate**: a slice is done only when lint + tests pass and you have personally verified the definition-of-done items. Then commit and move on.
- Parallelize independent subagent work within a slice where safe, but never two agents writing the same files.

## Slice 0 -- freeze the contract (do this FIRST, nothing else until it's committed)

`mvp-api.yaml` still contains mock-isms and gaps. Produce a revised, frozen contract under these deterministic rules:

- **Normalization rules (fixed, not discretionary)**:
  - Timestamps: ISO-8601 `date-time`, UTC, everywhere. No relative strings.
  - Money: plain JSON number in USD, field name suffixed `Usd` (e.g. `costUsd`, `monthSpendUsd`), up to 6 decimal places (LLM costs are sub-cent). No currency objects, no formatted strings.
  - Tokens/counts: integers.
  - Presentation fields: **removed** when pure UI copy or icon names (`icon`, button/toggle label rows); **replaced by an enum `kind`** when they encode a semantic distinction the UI needs. When in doubt: does the frontend branch on it? Enum. Does it only display it? Remove.
- **Normalization boundary -- representation only, never invention.** Classify every change as: (a) representation-only (normalize freely), (b) already ruled by settled state machines / locked founder decisions (apply the ruling), or (c) requires a product decision (goes to `DECISIONS-NEEDED.md`; the affected operations enter the **deferred list** and are NOT frozen as implementable). Slice 0 may not invent unresolved behavior to make an operation look implementable.
- **Contract-delta table**: `CONTRACT-NOTES.md` is a structured table, one row per changed shape: mockup field -> frozen wire field -> adapter transformation -> affected `api.ts` functions -> affected tests. This is the frontend adapter's work order, not prose.
- **Add the missing core operation**: `POST /applications/{id}/transitions` with target stage, reason, source, resume id where required, and the resulting application + transition record in the response. Concurrency: integer `version` on Application, `expectedVersion` in the request, mismatch -> 409 `conflict`. Resume snapshot side effect at APPLIED specified in the operation description. Without this the core loop is unbuildable -- the current spec only has timeline reads and special-case actions.
- **UUID-ify stragglers**: `/shortlist/{role}` and any `{ref}`-addressed operations get real UUID identity, consistent with the UUID-only rule.
- **Define once, reference everywhere**: the error envelope schema (MockApiError kind -> HTTP status mapping) and an `AiRunEnvelope` (provider, model, status, timing, `estimatedCostUsd`/`actualCostUsd`, `synthetic` flag) as shared components.
- **AI execution model is frozen here: synchronous.** Every AI operation blocks and returns its result with the `AiRunEnvelope` embedded in the response. No polling endpoints, no `/ai-runs/{id}`, no product-visible queued states in MVP -- async orchestration is a deferred decision. (Run *records* are still persisted server-side as telemetry; see AI ground rules.)
- **Enumerate the AI operations**: list exactly which contract operations invoke AI. The AIProvider interface is derived from THIS list -- no invented provider methods for endpoints that don't exist.
- **Operation-ownership manifest**: create `docs/operation-ownership.yaml` containing every frozen `operationId` exactly once, each with: owning slice, implementation status (`planned|implemented|deferred`), AI/non-AI, frontend consumer (hook/screen), required tests. A CI check validates the manifest is complete against `mvp-api.yaml` and free of duplicates. Deferred entries carry the founder-approved reason.
- Cross-check the revised contract against `src/data/api.ts` + the wiring guide so no consumed operation was dropped.

Founder review of the Slice-0 `DECISIONS-NEEDED.md` batch must explicitly approve either a ruling or a deferral for every decision-required operation -- silence is not approval.

Commit the frozen contract + manifest before any implementation slice starts.

## Ground rules

- **Contract-first.** Route paths, methods, request/response shapes come from the frozen `mvp-api.yaml`. Spec/mockup disputes: spec wins; log in `CONTRACT-NOTES.md`.
- **Ownership is Slice-1 architecture, not an afterthought.** Every domain table carries an owner (`user_id` FK for MVP -- no separate account entity yet). Every query is ownership-scoped; cross-user access returns 404. Every resource class gets a cross-user access test. Do not leave this to CRUD subagents to remember.
- **Do NOT implement**: `getUserMenu`, `getExtensionState`, `getBudgetSnapshot`, `__resetForTests`, failure injection -- mock-only, excluded from the contract.
- **Keep the template's auth/user system** (JWT, users table, password reset). Map fixture personas onto seeded users with known credentials.
- **Append-only enforced in the database, not by convention**: stage transitions are insert-only via a PostgreSQL trigger that rejects UPDATE/DELETE (tested with direct SQL); corrections are compensating transitions referencing the prior row. Resumes lock on APPLIED via snapshot. DB constraints over app code wherever possible.
- **Error envelope via FastAPI exception handlers, not middleware**: typed domain exceptions registered as handlers, plus handlers for `RequestValidationError` and `HTTPException` so validation/auth errors wear the same envelope. Middleware only for correlation IDs and last-resort 500s. One exact envelope test per error kind (`not_found`, `validation_error`, `conflict`, `cap_reached`, `undo_window_expired`, `invalid_transition`, `rate_limited`, `provider_unavailable`, `unauthorized`).
- **AI goes through one seam** -- `AIProvider` ABC in `app/ai/provider.py`, one typed (Pydantic in/out) method per AI operation enumerated in Slice 0. Implementations:
  - `ClaudeCLIProvider`: shells out to `claude -p` via `asyncio.create_subprocess_exec`. Hardening is non-negotiable: no shell interpolation (untrusted text via stdin); CLI tools fully disabled; dedicated empty working directory; minimal environment (no app secrets, no DB URL, no JWT secret); bounded stdin/stdout sizes; per-task hard timeout with process-group terminate->kill->reap; the same kill path runs on client disconnect/request cancellation; a bounded-concurrency semaphore (default 2) with a bounded wait queue (default 4, overflow -> 429 `rate_limited`); `--output-format json` treated as an outer envelope whose inner result is validated against the task's Pydantic output model. If the run record persists but the spawn fails, the record is marked `failed` with error category `spawn_error` -- never left dangling. Process cleanup (no orphans after timeout/cancel) has its own test.
  - `FakeProvider`: canned fixture-grade output -- selected **only** explicitly (tests, CI, demos). **Never a silent fallback**: if `AI_PROVIDER=claude_cli` and the CLI is unavailable or fails, the endpoint returns a typed `provider_unavailable` error (503).
  - Selection via settings enum (`AI_PROVIDER=claude_cli|fake`) resolved in one factory -- the BYOAI seam; future providers are new subclasses, zero call-site changes.
  - **Every AI invocation persists a run record** -- infrastructure telemetry, NOT product state (the product-visible research-run machine is an unresolved founder decision; run records must not leak into product UX as workflow states). Fields: provider, model, status `queued|running|succeeded|failed|cancelled`, timing, cost fields, error category, prompt/schema version, and `synthetic` (true iff provider=fake). Written before execution, updated after. Synthetic runs/results persist only flagged `synthetic=true` and can never satisfy approval or evidence checks. Model output never directly authorizes writes or approvals.
- **Seeding**: an idempotent `seed` command (Python, in the app package) invoked from the template's prestart **only when `SEED_DEMO_DATA=true`** (local compose default true; never in tests/CI). Stable well-known UUIDs (the three saved-search UUIDs from the mockup fixtures), persona users with known passwords, relative fixture timestamps converted to ISO instants relative to seed time. A destructive reset requires an explicit flag.

## Build order (vertical slices; commit per slice; migrations authored per slice, not up front)

1. **Foundation**: template plumbing + ownership pattern + ONLY the core-loop tables (User mapping, SavedSearch, Job, Application, StageTransition, Resume link surface), exception-handler error envelope, seed command + prestart wiring. Later slices add their own tables when their behavior is settled -- no speculative schema. Migration conventions fixed here: index every ownership FK and hot lookup column; FK delete policy is RESTRICT by default, CASCADE only owner->owned-child; evolvable enums are `VARCHAR` + CHECK constraint (not PG enum types); **no downgrade support** -- dev recovers via seed reset, and every migration is tested by upgrading from empty AND from the previous slice's head.
2. **Core loop**: saved searches -> job capture (manual/paste) -> jobs inbox -> shortlist -> applications + the general transition endpoint + append-only audit log + DB trigger. This is the product.
3. **Resumes + match scoring**: corpus/masters/uploads per contract, snapshot + lock-on-APPLIED, match scoring through `AIProvider`.
4. **Research + cost preview**: the research operations from the Slice-0 AI list, synchronous per the frozen execution model, cost preview before execution, `AiRunEnvelope` embedded in responses.

**-- CORE-JOURNEY GATE --** After Slice 4: one Playwright end-to-end founder journey against a freshly reset seed -- login -> capture a job -> shortlist -> create application -> legal stage transitions (and one illegal transition rejected with the right envelope) -> match score -> resume locks on APPLIED. This journey passing is the hard quality bar for the core loop. It is a **gate, not a stop**: once it passes, flag it for founder review and proceed immediately to slices 5-6 -- the goal is as much of the full MVP surface completed as possible.

5. **Periphery**: notifications, archive, settings, dashboard aggregates, onboarding, library.
6. **Coach + agents**: endpoints per contract, AIProvider-backed. The proposal-approval machine is one of the unresolved stubs -- implement it only if the founder ruled on it in the Slice-0 `DECISIONS-NEEDED.md` batch; otherwise those operations stay on the deferred list. Nothing here gets invented.

## Frontend strategy -- adopt the mockup app, swap its seam (do NOT port screen-by-screen)

The mockup was engineered so that screens, components, routes, hooks, types, and tests survive the backend swap; only `src/data/api.ts` changes (see the wiring guide). Honor that:

- **Router decision (made -- do not revisit): the mockup's React Router stays; the template's TanStack Router goes.** Keep the template's Bun package manager, generated OpenAPI client, auth client, and TanStack Query availability -- but the app shell, routes, and screens are the mockup's.
- **Integration commit first**: before any feature work, one commit that reconciles `package.json`, Vite config, TypeScript config, Tailwind, Vitest/Storybook, and Playwright between the two frontends. Exit criteria: the copied mockup app builds under the template toolchain and its existing tests pass, still running against its mock `api.ts`. Only then start swapping the seam.
- Replace `src/data/api.ts` with a real HTTP adapter over the generated OpenAPI client, following the Slice-0 contract-delta table row by row. Keep the existing hook interfaces (`HookState<T>`) -- introduce TanStack Query behind them only where it clearly pays.
- Integrate the template's JWT auth (login screen, token handling, authenticated client) around the mockup app shell.
- Keep the mockup's URL shape (`/searches/<uuid>/...`). Preserve the `-eb` rule: never edit vendored shadcn primitives.
- Delete fixture imports from the app path as each slice's real endpoints land; fixtures survive only in the seed script and tests.

## Contract fidelity checks (replace naive spec-diffing)

- **Client generation is contract-first**: change `scripts/generate-client.sh` to consume the frozen `mvp-api.yaml` directly (today it dumps `app.main.app.openapi()`, which can't produce a client for routes that don't exist yet). The runtime spec is what gets *compared against* the contract, not what generates the client.
- Set explicit `operationId`s on every FastAPI route, matching the frozen contract.
- One normalized comparison test: fetch runtime `/openapi.json`, strip the `/api/v1` prefix and framework-injected artifacts (auto-422 validation responses, framework schemas), fully dereference `$ref`s and canonicalize (sorted keys, normalized `oneOf`/`anyOf` ordering), then compare per operation: operationId, parameters, request body schema, response schemas (including `required`, `nullable`, `enum` values, defaults), declared statuses, and security requirements. Scope: the operations marked `implemented` in `docs/operation-ownership.yaml`.
- **Final full-contract gate**: at the end, every operation in the frozen contract must be either `implemented` (and passing the comparison) or `deferred` with a founder-approved reason in the manifest. Silent omission is a CI failure.
- The generated TypeScript client must compile after each regeneration; the frontend adapter gets contract tests against recorded response shapes.

## "Staging" = the existing local compose stack

- No new deploy config. Acceptance testing happens against `docker compose watch` on this machine.
- Backend image: create a **non-root user**; install a **pinned version** of Claude Code CLI with a recorded artifact checksum verified at build time (no unpinned `curl | bash` in the image build).
- Host auth, dev-only, via `compose.override.yml` (never the base file): bind-mount host `~/.claude/` and `~/.claude.json` into the container user's home, read-write (the CLI refreshes tokens). Explicit `${HOME}`-based paths; gate the whole arrangement behind an explicit compose profile (e.g. `--profile ai`) so the default stack runs with `AI_PROVIDER=fake` and no credential mounts. A startup preflight (when `AI_PROVIDER=claude_cli`) verifies the mounts exist, are readable/writable by the container uid, and `claude --version` runs -- failing fast with a clear message, never degrading silently. **Accepted risk, recorded here**: the web process can read the mounted subscription credentials; acceptable for a single-founder dev laptop, revisit before any multi-user or hosted deployment (a credentialed sidecar is the known upgrade path). Smoke: `docker compose exec backend claude -p "say ok"`.
- Deliver also, as **Python scripts in the uv environment** (not bash -- `uv run python -m app.scripts.<name>`, reusing app models/session/settings and existing `httpx`): the seed/reset command and a smoke script (health + login + one endpoint per slice). Expose both as mise tasks. Bash stays only where the template already uses it (`scripts/lint.sh`, `scripts/test.sh`).

## Definition of done (per slice, then overall)

- `bash backend/scripts/lint.sh` and backend tests green. State machines and error mapping tested exhaustively **for the settled machines**: every legal and illegal application-stage transition, snapshot-at-APPLIED, append-only trigger rejection via direct SQL.
- Ownership tests: cross-user access to every resource class in the slice returns 404.
- The normalized contract-fidelity test passes for every manifest operation owned by the slice and marked `implemented`.
- Frontend screens for the slice run against the real backend via `docker compose watch` -- no fixture imports left on the app path.
- Fresh clone -> `docker compose watch` (with `SEED_DEMO_DATA=true`) -> seeded, working app.
- Overall: the acceptance-gate Playwright founder journey passes against a reset seed.

Start in plan mode: read the five sources above, then present your Slice 0 contract-revision plan before touching anything.
