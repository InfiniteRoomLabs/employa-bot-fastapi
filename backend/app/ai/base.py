"""Provider ABC + the frozen input/outcome shapes (sprint-05 spec).

``DeepMatchInput`` is a SNAPSHOT the route assembles inside the reservation
transaction -- providers never touch the database, the clock, or any other
ambient state, which is what makes determinism testable (PIN-A8) and keeps
the provider call safely OUTSIDE any transaction (PIN-A5).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID


@dataclass(frozen=True)
class DeepMatchInput:
    """Everything a provider may consider for one deep match score."""

    job_id: UUID
    resume_id: UUID
    unit_cost_usd: Decimal
    baseline_score: int | None = None
    baseline_strengths: list[str] = field(default_factory=list)
    baseline_gaps: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DeepMatchOutcome:
    """A provider's terminal result. ``rubric``/``gaps`` are wire-shaped
    JSON documents (MatchRubricRow / MatchGap field names)."""

    score: int
    strengths: list[str]
    gaps: list[dict[str, str]]
    rubric: list[dict[str, str | int]]
    actual_cost_usd: Decimal


class AiProvider(ABC):
    """One synchronous scoring capability per v3 Phase B item 4.

    ``model`` deliberately has no field here: the model identifier is
    configuration (Settings.DEEP_MATCH_SCORE_MODEL), stamped onto the
    ai_run row at reservation time -- one source of truth.
    """

    name: str
    synthetic: bool

    @abstractmethod
    def deep_match_score(self, request: DeepMatchInput) -> DeepMatchOutcome:
        """Score a (job, resume) pair. Must be a pure function of
        ``request`` for deterministic providers."""
