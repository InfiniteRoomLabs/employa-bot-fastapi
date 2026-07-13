# Plan v2 -- Security red-team pass (GPT-5.6-sol via Codex, 2026-07-09)

> Hostile security review of `full-stack-implementation-plan-v2.md`. Scope: security posture ONLY (scope/sequencing/contract-governance covered by the first critique). Read-only repo access; all file:line claims verified.

# Hostile security review

Verdict: this plan is not safe to implement as written. The highest-risk defects are the extension-token verifier, discretionary multi-tenant isolation, ambiguous dual authentication, and underspecified export/file handling. Several controls are slogans without enforceable designs.

## Critical

### 1. Extension-token verification is both impractical and a denial-of-service primitive

**Attack**

The token is `ebx_<id>_<32 urlsafe>` and "stored via pwdlib hash." If the implementation hashes the entire token with Argon2/bcrypt, there is no indexed lookup: salted password hashes cannot be searched. The server must either:

- scan every token row and run Argon2/bcrypt against each hash; or
- trust the attacker-controlled `<id>` as a database selector, then run one expensive password verification.

The first design collapses as the token table grows. The second permits unauthenticated attackers to hammer valid token IDs with deliberately invalid secrets, consuming Argon2 memory/CPU on every capture request. The planned 60/minute per-user limiter cannot identify a user until after successful verification, so it does not protect this boundary.

Argon2/bcrypt are designed to make low-entropy password guessing expensive. A random 32-byte API secret does not need that property. Applying password-work factors to every high-volume capture request buys little and creates an application-layer DoS endpoint.

**Enabled by**

- Plan line 85: secret format and pwdlib storage.
- Plan line 88: only per-user rate limits.
- security.py:11: pwdlib uses Argon2 with bcrypt fallback.

**Fix**

Use a selector/verifier design:

- Generate an opaque random token ID independent of the database UUID.
- Store `token_id`, `HMAC-SHA-256(server_pepper, secret)`, owner, scopes, expiry, revocation, and timestamps.
- Parse a strictly bounded token, perform one indexed lookup by `token_id`, then compare the HMAC using `hmac.compare_digest`.
- Do not use bcrypt or Argon2 for a 256-bit random secret.
- Rate-limit failed verification before authentication by IP/network and token ID, with a global circuit breaker.
- Return the same failure for unknown ID, bad verifier, expired token, and revoked token.
- Never use sequential or otherwise enumerable selectors.

A plain SHA-256 digest is defensible for high-entropy secrets, but keyed HMAC limits damage if only the token table leaks.

### 2. Multi-tenancy relies on developers never making a mistake

**Attack**

"Every query ownership-scoped" is per-query discipline. Across 92 operations, one forgotten `user_id` predicate leaks another user's resumes, applications, credentials, AI reports, or exports. An attacker can supply another tenant's nested UUID even when the top-level object is owned:

- `transitionApplication.resumeId`
- `createApplication.searchId` and `resumeId`
- capture `searchId`
- deep-score `resumeId`
- projection `itemIds` and `sourceUploadId`
- export `projectionId`
- shortlist `jobId`

Validating only the path object is owned does not make a referenced FK safe. A database FK proves existence, not ownership. The transition seam is worse: the plan knowingly validates `resumeId` against an in-memory mock before the resume slice exists.

**Enabled by**

- Plan line 62: ownership is a query convention.
- Plan line 68: still-mock resume validation.
- Plan line 124: tests are the principal enforcement.
- mvp-api.yaml:146, mvp-api.yaml:1847: transition accepts a nested `resumeId`.
- mvp-api.yaml:1983: application accepts `resumeId` and `searchId`.
- mvp-api.yaml:539: deep score accepts a job path ID plus resume body ID.
- mvp-api.yaml:965: projections accept multiple nested IDs.
- mvp-api.yaml:1031: exports accept a projection ID.

**Fix**

Make tenant identity part of relational integrity, not just SELECT predicates:

- Add composite uniqueness on `(user_id, id)`.
- Use composite foreign keys such as `(user_id, resume_id) -> resume(user_id, id)`.
- Carry `user_id` on every tenant-owned child, including snapshots, transitions, reports, uploads, and exports.
- Enable PostgreSQL row-level security with a transaction-local tenant setting, force RLS for the application role, and use a separate migration/admin role.
- Centralize repository/query helpers around a tenant-bound session.
- For every nested ID, load or mutate it through `(user_id, id)`, in the same transaction.
- Return tenant-indistinguishable 404s.
- Do not ship the mock-resume transition seam. Either move resumes earlier or reject the transition until ownership can be proven in the same data store.

Ownership tests are still necessary, but they are not a substitute for systemic isolation.

### 3. Data export is an account-wide exfiltration endpoint with no secure delivery design

**Attack**

The plan constructs the full account dump inline and immediately returns a URL. It does not define:

- whether the URL is authenticated or bearer-signed;
- expiry, one-time use, revocation, or cache controls;
- whether the export query is tenant-scoped;
- whether the generated artifact ID is checked against the requester;
- whether the hard cap is applied before or after the dump is materialized;
- whether exports and extension-token audit rows expose secret material.

One ownership bug here leaks the user's entire account in a single response. A URL placed in browser history, logs, analytics, Sentry breadcrumbs, referrers, or screenshots becomes a complete data breach.

**Enabled by**

- Plan line 72: synchronous inline dump and immediately-ready URL.
- mvp-api.yaml:1650: account-wide export.
- mvp-api.yaml:2969: response exposes only an unspecified URI.

**Fix**

Create a tenant-owned export record, generate through a streaming bounded writer, and expose a download endpoint that rechecks current JWT authentication and ownership. Prefer no bearer secret in the URL. If a signed URL is unavoidable, make it short-lived, single-purpose, unguessable, revocable, and redact it everywhere. Set `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and safe `Content-Disposition`. Explicitly exclude password hashes, reset tokens, extension-token verifiers, internal prompts, provider diagnostics, and operational secrets.

## High

### 4. `JWT OR X-Extension-Token` is an authentication-confusion boundary

**Attack**

The plan does not define what happens when both credentials are present. Possible failures include:

- an invalid JWT falling back to a valid extension token;
- a revoked extension token falling back to a JWT;
- audit records attributing the capture to the wrong principal;
- rate limits charging the JWT user while data is written for the extension-token owner;
- future reuse of `get_capture_principal` accidentally granting an extension token normal user authority.

FastAPI's current `OAuth2PasswordBearer` rejects missing bearer credentials automatically unless configured with `auto_error=False`, encouraging brittle exception-driven fallback logic.

**Enabled by**

- Plan line 87: JWT OR header token, with no precedence or conflict rule.
- deps.py:16: bearer extraction currently has automatic failure behavior.
- Plan line 85: top-level bearer/extension security declaration risks implying broader alternatives than intended.

**Fix**

Reject requests carrying both credential types. Do not pick a winner and do not fall back after a supplied credential fails.

Return a narrow `CapturePrincipal` containing only `user_id`, `credential_id`, and `auth_kind`; never return a `User` or reuse `CurrentUser`. Attach this dependency only to the capture route and enforce an explicit `capture:job` capability in service code. The OpenAPI operation should override top-level bearer security with the exact alternatives for capture only. Mint/revoke must remain JWT-only and should require recent password reauthentication.

### 5. Tokens are permanent bearer credentials with no scope or lifecycle

**Attack**

A token stolen from extension storage works forever until the user notices and revokes it. It can continuously inject hostile job descriptions, consume storage and AI budget, poison recommendations, and exploit future capture features. `last_used_at` does not limit anything. The extension stores both token and configurable `apiBase`, making malicious configuration or extension compromise especially valuable.

**Enabled by**

- Plan lines 85-88: mint/revoke only; no expiry, scope, rotation, or issuance limit.
- Plan line 92: long-lived token in extension storage and configurable API base.

**Fix**

Require `expires_at`, explicit `capture:job` scope, `not_before`, revocation reason, and optional device/install identity. Default lifetime should be measured in weeks, not forever. Support replacement rotation with a brief overlap, cap active tokens per user, and alert on mint/revoke and anomalous use. Show last-used IP/time without logging the secret. Require recent authentication for minting and revoking.

### 6. The SSRF requirement is cargo cult unless the server fetches the URL - and inadequate if it does

**Attack if the server fetches**

"No private-network/localhost targets" is an inadequate blocklist. Bypasses include:

- DNS resolving publicly during validation and privately during connection;
- redirects to private or metadata addresses;
- IPv6 loopback, ULA, IPv4-mapped IPv6, and link-local addresses;
- `169.254.169.254`, `fe80::/10`, and cloud-provider metadata hostnames;
- decimal, octal, hexadecimal, mixed, or shortened IPv4 representations;
- userinfo and parser disagreement;
- a public attacker-controlled proxy that forwards internally.

Validating the first URL and allowing the HTTP client to resolve or redirect independently is not protection.

**Attack if the server only stores**

There is no SSRF at capture time. Calling this an "SSRF guard" obscures the actual risks: stored phishing URLs, later server-side previews/enrichment, unsafe redirects, and links rendered in the UI. Future code may assume the stored URL was safely fetched when it was merely syntax-checked.

**Enabled by**

- Plan line 88: blocklist language.
- Plan lines 85-87: capture semantics never state whether a fetch occurs.
- mvp-api.yaml:2173: URL is stored as job-source data.

**Fix**

Specify capture semantics now.

If capture submits extracted text and the backend only stores the URL, do no server fetch and label validation as URL normalization, not SSRF prevention. Permit only canonical `http`/`https`; render with `rel="noopener noreferrer"` and safe external-link UX.

If the backend fetches, use a dedicated egress-restricted fetcher:

- canonicalize once with one parser;
- resolve DNS and reject every non-global address;
- connect to the validated address while preserving the host/TLS identity;
- repeat validation for every redirect;
- disable ambient proxies;
- cap redirects, response bytes, decompressed bytes, and time;
- block all private, loopback, link-local, multicast, reserved, and metadata ranges for IPv4 and IPv6;
- enforce network-level egress denial to internal and metadata networks.

### 7. Login remains enumerable and unthrottled

**Attack**

The protected-route normalization does nothing for login. Login returns `"Incorrect email or password"` for nonexistent/bad-password accounts but `"Inactive user"` for a valid password on an inactive account. That confirms both credentials and account state. More importantly, there is no pre-auth limiter. An attacker can brute-force passwords while forcing an Argon2 computation on every request.

The dummy hash reduces one timing distinction, but database lookup, hash-version upgrades, inactive-user handling, and differing response paths remain measurable at scale.

**Enabled by**

- Plan line 52: normalization is limited to `get_current_user`.
- login.py:30: distinct login outcomes.
- crud.py:39: expensive dummy verification.
- Plan line 88: rate limiting covers mint/revoke/capture, not login or reset endpoints.

**Fix**

Return the same 401 body and similar execution path for unknown user, bad password, and inactive user. Add layered limits before password verification: per-IP/network, per-account identifier, and global concurrency limits. Add exponential backoff and monitoring without creating a lockout weapon. Rate-limit password recovery and reset verification too. Hash upgrades should not add a uniquely observable success delay.

### 8. Prompt injection is not "solved" by JSON-schema validation

**Attack**

Schema validation proves shape, not truth or safety. A captured job can instruct Claude to:

- copy malicious content into `strengths`, `gaps`, rubric labels, or notes;
- produce defamatory or manipulative advice;
- leak resume contents into fields that are later logged, exported, or displayed;
- inflate output to allowed maxima if string/array bounds are absent;
- poison persisted `match_report` data for repeated presentation.

The current blast radius is narrower because the output is not executed. React text interpolation also escapes HTML, and the inspected frontend contains no current `dangerouslySetInnerHTML` use. Therefore arbitrary stored XSS is not presently demonstrated merely from schema-valid JSON.

But stored XSS becomes immediate if any of these strings later enter Markdown with raw HTML, rich text, an HTML/PDF template, unsafe attribute construction, or `innerHTML`. Resume exports are a particularly likely sink. Schema validation alone does not make strings safe for those contexts.

**Enabled by**

- Plan line 79: explicitly accepts prompt injection as unsolved.
- mvp-api.yaml:2245: persisted report contains attacker-influenced free-form strings without meaningful length constraints.
- mvp-api.yaml:2282: deep-match output likewise contains free-form arrays.

**Fix**

Treat job and resume data as delimited data, never instructions. Add strict length/count/range constraints to every model field. Keep provider outputs as plain text and encode at the final rendering context. Prohibit raw HTML Markdown and sanitize any rich-text path with an allowlist. Add adversarial prompt-injection tests that assert no control tokens, HTML, URLs, or secret-like text survive into persisted reports. Do not allow the model access to tools, the filesystem, network, unrelated tenant data, or secrets.

Document the residual integrity risk only after these containment controls exist.

## Medium

### 9. AI subprocess isolation omits major leak channels

**Attack**

An environment allow-list is useful but incomplete:

- command-line prompt arguments are visible through `/proc/<pid>/cmdline` and process listings;
- inherited file descriptors can expose logs, sockets, or secrets;
- exception strings can include commands, stdin fragments, stdout/stderr, or environment values;
- Sentry tracing can capture request bodies and exception locals;
- `ai_run` may persist prompts containing resumes, contact information, job text, or pasted secrets;
- the Claude CLI may write configuration, cache, telemetry, or crash data under inherited HOME/XDG paths;
- a PATH-selected executable is a code-execution boundary if PATH is writable.

**Enabled by**

- Plan line 79: stdin and minimal env, but no FD, HOME, ledger, or diagnostic policy.
- Plan line 100: correlation IDs and Sentry.
- main.py:15: tracing is enabled without an explicit PII-scrubbing configuration.
- Plan line 70: `ai_run` storage is introduced without a field-level retention policy.

**Fix**

Pass untrusted content only through stdin, never argv. Execute an absolute, root-owned binary; close all nonessential FDs; use an isolated temp HOME/XDG tree; apply restrictive `umask`; disable telemetry/config persistence; bound stdin/stdout/stderr separately. Run under a dedicated OS user/container with no network and read-only filesystem.

Define `ai_run` as metadata-only by default: model, token counts, cost, status, timestamps, correlation ID, and redacted error code. Do not retain raw prompts or outputs unless explicitly required, encrypted, access-controlled, and deleted on a short schedule. Configure Sentry `send_default_pii=False`, scrub headers/bodies/locals, and test failure paths with canary secrets.

### 10. File caps at the route do not bound decompression, parsing, or rendering

**Attack**

A small ZIP/DOCX/ODT file can expand massively. PDFs can contain pathological object graphs, embedded files, decompression bombs, scripts, external references, or parser exploits. A route-level byte limit does not bound CPU, memory, expanded size, page count, XML depth, or generated export size. Storing malicious bytes in PostgreSQL also puts backups, replicas, and `pg_dump` under attacker-controlled growth.

Malicious filenames can become header injection, path traversal, or HTML injection if reused without normalization.

**Enabled by**

- Plan line 70: only route-size caps are specified.
- mvp-api.yaml:2410: upload metadata includes attacker-controlled filename.
- Plan line 72: export size is bounded only vaguely.

**Fix**

Stream uploads while enforcing compressed size; never buffer arbitrary bodies first. Validate magic bytes, not extensions. Parse in a sandboxed worker with CPU, memory, wall-time, page-count, archive-entry, nesting-depth, and total-expanded-byte limits. Reject encrypted archives and external references. Apply XML entity protections. Generate server-controlled filenames and sanitize `Content-Disposition`. Scan or safely transform supported formats, retain only formats actually needed, and quota total storage per user.

### 11. JWTs are long-lived bearer credentials stored in an XSS-readable location

**Attack**

The access token lasts eight days and is stored in `localStorage`. Any frontend XSS steals a credential valid for every route. There is no audience, issuer, token ID, session version, or revocation mechanism in the current JWT. Password change or account-session revocation therefore may not invalidate an already-issued token.

The random default `SECRET_KEY` also means a misconfigured deployment silently changes signing keys on restart instead of failing closed.

**Enabled by**

- config.py:33: random secret default.
- config.py:35: eight-day access token.
- security.py:22: JWT contains only `exp` and `sub`.
- api.ts:123: localStorage token.

**Fix**

Require an explicitly configured signing key outside local development. Add `iss`, `aud`, `iat`, `nbf`, `jti`, and a session/security-version claim and validate them. Use short-lived access tokens with rotation or revocable server sessions. If localStorage remains, treat all XSS as account takeover and enforce a strict CSP with no unsafe script execution. Prefer appropriately protected cookies if the application can implement CSRF defenses correctly.

## 12. CORS is overly broad and confused about the authentication model

**Attack**

`allow_credentials=True` is irrelevant to an Authorization-header/localStorage design unless cookies or HTTP authentication are also used. It increases future risk: adding an auth cookie later silently creates credentialed cross-origin behavior. `allow_methods=["*"]` and `allow_headers=["*"]` also exceed what this API needs.

The extension is not just another web origin. Chrome and Firefox extension origins differ, Firefox IDs may be unstable unless configured, and extension background requests interact with host permissions differently from page requests. Blindly adding `chrome-extension://...` or a wildcard is likely either not to work or to broaden trust incorrectly.

CORS is not authentication and does not stop curl, malware, or another extension from using a stolen token.

**Enabled by**

- main.py:24: credentialed CORS with all methods and headers.
- config.py:39: configurable origin list.
- Plan line 92: Chrome and Firefox extension requests have no origin strategy.
- api.ts:123: bearer token is read from localStorage.

**Fix**

Set `allow_credentials=False` while authentication is exclusively explicit bearer headers. Allow only required methods and headers (`Authorization`, `Content-Type`, correlation header). Keep an exact web-origin allowlist.

Define and test extension networking separately. Prefer extension host permissions for the fixed production API origin. Pin stable extension IDs where supported. If Origin enforcement is added as defense in depth, use exact known extension origins and never rely on it as the token's security boundary.

## 13. Capture rate limits and storage quotas are incomplete

**Attack**

A valid extension token can submit 60 jobs per minute indefinitely. That is 86,400 attempts per day per token, potentially containing maximum-sized JD text. Multiple active tokens multiply the limit. Deduplication by `(user_id, source_url)` does not help when the attacker varies URL fragments, query parameters, casing, Unicode hostnames, or omits the URL.

If capture triggers AI later, stored poison becomes deferred cost amplification.

**Enabled by**

- Plan line 50: dedup is exact source URL.
- Plan line 88: only 60/minute capture limit.
- mvp-api.yaml:2147: raw JD text has no maximum length.

**Fix**

Add request-body and per-field limits, daily user quotas, active-token limits, total-storage quotas, and global admission controls. Canonicalize URLs for dedup while preserving the original separately; strip fragments and normalize host/default ports. Rate-limit by token ID, user, IP/network, and globally. Ensure capture never automatically authorizes paid AI work.

## 14. Current error handling may expose attacker input and internals

**Attack**

Validation errors concatenate field locations and Pydantic messages into a response. Future validators for URLs, tokens, uploads, or nested payloads may include submitted values or parser details. Provider and export exceptions could similarly leak paths, commands, or internal identifiers if passed as HTTPException details.

**Enabled by**

- errors.py:130: raw validation messages are concatenated.
- errors.py:147: HTTP exception details are returned when strings.
- Plan line 79: malformed provider output becomes an error without specifying external/internal message separation.

**Fix**

Return stable public error codes/messages. Log a separately redacted diagnostic keyed by correlation ID. Never include token values, URLs with credentials/query secrets, filenames, provider output, SQL details, or subprocess commands in client errors.

## Required plan changes before implementation

At minimum, Phase C must specify:

1. Indexed selector + HMAC verifier, not pwdlib.
2. Expiry, scope, active-token cap, rotation, and recent-auth requirements.
3. Reject-both credential semantics and a capture-only principal type.
4. Unauthenticated and global rate limiting before token verification.
5. Whether capture fetches URLs; if yes, a network-enforced fetch architecture.
6. PostgreSQL RLS plus composite tenant foreign keys.
7. Ownership validation for every nested request ID.
8. Authenticated, expiring, tenant-owned export delivery.
9. Sandboxed file parsing with expanded-size and resource limits.
10. Metadata-only AI run ledger and explicit Sentry/process redaction policy.
11. Login throttling and indistinguishable login failures.
12. Output-context encoding and adversarial prompt-injection containment tests.

Without those changes, the plan's security posture depends on every route author, query author, renderer, and subprocess error path behaving perfectly. They will not.
