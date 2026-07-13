# AGENTS.md -- Employa-Bot (for Codex)

Read `~/.codex/AGENTS.md` (global) and `./CLAUDE.md` (this repo) first. `CLAUDE.md`
is the authoritative brief -- stack, commands, architecture, the backend-change
loop -- and applies to you too.

## Quick orientation

Employa-Bot: FastAPI + SQLModel + Postgres backend (`backend/`, Python 3.14, `uv`)
and a React 19 + Vite + Bun frontend (`frontend/`), forked from the full-stack
FastAPI template. Two API layers under `/api/v1`: real DB-backed auth/users, and
an in-memory **mock API** serving the frozen 89-op `mvp-api.yaml` contract. The
mock layer is the placeholder the real persistence/AI implementation replaces.

## Where the current thinking lives (read before proposing work)

- `mvp-api.yaml` -- frozen API contract (source of truth). `docs/mvp-plan.md` --
  binding mission plan. `docs/operation-ownership.yaml` -- per-op manifest.
  `CONTRACT-NOTES.md`, `DECISIONS-NEEDED.md` -- founder rulings.
- `docs/plans/full-stack-implementation-plan-v3.md` -- the current plan of record
  for building the whole thing (folds four adversarial reviews). Its siblings
  (`-critique`, `-v2*-review`) are the review trail; `-v2` and the original are
  superseded.
- `docs/plans/loop-research/` -- investigation of the hoyle-re `/goal` autonomous
  loop, being adapted into a reusable guided workflow.

## Codex notes

- These plan docs were largely produced BY you (gpt-5.6-sol) via adversarial
  review passes -- they cite `file:line` and are meant to be ground-truth.
- The v3 plan already encodes the security + data-integrity + delivery findings;
  don't re-derive them, build from them.
- ASCII-only prose in this repo is enforced by CI (Spec-Kitty encoding gate) --
  no smart quotes/dashes/arrows.

Keep this AGENTS.md and `CLAUDE.md` in sync.
