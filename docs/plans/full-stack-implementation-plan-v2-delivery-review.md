# Plan v2 -- Delivery-realism pass (GPT-5.6-sol via Codex, 2026-07-10)

> Attack angle: execution realism and delivery risk ONLY (security + data-correctness covered in sibling reviews). Read-only.

# Delivery verdict

This plan does not take 30-40 working sessions. Assuming a "session" means 3-5 focused hours:

- **Core-journey gate:** p50 **28-35 sessions**, p90 **45-55**
- **Everything through Phase F:** p50 **60-75 sessions**, p90 **95-125**
- Calendar time for a solo founder with normal interruptions: **4-7 months p50**, and **9-14 months p90**

Thirty to forty sessions is plausible only if "done" means the backend core journey works with FakeProvider and most frontend suites, extension work, Claude CLI hardening, productionization, and close-out are deferred.

The estimate is not merely optimistic. It uses "slice" as the unit while quietly packing multiple subsystems into several slices. "Nine conversions x 1-2 sessions" is arithmetically tidy and operationally false.

The likely failure mode is not a dramatic technical catastrophe. It is death by repeated integration tax: migration, seed fidelity, fixture conflicts, response-shape mismatches, MSW reconstruction, compose verification, and test cleanup - again and again - with increasingly little visible product progress.

## Ranked recommendations for actually shipping

### 1. Redefine the first shipment as one founder journey, not 83 implemented operations

Highest impact by far.

Ship only: login, create/manual-capture a job, list/view jobs, shortlist, create/view application, transition application through the essential stages, select one resume when applying, persist one immutable resume snapshot, run deterministic fake deep-match, show the result in the existing UI.

That is the actual learning artifact: a real frontend, real HTTP, real Postgres, real migrations, real state transition, and one AI seam.

Everything else can remain mock-backed, be hidden in navigation, or be explicitly unavailable. Do not persist notifications, coach threads, agent logs, trash, credentials, account deletion, exports, usage dashboards, extension token management, or the full resume editor before proving this journey.

Call that **Release 0.1** and put the demo gate around session 6-8, not 15-18.

### 2. Remove Phase E and most of Phase F from this implementation plan

Productionization is a separate project. Cut from the critical path: Traefik, mkcert, production compose profile, GHCR publishing, Trivy policy wrangling, sops+age, Sentry/logging expansion, automated backup sidecar, weekly restore CI, deploy task abstraction, fresh-clone documentation polish beyond one tested developer setup.

Keep only: normal development compose, a migration-from-empty check, one seed/reset command, one smoke or Playwright journey, a manual pg_dump/restore note.

TLS with mkcert is exactly the kind of "only a day" task that eats three sessions across host trust stores, browser profiles, containers, SANs, WSL/Linux/macOS differences, and Playwright certificate behavior. It contributes almost nothing to the hand-refactor learning goal.

### 3. Do not restore 41 Vitest suites during resource conversion

This is probably the largest hidden frontend tax. There is no MSW infrastructure today. Restoring those suites is not "add handlers and unexclude tests." It means reconstructing the behavioral mock contract that was deliberately retired, deciding request interception boundaries, manufacturing authenticated state, resetting handlers and mutable fixtures correctly, reconciling generated wire types, and debugging timing assumptions inherited from the old in-process mock.

The 41 excluded files also do not align neatly with the nine backend slices. A settings screen may consume current user, usage, notifications, and token data. Application-detail tests may consume application, job, resume, interview, timeline, and match endpoints. There is no honest "restore only this resource's tests" partition.

For Release 0.1: keep one or two API-adapter integration tests; add a small number of hook tests only where transformation logic is valuable; test the working journey with Playwright against the real backend; delete or leave the old suites retired with an explicit statement that the post-refactor test strategy will be redesigned.

Authoring a parallel MSW backend while simultaneously replacing the Python mock backend with Postgres is double maintenance with very weak payoff.

### 4. Split applications into three commits and give it 5-9 sessions

Applications is the first true tar pit. It combines: a joined projection across application/job/search/resume/snapshot/archive; a 12-state transition matrix; ~144 legal/illegal state pairs; optimistic concurrency; append-only transition history; timeline projection; snapshot creation at APPLIED; resume locking; mark-won plus archival; a persisted expiring undo; dismiss semantics that differ before and after applying; reactivation; cross-resource ownership checks; atomic transaction requirements.

The current in-memory route mutates several dictionaries sequentially. Translating that to SQL is not mechanical.

Break it into: (1) Application CRUD/read projection; (2) transition + concurrency + history + snapshot; (3) mark-won/undo/dismiss/reactivate/archive/timeline. Demo after each. Do not combine MSW restoration in any of them.

### 5. Use one DB test world, introduced once, before converting resources

Per-resource migration is better than v1's data-layer big bang, but the proposed test migration is not as clean as advertised. The current contract directory deliberately overrides the parent session-scoped DB fixture with a no-op and resets the global store before every test.

Mixed test files defeat "per resource": test_jobs_match.py contains jobs+shortlist+match+AI; test_applications.py contains applications+archive+interviews+timeline; test_library.py contains several resource types plus cross-kind trash. If a file opts into DB fixtures, unconverted tests in the same file now need store fixtures.

Saner: establish authenticated DB-backed test infra once; give DB fixtures distinct explicit names (no magical autouse switching by directory); split mixed test files by subsystem once; let each test explicitly request db_client or store_client; freeze the store-backed suite except for auth adaptation; delete each store fixture section when its last consumer converts.

### 6. Optimize for disposable clarity, not comprehensive polish

The plan says a huge hand-refactor follows, but repeatedly builds durable scaffolding around code intended to be rewritten (skills/hooks, generated-diff automation, full MSW, five checkpoint-constant migrations, production compose, two-browser extension, broad observability, per-phase docs).

For a learning implementation prefer: boring SQLModel tables, direct route functions, obvious transaction blocks, one seed module, one fake AI provider, one real-user journey, comments explaining compromises, a short "refactor targets" doc. Do not create generic repositories/service abstractions/factories/reusable harnesses until a second use proves they help.

## Slice variance (the nine slices are not comparable)

- Searches: 1-3 - Jobs: 2-4 - Shortlist: 2-4 - Applications: **5-9** - Interviews/archive: 2-4 - Resumes/lifecycle: **7-13** - AI fake-first: 4-7 - Periphery: **6-11** - Coach/agents: 3-6

Applications is the behavioral tar pit. Resumes is the volume tar pit (~10 tables: uploads, career history, templates, projections, snapshots, exports, match reports, default selection, deletion locks, lifecycle). Periphery is the "miscellaneous" tar pit (notifications, settings, usage accounting, multiple library CRUD types, cross-kind trash, restore/purge, export, account deletion) -- where enthusiasm collapses because it's broad, fiddly, and recreates screens that already worked against mocks.

## Morale / momentum

The first meaningful product gate is too late -- it arrives after the three hardest backend areas. Better demo gates: session 2 (login + one authed mock route still works), session 4 (first real DB-backed search/job in the existing UI), session 6-8 (manual job -> shortlist -> application end-to-end), session 10-14 (apply with one seeded resume; transition + snapshot visible), session 14-18 (fake score visible + one Playwright journey green). Every gate should end with something visible in the browser, not "manifest validation now rejects stale metadata."

## Abandonment at session 20

Under the written plan, session 20 probably lands between applications and resumes/AI -- NOT safely after the core gate. Likely state: auth required everywhere; searches/jobs/shortlist/applications partly in Postgres; other routes still mutate store.py; seed data in two representations; tests in two isolation models; some frontend suites restored, most excluded; application behavior may validate resume IDs against mock resumes; migrations forward-only and still changing; no extension; no production story. The app may boot, but its conceptual model is worse than either the original mock or a finished DB implementation.

Rule to make abandonment safe: **no release checkpoint may depend on a cross-store relationship.** For Release 0.1, all entities required by the founder journey move together; everything else stays wholly mock-backed or disabled. Do not validate DB applications against mock resumes.

## A shippable sequence

1. Foundation, 2-4 sessions: DB test client, explicit fixtures, reset script, authenticated principal.
2. First visible DB win, 2-3: manual job creation/listing in the real UI.
3. Founder funnel, 3-5: shortlist and basic application creation/view.
4. Lifecycle core, 4-7: concurrency, legal transitions, history, one seeded resume, APPLIED snapshot.
5. AI seam, 2-4: deterministic fake score and persisted run result.
6. Shipment gate, 2-4: one Playwright journey, fresh DB migration, seed, concise run instructions.

Roughly **15-27 sessions**, with a meaningful browser demo by session 4-7 and a genuinely complete learning artifact by session 20-ish.

The current plan is an impressive map of everything that could be built. It is not yet a delivery plan for a solo founder. A delivery plan must make quitting after any major checkpoint leave behind something coherent. This one postpones coherence until after its hardest work.
