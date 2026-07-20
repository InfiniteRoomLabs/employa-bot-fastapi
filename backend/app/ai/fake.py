"""The deterministic fake provider (sprint-05 spec PIN-A8).

The scoring rule is FROZEN and a pure function of the input snapshot -- no
database, no clock, no randomness, no per-instance state:

* score  = min(99, baseline + 3) when the job carries a match baseline,
  else 80 (the mock's exact arithmetic, match.py history).
* strengths / gaps = the baseline's when present, else the canned pair.
* rubric = the canonical 4-row fixture (single source: app.store, the same
  content the seed materializes -- PIN-A13).
* actual cost = the unit cost passed in (flat rate; the reservation's
  conservative max equals it, so conversion arithmetic is exact).

Determinism is what makes retry re-invocation safe (PIN-A4 iii): calling
this twice with the same input yields byte-identical outcomes, asserted by
AC-07's fresh-instance test.

``synthetic=True``: a fake score never satisfies evidence/approval (the
AiRunEnvelope contract field's documented meaning).
"""

from __future__ import annotations

from app import store
from app.ai.base import AiProvider, DeepMatchInput, DeepMatchOutcome

_FALLBACK_SCORE = 80
_FALLBACK_STRENGTHS = ["Direct experience with the core stack"]
_FALLBACK_GAPS = ["Lighter coverage on one secondary requirement"]

_CANONICAL_RUBRIC: list[dict[str, str | int]] = [
    row.model_dump(mode="json") for row in store.MATCH_REPORT_RUBRIC
]


class FakeAiProvider(AiProvider):
    name = "fake"
    synthetic = True

    def deep_match_score(self, request: DeepMatchInput) -> DeepMatchOutcome:
        if request.baseline_score is not None:
            score = min(99, request.baseline_score + 3)
            strengths = list(request.baseline_strengths) or list(_FALLBACK_STRENGTHS)
            gap_texts = list(request.baseline_gaps) or list(_FALLBACK_GAPS)
        else:
            score = _FALLBACK_SCORE
            strengths = list(_FALLBACK_STRENGTHS)
            gap_texts = list(_FALLBACK_GAPS)
        return DeepMatchOutcome(
            score=score,
            strengths=strengths,
            gaps=[{"severity": "medium", "text": text} for text in gap_texts],
            rubric=[dict(row) for row in _CANONICAL_RUBRIC],
            actual_cost_usd=request.unit_cost_usd,
        )
