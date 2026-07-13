# Plan critique -- GPT-5.6-sol via Codex (2026-07-09)

> Adversarial review of `full-stack-implementation-plan.md`. Read-only repo access; all file:line claims verified against the working tree at commit 7b318f0.

# Adversarial critique

The plan is not execution-ready. It mixes a credible persistence roadmap with unauthorized contract redesign, contradictory phase accounting, fragile migration/testing assumptions, and a large amount of infrastructure and agent-workflow ceremony. The claimed 22-26 sessions is fantasy for the stated scope.

## 1. FACTUAL ERRORS

### Phase and commit counts are internally false

The document says "10 phases" at `docs/plans/full-stack-implementation-plan.md:13`, but defines Phase 0 through Phase 10: eleven phases.

It also promises each phase is 1-5 commits at `docs/plans/full-stack-implementation-plan.md:13`, then requires one commit for each of searches, jobs, extension tokens, shortlist, applications, interviews, and archive in Phase 3 (`docs/plans/full-stack-implementation-plan.md:58-64`). That is at least seven resource commits before migration or integration fixes.

### The 403 spot-check identifies the symptom but prescribes the wrong fix

The factual spot-check is correct: `_STATUS_TO_KIND` has no 403 entry (`backend/app/api/errors.py:45-53`), while JWT validation currently raises 403 (`backend/app/api/deps.py:30-40`).

The proposed correction is contractually wrong. The frozen contract explicitly maps `unauthorized` to 401 (`mvp-api.yaml:34-38`), and `KIND_TO_STATUS` already implements that mapping (`backend/app/api/errors.py:30-40`). Adding `403: Kind.unauthorized` would cause `_handle_http_exception()` to call `_envelope()`, which emits 401, not 403 (`backend/app/api/errors.py:118-123`, `backend/app/api/errors.py:140-148`). Thus the response status silently changes during exception translation.

The correct reconciliation is to make contract-facing authentication failures raise 401, or explicitly define a separate authorization policy. Do not pretend 403 is part of the frozen mapping.

There is another unaddressed conflict: inactive users currently produce 400 and missing DB users produce 404 (`backend/app/api/deps.py:41-46`). The plan says "every query" and auth errors get exact envelopes but does not decide whether these template behaviors remain or are normalized.

### The drift-test spot-check is accurate

`test_contract_has_89_operations()` pins 89 exactly at `backend/tests/contract/test_contract_drift.py:39-40`. The contract test fixture also does exactly what the plan claims: it overrides the parent DB fixture, resets the store per test, and uses an unauthenticated client (`backend/tests/contract/conftest.py:26-42`).

These are two of the few verified claims that hold cleanly.

### "Only auth/users DB-backed" is incomplete

The plan says only auth/users are DB-backed (`docs/plans/full-stack-implementation-plan.md:5`). Repository architecture documents `login.py`, `users.py`, and `utils.py` as the DB-backed/template route group (`CLAUDE.md:89-95`; `backend/README.md:3-6`).

More importantly, the contract's `getCurrentUser` is not currently DB-backed. It is a mock singleton returning `store.current_user` (`backend/app/api/routes/account.py:42-45`). The plan acknowledges it must be converted, but its opening description obscures the distinction between template `/users/me` and frozen-contract `/user`.

### "One migration per slice" contradicts the plan itself and current migration reality

The plan's inventory says "One migration per slice" (`docs/plans/full-stack-implementation-plan.md:132-134`), but:

- Phase 3 explicitly adds a second Slice-2 migration for `extension_token` (`docs/plans/full-stack-implementation-plan.md:60`).
- Phase 5 adds another "small migration" for tables assigned to Slice 4 (`docs/plans/full-stack-implementation-plan.md:81-84`).
- Phase 2 proposes a large Slice-1 migration containing Slice-2 resources.

The repository currently has one squashed base migration, with `down_revision = None` (`backend/app/alembic/versions/3bae06a61157_initial_schema.py:13-16`). Any "upgrade from previous head" test must therefore define immutable revision checkpoints or fixtures. The plan never explains how tests will install "the previous slice's head" after later migrations exist.

### Phase 2 violates the binding slice boundary

The mission plan says Foundation contains "ONLY the core-loop tables" and later slices add their tables when behavior is settled (`docs/mvp-plan.md:61-65`).

The proposed Foundation migration pre-creates:

- `shortlist_entry`
- full `application`
- `stage_transition`
- `interview_round`
- a substantial `job` schema

at `docs/plans/full-stack-implementation-plan.md:46-49`.

Some application link surface is explicitly allowed by the mission plan, but shortlist and interview storage are Slice-2 behavior. Pre-creating them defeats the stated "migrations authored per slice, not up front" rule (`docs/mvp-plan.md:61-63`).

### The "byte-compatible DB seed" claim is untenable

The plan claims DB seeding can reuse store fixture builders and keep approximately 110 assertions passing byte-for-byte (`docs/plans/full-stack-implementation-plan.md:52`, `docs/plans/full-stack-implementation-plan.md:139`).

That is not a reasonable guarantee:

- Existing contract tests are deliberately DB-free and reset an in-memory store (`backend/tests/contract/conftest.py:1-12`, `backend/tests/contract/conftest.py:32-42`).
- The wire models are generated camelCase Pydantic models (`backend/README.md:101-104`, `backend/README.md:132-139`).
- The proposed DB models use different relational and JSONB representations, derived aggregates, joins, and ordering rules.
- The plan simultaneously says fixture builders will be ported to `seed.py` and deleted from `store.py` (`docs/plans/full-stack-implementation-plan.md:62`).

Sharing canonical fixture data is sensible. Reusing mutable store builders as both mock and database factories is coupling, not a migration strategy.

### The frontend is already HTTP-swapped

Phase 7 is written as if frontend backend wiring remains to be done generally. In fact, `frontend/src/data/api.ts` already identifies itself as an HTTP adapter against the FastAPI mock API (`frontend/src/data/api.ts:1-12`). The generated client remains unconsumed, but the seam has already moved from in-process fixtures to HTTP, as documented at `CLAUDE.md:108-112`.

The 41 retired suites claim is correct: the exclusion explicitly says 41 files were retired after the seam swap (`frontend/vitest.config.ts:116-122`). Re-enabling them is still not merely "frontend completion"; it is a test architecture rewrite.

### The generated-client workflow in Phase 0 preserves an already-known defect

The proposed `/contract-change` checklist refers to `scripts/generate-client.sh`, but the current script generates from runtime OpenAPI (`scripts/generate-client.sh:6-10`). The binding mission plan explicitly requires changing it to consume `mvp-api.yaml` directly (`docs/mvp-plan.md:84-90`).

The plan mentions client regeneration repeatedly but never clearly schedules this required script correction. That omission is dangerous because the entire point of contract-first generation is to generate operations before their runtime routes exist.

### The plan invents an unavailable skill

Phase 4 says to consult a `claude-api` skill (`docs/plans/full-stack-implementation-plan.md:73`). No such skill is established in the repository plan, `.claude/` proposal, or current tool inventory. An implementation plan cannot depend on an unnamed future capability for model IDs and pricing.

### The AI provider scope contradicts the binding mission plan

The mission plan freezes the provider selection as `claude_cli|fake` and says future providers are new subclasses (`docs/mvp-plan.md:54-58`). The reviewed plan adds `anthropic_api` immediately and changes the settings enum to three providers (`docs/plans/full-stack-implementation-plan.md:70-75`).

That is an unapproved scope expansion, not implementation of the frozen mission plan.

### Existing security and observability are ignored in the "baseline"

The repository already has:

- optional Sentry tracing outside local mode (`backend/app/main.py:15-16`);
- configured CORS middleware (`backend/app/main.py:24-32`);
- environment and secret validation (`backend/app/core/config.py:32-51`, `backend/app/core/config.py:96-115`);
- existing backend, Playwright, compose, and zizmor workflows, including a 90% coverage gate (`.github/workflows/test-backend.yml:1-45`).

Phase 0 and Phase 10 describe these areas as largely greenfield. The correct task is consolidation and extension, not creation from zero.

## 2. SEQUENCING RISKS

### Authentication is introduced too late and too broadly

Phase 1 adds top-level security to the whole contract and makes only `captureJob` accept an extension-token alternative (`docs/plans/full-stack-implementation-plan.md:35-41`). But authenticated conversion is deferred across Phases 2-6.

That creates three incompatible states:

1. The contract says all operations require JWT.
2. Mock routes still intentionally have no auth dependencies (`backend/README.md:143-149`).
3. Contract tests still use an unauthenticated client (`backend/tests/contract/conftest.py:39-42`).

"Fidelity only checks implemented ops" does not make this safe. Generated clients, OpenAPI consumers, manual testing, and security expectations all change immediately.

Introduce security per operation while routes are converted, or perform one explicit auth-boundary phase that converts all mock routes to a shared authenticated principal without changing persistence.

### Phase 0 guards files whose authoritative regeneration path is not fixed until later

The generated-file hook blocks edits to `frontend/src/client/**`, `backend/app/schemas.py`, and `frontend/openapi.json` (`docs/plans/full-stack-implementation-plan.md:21-25`). But the current generator still sources runtime OpenAPI (`scripts/generate-client.sh:6-10`), contrary to the binding contract-first requirement (`docs/mvp-plan.md:84-90`).

The guard would enforce an incorrect process.

### Phase 2 rewrites the entire contract fixture architecture before proving one DB resource

Converting `tests/contract/conftest.py` to a database-backed hybrid suite before the first resource conversion (`docs/plans/full-stack-implementation-plan.md:52`) creates maximum blast radius. Every currently stable mock behavior becomes dependent on PostgreSQL setup, seed correctness, auth tokens, truncation order, and transaction isolation at once.

A safer order is:

1. Keep current contract behavior tests DB-free.
2. Add DB integration fixtures separately.
3. Convert one resource.
4. Move only that resource's behavior tests.
5. Preserve spec-drift tests as pure parsing/runtime tests.

### Tables are created before their behavior is implemented

Phase 2 creates most core-loop tables. Phase 3 implements them one resource at a time. This means intermediate commits contain unused or partially constrained tables, while the plan simultaneously promises each commit is shippable and manifest-accurate.

The binding plan explicitly intended per-slice migrations to prevent this (`docs/mvp-plan.md:61-65`).

### The extension-token backend is built before the extension but its UI lands later

Mint/revoke and capture are introduced in Phase 1, persisted in Phase 3, frontend settings UI in Phase 7, and the extension in Phase 8. That leaves several phases with an inaccessible token lifecycle except direct API calls.

If the extension is optional MVP scope, isolate it after the core journey. If it is mandatory, implement its minimal end-to-end vertical slice together: token UI, mint/revoke, extension storage, and capture.

### The core journey is delayed by unrelated AI hardening

The core journey requires match scoring, so Phase 4 puts full CLI process-group management, Anthropic integration, pricing, telemetry, limiter, cancellation, and cost accounting on the critical path (`docs/plans/full-stack-implementation-plan.md:66-79`).

The mission plan permits a deterministic fake provider explicitly for tests and demos (`docs/mvp-plan.md:54-58`). The founder journey should first pass with `FakeProvider`; production CLI hardening can follow without blocking persistence validation.

### Frontend test repair comes after all backend conversion

The plan waits until Phase 7 to restore 41 retired suites (`docs/plans/full-stack-implementation-plan.md:95-99`). That means Phases 2-6 can break hook and screen semantics without fast frontend feedback. MSW handlers should be added per resource as the DB route is converted.

### Infrastructure arrives after architecture decisions that assume it

The Anthropic provider is justified as "for sim-prod" in Phase 4 (`docs/plans/full-stack-implementation-plan.md:73`), but sim-prod is not defined until Phase 9. Image assumptions, secret layout, TLS, hostname behavior, migrations, and deployment topology are therefore selected before the environment exists.

### Archive is scheduled twice conceptually

Archive is implemented in Phase 3 (`docs/plans/full-stack-implementation-plan.md:60`) even though the binding mission plan places archive under periphery (`docs/mvp-plan.md:70`). This is not necessarily technically wrong, but the plan fails to record that ownership deviation or update the manifest's slice convention.

## 3. SCOPE / FEASIBILITY

### The estimate is not credible

Twenty-two to twenty-six "working sessions" (`docs/plans/full-stack-implementation-plan.md:151`) is not realistic for:

- roughly 86 persistent operations;
- 30-screen validation;
- 41 restored frontend suites;
- exhaustive lifecycle and ownership testing;
- 30+ tables;
- synchronous AI subprocess hardening;
- an Anthropic provider;
- a cross-browser extension with five board extractors;
- Terraform, Ansible, TLS, backups, monitoring, and restore drills;
- seven or more CI workflows;
- Claude hooks, skills, and agents.

Even at two days per phase, that estimate leaves almost no time for debugging, schema corrections, contract mismatches, browser-store quirks, migration failures, or security review.

### Persistence is underspecified where it matters

The table inventory is broad, but the plan does not specify:

- canonical relational versus JSONB boundaries per schema field;
- uniqueness rules for most entities;
- ordering and pagination guarantees;
- transaction boundaries for multi-record state transitions;
- locking behavior beyond one optimistic application version;
- idempotency for POST operations;
- referential behavior for soft-deleted library records;
- whether global templates are seeded, migrated, or editable;
- how aggregates avoid N+1 queries;
- how settings updates work, despite only describing settings reads;
- how deferred mock data references real DB users.

Listing tables is not a persistence design.

### Exhaustive ownership testing is promised without an ownership matrix

"Ownership-404 per id-addressed op" is insufficient. Ownership also applies to:

- collection filters;
- nested child IDs;
- foreign keys in request bodies;
- compound reads such as match reports;
- cross-resource transitions;
- global resources such as templates;
- leaked existence through 409/422 differences.

The binding rule says every query is ownership-scoped (`docs/mvp-plan.md:48-50`), but the plan provides no query-level enforcement strategy or test matrix.

### The AI implementation is overbuilt for this MVP

A fake provider plus one hardened CLI provider satisfies the mission. Adding Anthropic API support, pricing tables, Prometheus cost counters, run records, queue metrics, cancellation semantics, synthetic accounting, and "AgentOps-style telemetry" before validating core product use is excessive.

The run ledger is valuable. The second real provider and bespoke telemetry platform are not on the critical path.

### Five board-specific extractors are an ongoing product, not a phase

LinkedIn, Indeed, Greenhouse, Lever, and Ashby extraction (`docs/plans/full-stack-implementation-plan.md:101-106`) involve DOM churn, CSP, shadow DOM, localized pages, sign-in walls, content-script permissions, Firefox MV2/MV3 differences, and store policy. Fixture HTML tests do not validate real board behavior.

For MVP, use JSON-LD first plus a generic manual review/edit capture form. Add board-specific enrichment only after measured failures.

### "Full CI/CD" is mislabeled

The plan explicitly says deployment remains a local command because hosted runners cannot reach the laptop (`docs/plans/full-stack-implementation-plan.md:124`). That is CI plus image publishing and a manual deployment procedure, not full CI/CD.

### No-downgrade migrations are incompatible with the production language

The mission plan allowed no downgrade support for local development (`docs/mvp-plan.md:61-63`). Once the reviewed plan adds "sim-prod," immutable images, GHCR, and deploy workflows, "no downgrades" becomes inadequate. Production rollback must at least support application rollback across expand/contract-compatible migrations.

## 4. CONTRACT DISCIPLINE

### The additive change is not following the recorded change process

The existing contract declares itself frozen (`mvp-api.yaml:5-10`). The mission process requires:

- representation versus invention classification;
- product decisions in `DECISIONS-NEEDED.md`;
- explicit founder ruling;
- structured `CONTRACT-NOTES.md` deltas;
- full manifest coverage;
- frontend adapter consequences;
- client regeneration (`docs/mvp-plan.md:27-44`).

The plan merely says founder rulings were "captured this session" and proposes a dated notes section (`docs/plans/full-stack-implementation-plan.md:7`, `docs/plans/full-stack-implementation-plan.md:41`). It does not require recording the new rulings in `DECISIONS-NEEDED.md`, revising the frozen-contract version/date, or updating the structured delta table for every affected frontend function and test.

An assertion inside an implementation plan is not durable contract governance.

### The proposal is larger than "three operations"

It adds:

- three operations;
- two security schemes;
- a top-level JWT security default;
- an operation-specific OR security rule;
- new schemas;
- conditional request validation;
- deduplication semantics;
- a token-secret format;
- hash and revocation semantics;
- audit-history behavior;
- a new 409 case;
- dynamic 200 versus 201 behavior.

That is a contract revision, security model, and lifecycle design.

### The status-code design is incomplete

`captureJob` is described as returning 201 normally and 200 on dedup (`docs/plans/full-stack-implementation-plan.md:37`). The contract must explicitly declare and test both responses. A FastAPI decorator with a static `status_code=201` will advertise only 201 unless additional responses are supplied.

The dedup response also needs a defined signal. Returning the same `Job` with a different status is technically possible, but clients need to know whether the capture was newly created. Otherwise retry UX and "recent captures" can be misleading.

### Global security breaks existing behavior immediately

The current contract has no top-level security block before `paths` (`mvp-api.yaml:50-71`), and current mock routes intentionally carry no auth dependencies (`backend/README.md:143-149`). Adding top-level JWT security changes all 92 operations, not just the new three.

It also changes:

- runtime OpenAPI fidelity;
- generated-client auth configuration;
- every contract test fixture;
- every live adapter request;
- deferred mock routes;
- error-envelope behavior for missing/invalid credentials.

The plan's "safe because fidelity only checks implemented ops" statement (`docs/plans/full-stack-implementation-plan.md:40`) is false.

### Existing ExtensionToken is already part of Settings

`ExtensionToken` already exists in the frozen schema (`mvp-api.yaml:2870-2877`) and `Settings.extensionTokens` is already required (`mvp-api.yaml:2891-2907`, `mvp-api.yaml:2951-2957`). The new token operations therefore modify an existing resource lifecycle, not introduce an isolated extension resource.

The plan must specify whether `getSettings` is the sole listing operation, how minted/revoked tokens appear there, and whether the one-time secret response has a named schema. It currently proposes an ad hoc `{token, secret}` shape without integrating it into the contract's schema conventions.

### The manifest update needs more than three entries

The manifest requires each operation to include slice, status, AI flag, consumer, and tests (`docs/operation-ownership.yaml:9-25`). Adding the operations is necessary but insufficient. Existing operations whose security, frontend consumer, or required tests change must also be reviewed.

The manifest test validates completeness and basic shape (`backend/tests/test_operation_manifest.py:96-156`), but does not validate that:

- deferred IDs are exactly the founder-approved six;
- AI flags match the AI-OPS list;
- test tags are appropriate;
- security changes have required auth tests;
- implemented status corresponds to runtime fidelity.

The plan overstates what "manifest stays green" proves.

### The generated client will churn twice unless generation is fixed first

The current script generates from runtime OpenAPI (`scripts/generate-client.sh:6-10`), while the mission requires contract-first generation (`docs/mvp-plan.md:84-90`). If Phase 1 changes the contract before correcting the script, the new client operations will not exist until mock routes are also present. That defeats the contract-first workflow and makes the "one atomic commit" unnecessarily fragile.

## 5. INFRA SANITY

The proposed local Terraform -> Docker "VM" containers -> SSH -> Ansible -> Docker-in-Docker -> Compose stack is ceremony without representative failure modes.

It simulates:

- IP allocation;
- SSH inventory;
- systemd;
- image pulling;
- Ansible role execution.

It does not realistically simulate:

- managed networking;
- load balancers;
- cloud IAM;
- managed PostgreSQL;
- object storage;
- DNS;
- certificate issuance;
- autoscaling;
- instance replacement;
- persistent block volumes;
- cloud secret stores;
- hosted-runner deployment connectivity.

Privileged DinD materially weakens the local machine's security while providing poor production fidelity. Two fake prod nodes do not create meaningful high availability when PostgreSQL, migrations, state, and routing are not designed for HA.

The claim that a provider/inventory swap retargets this to real cloud is false in practical terms. Real cloud adoption would also change storage, DNS, TLS, secrets, health checks, firewall rules, image authentication, backup location, service discovery, and database topology.

### What to cut

Cut all of Phase 9 except:

- hardened existing Compose;
- production-like image builds;
- a `compose.production.yml` or equivalent local profile;
- Traefik or Caddy only if TLS behavior must be tested;
- one PostgreSQL backup script;
- one automated restore test;
- documented environment-variable and secret requirements;
- a deployment interface that accepts an immutable image tag.

Use Terraform and Ansible only after a real deployment target exists. Until then, validate the artifacts that will survive provider selection: container image, health checks, migration command, backup format, config schema, and smoke test.

Prometheus, Grafana, cAdvisor, node_exporter, and postgres_exporter are also excessive for a laptop simulation. The repo already has optional Sentry integration (`backend/app/main.py:15-16`). Start with structured logs, correlation IDs, health/readiness endpoints, AI-run database records, and Sentry. Add metrics when there is somewhere persistent to collect and alert on them.

## 6. AGENTIC ENFORCEMENT

Phase 0 is mostly workflow theater.

### Repository hooks are not authoritative enforcement

`.claude/settings.json` applies only to Claude Code sessions that:

- load repository settings;
- allow those hooks;
- use the anticipated tool names;
- do not bypass them through shell commands, scripts, code generators, IDEs, or other agents.

A `PreToolUse` matcher for `Edit|Write|MultiEdit` does not stop:

- `sed -i`;
- code generators;
- formatters;
- shell redirection;
- IDE edits;
- GitHub web edits;
- another coding agent;
- a developer who disables local settings.

Generated-file integrity belongs in CI as reproducible regeneration plus `git diff --exit-code`.

### "Always exit 0" formatting hooks conceal failure

`autoformat.sh` is specified to always exit 0 (`docs/plans/full-stack-implementation-plan.md:24`). If Ruff, Biome, or Terraform formatting fails, the hook reports success. That is actively misleading.

Post-edit autoformatting also mutates the working tree after each tool action, potentially obscuring which edit caused a change and creating races during multi-file work.

### Skills are documentation, not enforcement

`/contract-change`, `/slice-done`, `/db-swap-resource`, and `/verify-stack` can improve consistency, but they cannot guarantee that a contributor invokes them. Only CI and branch protection can enforce:

- contract/client freshness;
- manifest completeness;
- migrations;
- lint;
- tests;
- coverage;
- fidelity.

### The hook design depends on brittle JSON assumptions

The guard assumes every editing tool supplies a `file_path` field (`docs/plans/full-stack-implementation-plan.md:22-23`). Multi-file and patch tools may expose different structures. No hook-schema version, fixture tests, failure policy, or timeout behavior is defined.

### The proposed agents duplicate review responsibility

`diff-reviewer.md` and `migration-author.md` do not create independent assurance. The binding mission already requires orchestrator review and, for complex slices, a cold reviewer (`docs/mvp-plan.md:13-21`). The enforceable artifact should be a migration checklist and CI tests, not another persona file.

### What enforcement should actually be Phase 0

Phase 0 should contain:

- contract-first client generation;
- deterministic backend-schema regeneration;
- generated-diff CI;
- manifest validation;
- existing lint/test workflows made required;
- migration-head and upgrade tests;
- a small CODEOWNERS/PR checklist if collaboration warrants it;
- optional Claude skills as convenience only.

## 7. MISSING ENTIRELY

### Security model

The plan lacks a threat model for:

- extension-token theft and replay;
- token rotation and expiry;
- token scope;
- rate limiting mint, revoke, capture, and login;
- secrets in logs and exception traces;
- malicious job descriptions used in later AI prompts;
- prompt injection from captured HTML or job text;
- URL validation and private-network/localhost URLs;
- extension CORS behavior;
- browser storage compromise;
- account deletion versus audit retention;
- authorization checks on nested foreign keys;
- enumeration resistance through differing 404/409/422 responses.

The current server permits configured credentialed CORS with all methods and headers (`backend/app/main.py:24-32`); an extension security design must explicitly say which extension origins or non-browser clients are allowed.

### Data lifecycle and privacy

There is no retention policy for:

- raw job descriptions;
- resumes and uploads;
- AI prompts and outputs;
- token counts and provider metadata;
- extension tokens;
- soft-deleted library records;
- exports;
- account deletion grace periods;
- backups containing deleted user data.

"Purge" and "deleteAccount" are operation names, not a GDPR/CCPA deletion design.

### File/object storage

`resume_upload`, exports, and data-export downloads are modeled as tables, but no object-storage or local-file strategy is provided. Storing large files in PostgreSQL versus filesystem volumes versus object storage has migration, backup, security, and deployment consequences.

### Email and asynchronous work

The plan includes notifications, data exports, deletion grace periods, and backups, but no scheduler, job runner, retry model, or delivery mechanism. A 202 data export response implies asynchronous production work; the current mock merely generates a fake URL at request time (`backend/app/api/routes/account.py:48-63`).

### Transaction and consistency design

Missing:

- transaction boundaries for APPLIED snapshot + resume lock + transition insert;
- rollback behavior when AI succeeds but persistence fails;
- idempotency under client retry;
- uniqueness conflict translation;
- isolation level assumptions;
- locking order;
- race handling for set-default resume;
- concurrent token revocation and capture;
- concurrent mark-won/undo.

### Migration and rollback strategy

"Upgrade empty and previous head" is insufficient. A production-capable plan needs:

- expand/contract rules;
- application compatibility across adjacent schema versions;
- backup before destructive migrations;
- restore criteria;
- failed-migration recovery;
- data backfill strategy;
- migration time/locking review;
- downgrade or forward-fix policy.

### Observability operations

Metrics are listed, but there is no:

- alert policy;
- log redaction standard;
- trace propagation into subprocesses;
- retention;
- dashboard ownership;
- error budget;
- incident procedure;
- readiness versus liveness definition;
- database connection-pool monitoring.

### Performance and capacity

No targets exist for:

- list endpoint pagination;
- maximum job-description size;
- resume upload size;
- AI request timeout;
- expected concurrent users;
- PostgreSQL pool sizing;
- seed size;
- query budgets;
- extension payload size;
- frontend performance.

### Accessibility and browser validation

The plan claims 30-screen completion but has no accessibility gate, keyboard testing, responsive acceptance criteria, or supported browser matrix for the main React app.

### Dependency and supply-chain policy

Digest pinning and Trivy are mentioned, but the plan omits:

- dependency update policy;
- SBOM/provenance;
- WXT extension dependency review;
- lockfile enforcement;
- secret scanning;
- license review;
- vulnerability exception process.

### Product acceptance criteria per operation

Most operations have no behavior-level definition of done beyond fidelity. Schema fidelity proves shapes, not correct domain behavior. Each resource needs explicit invariants, unhappy paths, ordering, pagination, and ownership cases.

## 8. VERDICT -- top five changes

### 1. Preserve the frozen 89-operation contract for the core implementation

Treat capture and extension tokens as a separate, founder-approved contract revision after the core journey. Record the ruling in `DECISIONS-NEEDED.md`, add structured `CONTRACT-NOTES.md` rows, version the spec, update manifest tests, fix contract-first generation, and explicitly test security/status behavior.

Do not add top-level security until the auth migration strategy is defined.

### 2. Rebuild the roadmap as thin vertical slices

For each resource:

1. migration;
2. DB model;
3. seed data;
4. route conversion;
5. ownership and behavior tests;
6. manifest flip;
7. MSW/frontend test restoration;
8. compose smoke.

Keep existing DB-free mock contract tests until each resource moves. Do not rewrite the whole test fixture architecture first.

### 3. Put the founder journey ahead of production AI and extension work

Use `FakeProvider` to get login -> capture/manual paste -> shortlist -> application -> transition -> resume snapshot/lock -> match result working. After that gate, harden `ClaudeCLIProvider`. Defer Anthropic API support, board-specific extension extractors, and broad telemetry until real usage justifies them.

### 4. Delete the fake-cloud infrastructure phase

Replace Terraform/Ansible/DinD with hardened Compose, immutable images, health/readiness checks, migration execution, one backup/restore test, structured logs, Sentry, and documented deployment inputs. Choose Terraform and Ansible only after selecting a real hosting target.

### 5. Replace agentic "enforcement" with deterministic CI gates

Make Claude skills optional workflow aids. Enforce correctness through:

- contract-first generation;
- generated-diff checks;
- manifest/fidelity tests;
- migration tests;
- required lint/test/build workflows;
- security tests;
- per-slice frontend integration tests.

The current plan's core persistence direction is salvageable. Its scope, sequencing, contract governance, and execution estimate are not.
