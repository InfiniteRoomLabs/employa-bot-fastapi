"""Match resource: cost preview + deep (paid) match scoring + match report.

Follows the searches.py pattern exactly (see that file's header for the full
rule list).

Neither ``previewDeepMatchScore`` nor ``runDeepMatchScore`` has a named
contract request-body schema (inline objects in ``mvp-api.yaml`` -- see
``routes/shortlist.py``'s docstring for why ``datamodel-codegen`` skips
these). ``PreviewDeepScoreBody``/``RunDeepScoreBody`` below are route-local
models built field-for-field from the inline schemas.

Both routes validate the ``{id}`` path segment against ``store.jobs`` and
raise ``NotFoundError`` on an unknown job -- the mock ignores ``jobId``
entirely for these two calls, but the contract's path binds ``{id}`` to the
canonical Job resource (ADR-006), so treating an unknown job as 404 (pattern
rule 5: "unknown id on an id-addressed route -> 404") is the safer, more
contract-faithful behavior than silently succeeding for any UUID.

``runDeepMatchScore``'s monthly-cap check is ported from the mock's
``capRemainingUsd()`` / ``previewDeepMatchScore`` overCap arithmetic (the mock
itself never enforces the cap on the run call -- it is only ever forced via
a test-only env flag). Per the contract description ("If the monthly cap is
reached it fails with `cap_reached`"), this route enforces it for real:
unit cost > remaining headroom -> 402 ``cap_reached`` via ``CapReachedError``,
checked BEFORE any spend is recorded.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app import store
from app.api.deps import get_current_user
from app.api.errors import CapReachedError, NotFoundError
from app.schemas import (
    AiRunEnvelope,
    AiRunStatus,
    CostPreview,
    CostPreviewItem,
    DeepMatchResult,
    MatchReport,
)
from app.schemas import Kind2 as DeepMatchKind

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["match"])


class PreviewDeepScoreBody(BaseModel):
    """Inline requestBody for ``POST /jobs/{id}/preview-deep-score``."""

    resumeIds: list[UUID]


class RunDeepScoreBody(BaseModel):
    """Inline requestBody for ``POST /jobs/{id}/deep-score``."""

    resumeId: UUID


@router.post(
    "/jobs/{id}/preview-deep-score",
    operation_id="previewDeepMatchScore",
    response_model=CostPreview,
)
def preview_deep_match_score(id: UUID, body: PreviewDeepScoreBody) -> CostPreview:
    """Cost preview for a deep (paid) match score (previewDeepMatchScore, D8b/D21).

    NON-AI: pure cost arithmetic, one itemized line per resume. Mirrors mock
    api.ts ``previewDeepMatchScore``: unit cost from the deep-match-score cost
    table, ``overCap`` iff the itemized total exceeds remaining cap headroom.
    """
    if id not in store.jobs:
        raise NotFoundError(f"jobs/{id}")
    unit_cost = store.DEEP_MATCH_SCORE_COST_USD
    items = [
        CostPreviewItem(
            resumeId=resume_id, model=store.DEEP_MATCH_SCORE_MODEL, estCostUsd=unit_cost
        )
        for resume_id in body.resumeIds
    ]
    total_usd = round(sum(item.estCostUsd for item in items), 2)
    remaining = store.cap_remaining_usd()
    return CostPreview(
        items=items,
        totalUsd=total_usd,
        capRemainingUsd=remaining,
        overCap=total_usd > remaining,
    )


@router.post(
    "/jobs/{id}/deep-score",
    operation_id="runDeepMatchScore",
    response_model=DeepMatchResult,
)
def run_deep_match_score(id: UUID, body: RunDeepScoreBody) -> DeepMatchResult:
    """Run a deep (paid) match score (runDeepMatchScore, D8/D9a).

    Synchronous "AI" operation served by the synthetic FakeProvider (no real
    provider in the mock backend). Raises ``CapReachedError`` (402) BEFORE
    recording any spend if the unit cost would exceed the remaining monthly
    cap -- see module docstring.
    """
    job = store.jobs.get(id)
    if job is None:
        raise NotFoundError(f"jobs/{id}")

    unit_cost = store.DEEP_MATCH_SCORE_COST_USD
    if unit_cost > store.cap_remaining_usd():
        raise CapReachedError(f"jobs/{id}/deep-score")

    started = datetime.now(UTC)
    base_score = job.match.score if job.match else 80
    strengths = (
        job.match.strengths if job.match else ["Direct experience with the core stack"]
    )
    gaps = (
        job.match.gaps
        if job.match
        else ["Lighter coverage on one secondary requirement"]
    )
    finished = datetime.now(UTC)

    store.month_spend_usd = round(store.month_spend_usd + unit_cost, 2)

    ai_run = AiRunEnvelope(
        provider="fake",
        model=store.DEEP_MATCH_SCORE_MODEL,
        status=AiRunStatus.succeeded,
        startedAt=started,
        finishedAt=finished,
        durationMs=int((finished - started).total_seconds() * 1000),
        estimatedCostUsd=unit_cost,
        actualCostUsd=unit_cost,
        synthetic=True,
    )
    return DeepMatchResult(
        jobId=id,
        resumeId=body.resumeId,
        score=min(99, base_score + 3),
        kind=DeepMatchKind.deep,
        strengths=list(strengths),
        gaps=list(gaps),
        costUsd=unit_cost,
        aiRun=ai_run,
    )


@router.get("/match-report", operation_id="getMatchReport", response_model=MatchReport)
def get_match_report(
    resumeId: UUID = Query(...),  # noqa: N803 -- wire name verbatim
    jobId: UUID = Query(...),  # noqa: N803 -- wire name verbatim
) -> MatchReport:
    """Match report for a (resume, job) pair (getMatchReport).

    Judgment call, mirrors mock api.ts exactly: the design renders only one
    canonical match report, so ``resumeId``/``jobId`` are echoed back onto a
    single fixture rather than validated against the resume/job stores (which
    are out of this slice's scope).
    """
    return MatchReport(
        resumeId=resumeId,
        jobId=jobId,
        score=store.MATCH_REPORT_SCORE,
        rubric=list(store.MATCH_REPORT_RUBRIC),
        gaps=list(store.MATCH_REPORT_GAPS),
        strengths=list(store.MATCH_REPORT_STRENGTHS),
    )
