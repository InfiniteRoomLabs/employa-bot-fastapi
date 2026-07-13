# Sprint 01 mini-spec -- Phase 0 gates + Phase A foundation

Frozen at S3, sprint-01-run-1. Binding spec: plan v3 "Phase 0" + "Phase A" + Design conventions. This file adds only: investigation findings, AC IDs, evidence pins that close Codex D1 findings, panel charters, and pinned P7 values. It may not alter acceptance criteria.

## Investigation findings (S2, 2026-07-13)

- INV-1 CONFIRMED: `scripts/generate-client.sh` dumps `app.main.app.openapi()` to `frontend/openapi.json` and runs openapi-ts. Contract-first per `docs/mvp-plan.md:84-90`: the client must generate from `mvp-api.yaml`; the runtime spec is what gets compared against the contract, never the generator source. The generated client is currently unconsumed by `data/api.ts`, so dropping the login/users services from it breaks nothing.
- INV-2 CONFIRMED: mixed contract test files -> route modules: `test_periphery.py` -> account (user+account routers), notifications, settings; `test_jobs_match.py` -> jobs, shortlist, match; `test_resumes.py` -> resumes, resume_lifecycle; `test_coach_agents.py` -> coach, agents; `test_applications.py` -> applications, interviews, archive. `test_library.py` and `test_searches.py` each map to a single route module and stay whole.
- INV-3 CONFIRMED: zero mock routes carry any auth dependency (grep over `app/api/routes/*.py`); contract conftest hands out an unauthenticated client. `deps.get_current_user` leaks: invalid token -> 403, unknown user -> 404 "User not found", inactive -> 400 "Inactive user".
- INV-4 CONFIRMED: `test-backend.yml` ends in a hard `coverage report --fail-under=90`. No generated-diff, migration, or manifest CI jobs exist.
- INV-5 CONFIRMED: single alembic head `3bae06a61157` (squashed initial schema); no runtime role exists; prestart = backend_pre_start + `alembic upgrade head` + `initial_data.py` (FIRST_SUPERUSER only), unconditionally.
- INV-6 CONFIRMED: JWT payload is `{exp, sub}` only (HS256); `SECRET_KEY` defaults to a per-boot random; lifetime 8 days; CORS `allow_credentials=True` with wildcard methods/headers; no CSP anywhere.
- INV-7 CONFIRMED: wire `User` (name, email, initials, city, current, years, comp_floor, target_titles) maps onto DB `User` profile fields with `name <-> full_name`; the REMY persona values live in `store._seed_current_user()` and become the seed module's demo-user profile.
- INV-8 CONFIRMED: `OAuth2PasswordBearer(auto_error=True)` would emit missing-token 401s as `{"detail": "Not authenticated"}` outside the contract envelope -- the auth boundary must use `auto_error=False` and one explicit raise site.

## AC IDs (1:1 with the run-manifest Done-when conjuncts)

| AC | Conjunct |
|---|---|
| AC-01 | generate-client.sh generates from mvp-api.yaml; generated-diff CI job green |
| AC-02 | migration + manifest CI jobs pass |
| AC-03 | every mock route returns 401 without a token via the single normalized code path (sweep evidence) |
| AC-04 | 401 message uniform across invalid/inactive/unknown (+ expired, per D1-5) |
| AC-05 | getCurrentUser implemented from the DB; contract fidelity test green |
| AC-06 | contract test files split by subsystem; full suite green under the rollback fixture |
| AC-07 | seed --reset produces a working login from a fresh compose stack |
| AC-08 | P7 auth conventions implemented with tests green (throttle, claims, lifetime, fail-closed secret, CORS, CSP) |
| AC-09 | review ledger closed to terminal dispositions |
| AC-10 | GOAL.md retargeted to sprint-02-jobs-manual-capture and committed |

## Evidence pins (dispositions for Codex D1 findings)

- PIN-1 (D1-1): every completion-evidence row is produced at (or re-run against) the master merge SHA at S7. Branch-only green does not close a conjunct.
- PIN-2 (D1-2): each new CI gate ships with recorded negative evidence -- a local run showing the gate FAILS when its invariant is broken (dirty client diff, second alembic head, manifest drift), alongside the green run.
- PIN-3 (D1-3): the 401 sweep is a pytest that derives its route universe programmatically from `app.routes` (not a hand list), subtracts an explicit, named exempt list (login access-token, password-recovery, reset-password, utils health-check, docs/openapi endpoints), and asserts the envelope 401 on everything else. Single-code-path is proven structurally: exactly one raise site emits the credential 401 (asserted by grep-test on deps.py plus byte-identical envelope assertions).
- PIN-4 (D1-4): the getCurrentUser fidelity test uses a real JWT for a real DB row through the real dependency chain -- no dependency overrides anywhere in that test's app instance.
- PIN-5 (D1-5): expired-token joins the uniformity set: invalid/expired/inactive/unknown all produce byte-identical 401 envelope bodies.
- PIN-6 (D1-6): AC-07 evidence explicitly runs `docker compose exec backend python -m app.scripts.seed --reset` and logs in as the seeded DEMO user (not FIRST_SUPERUSER), from `docker compose down -v` clean volumes.
- PIN-7 (D1-7): P7 pinned values -- throttle 5/min per account, 10/min per IP, 100/min global, counted before password verification, one uniform message; access token 60 minutes; CORS methods `GET,POST,PUT,PATCH,DELETE,OPTIONS`, headers `Authorization,Content-Type`, `allow_credentials=False`; CSP exact value: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http://localhost:8000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` served as a backend middleware header on every response plus a meta-tag fallback in `frontend/index.html` (vite dev-mode limitation noted in progress.md, per the recorded queue default).
- PIN-8 (D1-8): destructive evidence commands (`docker compose down -v`, `seed --reset`) run only against this repo's local compose project (project name checked in the evidence transcript); `seed.py` refuses to run when `ENVIRONMENT != local` unless `--force` is passed.
- PIN-9 (D1-9): the DB test world ships a fixture self-test: a test commits a row through the app session, and the harness proves the row is gone after teardown (outer-transaction rollback observed, not assumed).

## Design decisions frozen at S3

- Auth boundary: `deps.get_current_user` switches to `HTTPBearer/OAuth2PasswordBearer(auto_error=False)`; missing, malformed, invalid-signature, expired, unknown-user, and inactive-user all raise `UnauthorizedError("Could not validate credentials")` from ONE raise site; the app-wide `ApiError` handler emits the envelope. No 403 enters `_STATUS_TO_KIND`. `getCurrentUser` (`GET /user`) serves the DB user mapped to the wire `User` (name <- full_name, others 1:1) and flips to `implemented` in `docs/operation-ownership.yaml`.
- Contract tests get auth via an explicit `store_client` fixture (module-level dependency override of `get_current_user` with a stub wire-compatible user) -- explicit fixture, not autouse; the sweep and uniformity tests use the REAL dependency (sweep is DB-free because missing-token rejection happens before any DB access).
- DB test world: engine-per-session, connection with outer transaction + savepoint restart (`db` Session bound to the connection), dependency override of `get_db` onto that session; explicit `db_client` (real token, seeded user), `intruder_client` (second real user), `seed_domain` helper. Parent conftest's delete-all-users teardown is replaced by rollback.
- Migration gates: a new alembic revision creates the `app_runtime` role (non-superuser, no DDL) and a reusable `enforce_append_only(table)` SQL helper (revoke UPDATE/DELETE/TRUNCATE + defense-in-depth triggers); migration tests run empty-upgrade, head-singularity, and append-only behavioral tests against a representative table under `app_runtime` -- the machinery sprint-04 will apply to `stage_transition`/`resume_snapshot`.
- JWT claims: add `iss` (employa-bot), `aud` (employa-bot-api), `iat`, `nbf`, `jti` (uuid4), `sv` (session version); `User` gains `session_version int NOT NULL DEFAULT 0` (alembic revision); decode validates iss/aud/exp/nbf and `sv == user.session_version`.
- SECRET_KEY fail-closed: outside `ENVIRONMENT=local`, an unset SECRET_KEY raises at settings load; local keeps a generated dev default.
- Throttle: in-memory fixed-window counters (stdlib only -- single-process MVP), keyed per-account, per-IP, global, checked before password verification; over-limit raises `RateLimitedError` (contract 429 envelope). Multi-worker throttling is recorded debt, not scope.

## Panel charters (S6, verbatim from GOAL.md)

- QA seat (Sonnet): "can any mock route be reached without a token?"
- Correctness seat (Opus): "do invalid/inactive/unknown tokens produce byte-identical 401 envelopes through one code path, and do the migration tests exercise the runtime role?"
- Simplification seat (Sonnet): "is any of the test-world plumbing autouse magic v3 forbids?"
- Sweep: Haiku finder + Sonnet verifier -- no mock route lacks CurrentUser; no 403 remains in `_STATUS_TO_KIND` paths.

## Packet order

P1 (client gen) -> P4 (test split, fanned implementer/verifier) + P6 (seed, fanned) in parallel with P1/P2 inline -> P3 (test world, inline) -> P2 finish (CI jobs) -> P5 (auth boundary, ONE commit, inline) -> P7 (auth conventions, inline). P5 and P7 sequential per GOAL.md.
