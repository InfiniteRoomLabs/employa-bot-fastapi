"""Scaffold coverage ledger -- the shrinking list of not-yet-scaffolded ops.

The contract drift test (tests/scaffold/test_contract_drift.py) asserts that
the scaffolded operationIds in app.openapi() are EXACTLY the frozen contract
set (mvp-api.yaml, 89 ops) MINUS NOT_YET_SCAFFOLDED below.

PHASE-2 AGENTS: when you land a resource, DELETE its operationIds from
NOT_YET_SCAFFOLDED. The test then requires those routes to exist with the
right operationId, and fails if they do not (or if a stale/extra id appears).

The agents/coach resource group's 6 DEFERRED ops (founder-ruled 2026-07-04,
CONTRACT-NOTES.md, DECISIONS-NEEDED #1/#2) are now scaffolded as mock-parity
stubs -- see ``app/scaffold/routes/agents.py`` and ``routes/coach.py`` for the
per-route ``# DEFERRED (...)`` markers explaining what's not yet frozen:
  * approveAgentAction
  * getReviewQueue
  * patchAgentTrustTier
  * proposeCoachEdit
  * rejectAgentAction
  * saveCoachProposal
"""

from __future__ import annotations

# Every contract op not yet served by a scaffold route. The applications /
# interviews / archive group (14 ops) was the last unscaffolded group, so this
# is now empty -- every frozen contract op has a scaffold route.
NOT_YET_SCAFFOLDED: frozenset[str] = frozenset()
