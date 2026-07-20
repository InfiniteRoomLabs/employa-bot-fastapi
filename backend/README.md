# Employa-Bot - Backend

Two API layers share the `/api/v1` prefix:

- **DB-backed routes** (`app/api/routes/login.py`, `users.py`, `utils.py`): real auth (JWT), user management, health check — backed by PostgreSQL via SQLModel.
- **Mock API routes** (everything else under `app/api/routes/`): the in-memory MVP backend serving the frozen `mvp-api.yaml` contract. See "Mock API layer" below.

## Requirements

* [Docker](https://www.docker.com/).
* [uv](https://docs.astral.sh/uv/) for Python package and environment management.

## Docker Compose

Start the local development environment with `docker compose watch` from the repo root (see the [root README](../README.md)).

## General Workflow

By default, the dependencies are managed with [uv](https://docs.astral.sh/uv/), go there and install it.

From `./backend/` you can install all the dependencies with:

```console
$ uv sync
```

Then you can activate the virtual environment with:

```console
$ source .venv/bin/activate
```

Make sure your editor is using the correct Python virtual environment, with the interpreter at `backend/.venv/bin/python`.

Modify or add SQLModel models for data and SQL tables in `./backend/app/models.py`, API endpoints in `./backend/app/api/`, CRUD (Create, Read, Update, Delete) utils in `./backend/app/crud.py`.

## VS Code

There are already configurations in place to run the backend through the VS Code debugger, so that you can use breakpoints, pause and explore variables, etc.

The setup is also already configured so you can run the tests through the VS Code Python tests tab.

## Docker Compose Override

During development, you can change Docker Compose settings that will only affect the local development environment in the file `compose.override.yml`.

The changes to that file only affect the local development environment, not the production environment. So, you can add "temporary" changes that help the development workflow.

For example, the directory with the backend code is synchronized in the Docker container, copying the code you change live to the directory inside the container. That allows you to test your changes right away, without having to build the Docker image again. It should only be done during development, for production, you should build the Docker image with a recent version of the backend code. But during development, it allows you to iterate very fast.

There is also a command override that runs `fastapi run --reload` instead of the default `fastapi run`. It starts a single server process (instead of multiple, as would be for production) and reloads the process whenever the code changes. Have in mind that if you have a syntax error and save the Python file, it will break and exit, and the container will stop. After that, you can restart the container by fixing the error and running again:

```console
$ docker compose watch
```

There is also a commented out `command` override, you can uncomment it and comment the default one. It makes the backend container run a process that does "nothing", but keeps the container alive. That allows you to get inside your running container and execute commands inside, for example a Python interpreter to test installed dependencies, or start the development server that reloads when it detects changes.

To get inside the container with a `bash` session you can start the stack with:

```console
$ docker compose watch
```

and then in another terminal, `exec` inside the running container:

```console
$ docker compose exec backend bash
```

You should see an output like:

```console
root@7f2607af31c3:/app#
```

that means that you are in a `bash` session inside your container, as a `root` user, under the `/app` directory, this directory has another directory called "app" inside, that's where your code lives inside the container: `/app/app`.

There you can use the `fastapi run --reload` command to run the debug live reloading server.

```console
$ fastapi run --reload app/main.py
```

...it will look like:

```console
root@7f2607af31c3:/app# fastapi run --reload app/main.py
```

and then hit enter. That runs the live reloading server that auto reloads when it detects code changes.

Nevertheless, if it doesn't detect a change but a syntax error, it will just stop with an error. But as the container is still alive and you are in a Bash session, you can quickly restart it after fixing the error, running the same command ("up arrow" and "Enter").

...this previous detail is what makes it useful to have the container alive doing nothing and then, in a Bash session, make it run the live reload server.

## Mock API layer (in-memory MVP)

Server-side port of the mockup's mock data layer. It serves the **frozen** `mvp-api.yaml` contract from ported fixture data with **no database** and **no AI provider**, so the mockup UI can run against real FastAPI routes. The real persistence/AI implementation replaces this later.

- `app/schemas.py` is **generated** from `mvp-api.yaml` (see below) -- the models ARE the wire shapes (camelCase field names, verbatim).
- `app/store.py` holds one in-memory dict per resource, seeded from ported fixtures; it is the placeholder the real DB layer replaces.
- `app/api/errors.py` maps typed domain errors to the contract `Error` envelope via app-wide exception handlers.
- One router per resource in `app/api/routes/`; `routes/searches.py` is the **pattern exemplar** -- copy it. All routers are aggregated in `app/api/main.py` (mind the resume_lifecycle-before-resumes ordering comment there).

### Regenerating the wire models (one copy-paste)

Run from `backend/`. Then apply the one deterministic post-gen fixup below.

```bash
uv run datamodel-codegen \
  --input ../mvp-api.yaml \
  --input-file-type openapi \
  --output app/schemas.py \
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
sed -i 's/    source: TransitionSource | None = "user"/    source: TransitionSource | None = TransitionSource.user/' app/schemas.py
```

Field names are kept **camelCase (verbatim from the contract)** on purpose -- no `--snake-case-field`. The models serialize exactly to the wire contract, so no aliasing is needed. Ruff does not enforce PEP8 naming (`N` not selected), so camelCase attributes are lint-clean.

After regenerating, verify:

```bash
bash scripts/lint.sh
uv run pytest tests/contract -q
```

### The mock route pattern

Copy `app/api/routes/searches.py`. Its header comment is the authoritative rule list; in brief:

1. **One router per resource**, `tags=[<contract tag>]`, registered in `app/api/main.py`.
2. **Explicit `operation_id="<exactContractId>"`** on every route, matching `mvp-api.yaml` verbatim. The drift test fails otherwise.
3. **`response_model=`** the generated model (or `list[Model]`); POST creators set `status_code=201`. **No auth deps** (mock parity).
4. **Store access** via `app.store` dicts; path ids are `UUID`.
5. **Raise typed errors** from `app.api.errors` (`NotFoundError`, ...), never `HTTPException`. Unknown id on an id-addressed route -> `NotFoundError` (404 envelope).
6. **Merge semantics** mirror the mock `api.ts` (read it first). Partial updates: `model_copy(update=incoming.model_dump(exclude_unset=True))`.

Adding a resource: seed it in `app/store.py` (`_<res>: dict[UUID, Model]`, a `_seed_<res>()` builder, and a `clear()/update()` line in `reset()`; reproduce well-known fixture UUIDs verbatim, convert relative fixture timestamps with `store.iso_ago(...)`), write the route module, `include_router` it in `app/api/main.py`, and add behavior tests under `tests/contract/`.

### Gotchas carried forward from the contract

- **`transitionApplication`**: pydantic will NOT enforce the conditional rule "`resumeId` required when `targetStage=applied`". That if/then lives in **route logic** -- raise `ValidationTaggedError` (422) there.
- **The 6 DEFERRED ops** (`proposeCoachEdit`, `saveCoachProposal`, `getReviewQueue`, `approveAgentAction`, `rejectAgentAction`, `patchAgentTrustTier`) are mock-parity stubs pending founder rulings (see `CONTRACT-NOTES.md`).
- **AI ops** (`runDeepMatchScore`, `deriveAccomplishmentFromProject`) return an `AiRunEnvelope` (`aiRun`) and execute synchronously; there is no AI provider in the mock -- they return a synthetic envelope (`provider="fake"`, `synthetic=true`).

### Contract tests run without a database

`tests/contract/conftest.py` overrides the parent autouse `db` fixture with a no-op and resets the store before each test. Contract tests use an unauthenticated `TestClient` and never touch the app database.

## Backend tests

To test the backend run:

```console
$ bash ./scripts/test.sh
```

The tests run with Pytest, modify and add tests to `./backend/tests/`.

If you use GitHub Actions the tests will run automatically.

### Test running stack

If your stack is already up and you just want to run the tests, run them on the HOST against the compose db (the backend image intentionally ships no `tests/`, so there is no in-container suite):

```bash
cd backend && POSTGRES_SERVER=localhost uv run pytest
```

Extra arguments go straight to `pytest`. For example, to stop on first error:

```bash
cd backend && POSTGRES_SERVER=localhost uv run pytest -x
```

(`scripts/tests-start.sh` is the CI/host wrapper `test-backend.yml` uses -- it waits for the DB, then calls `pytest` with coverage. It only works where `tests/` exists, i.e. on the host, never via `docker compose exec`.)

### Test Coverage

When the tests are run, a file `htmlcov/index.html` is generated, you can open it in your browser to see the coverage of the tests.

## Migrations

As during local development your app directory is mounted as a volume inside the container, you can also run the migrations with `alembic` commands inside the container and the migration code will be in your app directory (instead of being only inside the container). So you can add it to your git repository.

Make sure you create a "revision" of your models and that you "upgrade" your database with that revision every time you change them. As this is what will update the tables in your database. Otherwise, your application will have errors.

* Start an interactive session in the backend container:

```console
$ docker compose exec backend bash
```

* Alembic is already configured to import your SQLModel models from `./backend/app/models.py`.

* After changing a model (for example, adding a column), inside the container, create a revision, e.g.:

```console
$ alembic revision --autogenerate -m "Add column last_name to User model"
```

* Commit to the git repository the files generated in the alembic directory.

* After creating the revision, run the migration in the database (this is what will actually change the database):

```console
$ alembic upgrade head
```

If you don't want to use migrations at all, uncomment the lines in the file at `./backend/app/core/db.py` that end in:

```python
SQLModel.metadata.create_all(engine)
```

and comment the line in the file `scripts/prestart.sh` that contains:

```console
$ alembic upgrade head
```

If you don't want to start with the default models and want to remove them / modify them, from the beginning, without having any previous revision, you can remove the revision files (`.py` Python files) under `./backend/app/alembic/versions/`. And then create a first migration as described above.

## Email Templates

The email templates are in `./backend/app/email-templates/`. Here, there are two directories: `build` and `src`. The `src` directory contains the source files that are used to build the final email templates. The `build` directory contains the final email templates that are used by the application.

Before continuing, ensure you have the [MJML extension](https://github.com/mjmlio/vscode-mjml) installed in your VS Code.

Once you have the MJML extension installed, you can create a new email template in the `src` directory. After creating the new email template and with the `.mjml` file open in your editor, open the command palette with `Ctrl+Shift+P` and search for `MJML: Export to HTML`. This will convert the `.mjml` file to a `.html` file and now you can save it in the build directory.
