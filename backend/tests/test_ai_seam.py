"""AC-07: the fake provider is deterministic and the factory is
explicit-only (docs/sprints/sprint-05-spec.md PIN-A8/A9). DB-free.

    uv run --project backend pytest tests/test_ai_seam.py -q
"""

from __future__ import annotations

import subprocess
import uuid
from decimal import Decimal
from pathlib import Path

import pytest

from app.ai.base import DeepMatchInput
from app.ai.factory import get_provider
from app.api.errors import ProviderUnavailableError, RateLimitedError
from app.core import throttle
from app.core.config import settings

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _input(baseline: int | None = 92) -> DeepMatchInput:
    return DeepMatchInput(
        job_id=uuid.UUID("b7e9c4a1-0d2f-4c83-9a16-1e5f7c3b8d40"),
        resume_id=uuid.UUID("d2b8f3c1-5e42-4097-8b63-1c7e4f802d95"),
        unit_cost_usd=Decimal("0.14"),
        baseline_score=baseline,
        baseline_strengths=["s1"] if baseline is not None else [],
        baseline_gaps=["g1"] if baseline is not None else [],
    )


def test_fake_provider_deterministic_across_fresh_instances() -> None:
    """PIN-A8: byte-identical outcomes across repeated calls AND fresh
    provider instances -- no per-instance or ambient state."""
    a = get_provider(settings).deep_match_score(_input())
    b = get_provider(settings).deep_match_score(_input())
    assert a == b
    again = get_provider(settings).deep_match_score(_input())
    assert again == a


def test_fake_provider_frozen_scoring_rule() -> None:
    provider = get_provider(settings)
    with_baseline = provider.deep_match_score(_input(baseline=92))
    assert with_baseline.score == 95  # min(99, 92 + 3)
    assert with_baseline.strengths == ["s1"]
    assert with_baseline.gaps == [{"severity": "medium", "text": "g1"}]
    capped = provider.deep_match_score(_input(baseline=99))
    assert capped.score == 99
    bare = provider.deep_match_score(_input(baseline=None))
    assert bare.score == 80
    assert bare.strengths == ["Direct experience with the core stack"]
    # the canonical rubric rides every outcome, and cost is the unit cost
    assert len(with_baseline.rubric) == 4
    assert with_baseline.actual_cost_usd == Decimal("0.14")


def test_provider_is_synthetic_and_named() -> None:
    provider = get_provider(settings)
    assert provider.name == "fake"
    assert provider.synthetic is True


@pytest.mark.parametrize("value", ["", "claude_cli", "FAKE", "openai", "none"])
def test_factory_fails_closed_on_anything_but_fake(value: str) -> None:
    """PIN-A9: explicit-only, never a fallback -- 503 provider_unavailable."""
    misconfigured = settings.model_copy(update={"AI_PROVIDER": value})
    with pytest.raises(ProviderUnavailableError):
        get_provider(misconfigured)


def test_factory_is_the_only_construction_site() -> None:
    """No second FakeAiProvider() call site exists outside app/ai/factory.py
    and the provider's own module tests (grep assertion, PIN-A9)."""
    result = subprocess.run(
        ["grep", "-rn", "FakeAiProvider(", str(BACKEND_DIR / "app")],
        capture_output=True,
        text=True,
        check=False,
    )
    call_sites = [
        line
        for line in result.stdout.splitlines()
        if "factory.py" not in line
        and "import" not in line
        and "class FakeAiProvider" not in line
    ]
    assert call_sites == [], call_sites


def test_deep_score_throttle_window(monkeypatch: pytest.MonkeyPatch) -> None:
    """PIN-A10: per-user sliding window; another user is unaffected."""
    throttle.reset()
    monkeypatch.setattr(settings, "DEEP_SCORE_THROTTLE_USER_PER_MINUTE", 3)
    try:
        uid = str(uuid.uuid4())
        other = str(uuid.uuid4())
        for _ in range(3):
            assert throttle.deep_score_attempt_allowed(user_id=uid) is True
        assert throttle.deep_score_attempt_allowed(user_id=uid) is False
        assert throttle.deep_score_attempt_allowed(user_id=other) is True
    finally:
        throttle.reset()


def test_rate_limited_error_is_429_shaped() -> None:
    assert RateLimitedError("x").kind.value == "rate_limited"
