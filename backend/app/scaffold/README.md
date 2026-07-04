# Scaffold backend (in-memory MVP)

Server-side port of the mockup's mock data layer. It serves the **frozen** `mvp-api.yaml` contract from ported fixture data with **no database** and **no AI provider**, so the mockup UI can run against real FastAPI routes. The real persistence/AI implementation replaces this later.

- Models are **generated** from `mvp-api.yaml` (see below) -- they ARE the wire shapes (camelCase field names, verbatim).
- `store.py` holds one in-memory dict per resource, seeded from ported fixtures.
- `errors.py` maps typed domain errors to the contract `Error` envelope.
- `routes/` has one router per resource; `routes/searches.py` is the **pattern exemplar** -- copy it.
- `router.py` aggregates the resource routers; it is included in `app/api/main.py` (inherits `/api/v1`).

## Regenerating the models (one copy-paste)

Run from `backend/`. Then apply the one deterministic post-gen fixup below.

```bash
uv run datamodel-codegen \
  --input ../mvp-api.yaml \
  --input-file-type openapi \
  --output app/scaffold/models.py \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.14 \
  --use-standard-collections \
  --use-union-operator \
  --use-schema-description \
  --use-field-description \
  --field-constraints \
  --disable-timestamp \
  --use-double-quotes \
  --collapse-root-models \
  --formatters black isort

# Post-gen fixup: codegen emits a StrEnum default as a bare str, which mypy
# (strict) rejects. Retype it to the enum member so the file stays mypy-clean.
sed -i 's/    source: TransitionSource | None = "user"/    source: TransitionSource | None = TransitionSource.user/' app/scaffold/models.py
```

Field names are kept **camelCase (verbatim from the contract)** on purpose -- no
`--snake-case-field`. The models serialize exactly to the wire contract, so no
aliasing is needed. Ruff does not enforce PEP8 naming (`N` not selected), so
camelCase attributes are lint-clean.

After regenerating, verify:

```bash
uv run ruff check app/scaffold && uv run ruff format --check app/scaffold && uv run mypy app/scaffold
uv run pytest tests/scaffold -q
```

## The scaffold pattern (phase-2 agents)

Copy `routes/searches.py`. Its header comment is the authoritative rule list; in brief:

1. **One router per resource**, `tags=[<contract tag>]`, registered in `router.py`.
2. **Explicit `operation_id="<exactContractId>"`** on every route, matching `mvp-api.yaml` verbatim. The drift test fails otherwise.
3. **`response_model=`** the generated model (or `list[Model]`); POST creators set `status_code=201`. **No auth deps** (mock parity).
4. **Store access** via `app.scaffold.store` dicts; path ids are `UUID`.
5. **Raise typed errors** from `app.scaffold.errors` (`NotFoundError`, ...), never `HTTPException`. Unknown id on an id-addressed route -> `NotFoundError` (404 envelope).
6. **Merge semantics** mirror the mock `api.ts` (read it first). Partial updates: `model_copy(update=incoming.model_dump(exclude_unset=True))`.

### Adding a resource

1. Seed it in `store.py`: add `_<res>: dict[UUID, Model]`, a `_seed_<res>()` builder, and a `clear()/update()` line in `reset()`. Reproduce any well-known fixture UUIDs verbatim; convert relative fixture timestamps to absolute instants with `store.iso_ago(...)`.
2. Write `routes/<res>.py` following the pattern.
3. `include_router` it in `router.py`.
4. Delete the resource's operationIds from `NOT_YET_SCAFFOLDED` in `tests/scaffold/coverage.py`. The drift test now requires those routes to exist.
5. Add behavior tests under `tests/scaffold/`.

### Gotchas carried forward from the contract

- **`transitionApplication`**: pydantic will NOT enforce the conditional rule "`resumeId` required when `targetStage=applied`". That if/then lives in **route logic** -- raise `ValidationTaggedError` (422) there.
- **The 6 DEFERRED ops** (`proposeCoachEdit`, `saveCoachProposal`, `getReviewQueue`, `approveAgentAction`, `rejectAgentAction`, `patchAgentTrustTier`) stay in `NOT_YET_SCAFFOLDED` until the founder rules. Do not scaffold them.
- **AI ops** (`runDeepMatchScore`, `deriveAccomplishmentFromProject`) return an `AiRunEnvelope` (`aiRun`) and execute synchronously; there is no AI provider in the scaffold -- return a synthetic envelope (`provider="fake"`, `synthetic=true`).

## Tests run without a database

`tests/scaffold/conftest.py` overrides the parent autouse `db` fixture with a
no-op and resets the store before each test. Scaffold tests use an
unauthenticated `TestClient` and never touch the app database.
