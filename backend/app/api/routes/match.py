"""Match resource: cost preview + deep (paid) match scoring + match report.

DB-BACKED since sprint-05 (docs/sprints/sprint-05-spec.md). The three ops
serve from user_ai_budget / ai_run / ai_run_event / match_report via the two
SECURITY DEFINER budget functions (app/ai_flow.py) and the app/ai/ provider
seam.

``runDeepMatchScore`` is the reservation flow (v3 Data-integrity #5/#6,
spec PIN-A5):

    throttle (429, before anything)
    txn 1: job ownership + baseline read, ai_reserve_run, COMMIT
    provider call with NO transaction open (factory + call; ANY exception
        settles the run failed -- releasing the reservation -- then 503)
    txn 2 (re-armed role+GUC): ai_settle_run(succeeded) -> report version,
        build the ENTIRE wire response, COMMIT

The mid-request commit is the ONE sanctioned deviation from the
commit-once-at-the-end rule; see ai_flow.arm_tenant_transaction.

``previewDeepMatchScore`` is pure arithmetic (conjunct 3 / PIN-A4 of the
manifest): no provider construction, no reservation, no ai_run row -- job +
resume ownership 404s, unit costs from Settings, headroom from the current
month's budget row (Settings cap when none exists; the read never creates
one).

``getMatchReport`` serves the CURRENT version = MAX(version) for the
(tenant, jobId, resumeId) pair (PIN-A7); no report -> 404. Deviation from
the mock (which echoed any ids onto one fixture, validating nothing) is
recorded in the spec.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import col, select

from app import models
from app.ai.base import DeepMatchInput
from app.ai.factory import get_provider
from app.ai_flow import (
    RunAlreadySettled,
    arm_tenant_transaction,
    call_ai_reserve,
    call_ai_settle,
)
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.api.errors import (
    NotFoundError,
    ProviderUnavailableError,
    RateLimitedError,
)
from app.core import throttle
from app.core.config import settings
from app.match_report_mapper import row_to_wire_match_report
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


def _current_month_budget(
    session: TenantSession, user_id: UUID
) -> models.UserAiBudget | None:
    month_start = datetime.now(UTC).date().replace(day=1)
    return session.exec(
        select(models.UserAiBudget)
        .where(models.UserAiBudget.user_id == user_id)
        .where(models.UserAiBudget.month_start == month_start)
    ).first()


def _own_job(
    session: TenantSession, user_id: UUID, job_id: UUID
) -> models.Job | None:
    return session.exec(
        select(models.Job)
        .where(models.Job.id == job_id)
        .where(models.Job.user_id == user_id)
    ).first()


@router.post(
    "/jobs/{id}/preview-deep-score",
    operation_id="previewDeepMatchScore",
    response_model=CostPreview,
)
def preview_deep_match_score(
    id: UUID,
    body: PreviewDeepScoreBody,
    session: TenantSession,
    current_user: CurrentUser,
) -> CostPreview:
    """Cost preview for a deep (paid) match score (previewDeepMatchScore).

    Pure arithmetic -- AC-04 asserts no provider is ever constructed and no
    ai_run row appears. Unknown/foreign job or resume ids are
    tenant-indistinguishable 404s (deviation from the mock, which validated
    resumeIds not at all).
    """
    if _own_job(session, current_user.id, id) is None:
        raise NotFoundError(f"jobs/{id}")
    for resume_id in body.resumeIds:
        owned = session.exec(
            select(models.Resume.id)
            .where(models.Resume.id == resume_id)
            .where(models.Resume.user_id == current_user.id)
        ).first()
        if owned is None:
            raise NotFoundError(f"resumes/{resume_id}")

    unit_cost = settings.DEEP_MATCH_SCORE_COST_USD
    items = [
        CostPreviewItem(
            resumeId=resume_id,
            model=settings.DEEP_MATCH_SCORE_MODEL,
            estCostUsd=float(unit_cost),
        )
        for resume_id in body.resumeIds
    ]
    total = unit_cost * len(items)
    budget = _current_month_budget(session, current_user.id)
    if budget is None:
        remaining = settings.MONTHLY_AI_CAP_USD
    else:
        remaining = budget.cap_usd - budget.spent_usd - budget.reserved_usd
    remaining = max(Decimal("0"), remaining)
    return CostPreview(
        items=items,
        totalUsd=round(float(total), 2),
        capRemainingUsd=round(float(remaining), 2),
        overCap=total > remaining,
    )


@router.post(
    "/jobs/{id}/deep-score",
    operation_id="runDeepMatchScore",
    response_model=DeepMatchResult,
)
def run_deep_match_score(
    id: UUID,
    body: RunDeepScoreBody,
    session: TenantSession,
    current_user: CurrentUser,
) -> DeepMatchResult:
    """Run a deep (paid) match score through the reservation flow."""
    if not throttle.deep_score_attempt_allowed(user_id=str(current_user.id)):
        raise RateLimitedError(f"jobs/{id}/deep-score")

    # ---- txn 1: ownership + baseline + reservation, then COMMIT ----------
    job_row = _own_job(session, current_user.id, id)
    if job_row is None:
        raise NotFoundError(f"jobs/{id}")
    baseline = job_row.match or {}
    error_paths = {
        "EMP30": f"jobs/{id}/deep-score",
        "EMP33": f"resumes/{body.resumeId}",
        "": f"jobs/{id}/deep-score",
    }
    reserved = call_ai_reserve(
        session,
        job_id=id,
        resume_id=body.resumeId,
        provider=settings.AI_PROVIDER,
        model=settings.DEEP_MATCH_SCORE_MODEL,
        max_usd=settings.DEEP_MATCH_SCORE_COST_USD,
        cap_usd=settings.MONTHLY_AI_CAP_USD,
        error_paths=error_paths,
    )
    run_id = UUID(reserved["run_id"])
    session.commit()

    # ---- provider call: NO transaction open (PIN-A5) ---------------------
    request = DeepMatchInput(
        job_id=id,
        resume_id=body.resumeId,
        unit_cost_usd=settings.DEEP_MATCH_SCORE_COST_USD,
        baseline_score=baseline.get("score"),
        baseline_strengths=list(baseline.get("strengths") or []),
        baseline_gaps=list(baseline.get("gaps") or []),
    )
    try:
        provider = get_provider(settings)
        outcome = provider.deep_match_score(request)
    except Exception as exc:
        # ANY provider failure releases the reservation (PIN-A6), then 503.
        arm_tenant_transaction(session, current_user.id)
        call_ai_settle(
            session, run_id=run_id, outcome="failed", error_paths=error_paths
        )
        session.commit()
        if isinstance(exc, ProviderUnavailableError):
            raise
        raise ProviderUnavailableError(f"jobs/{id}/deep-score") from exc

    # ---- txn 2: settlement + response build, then COMMIT ------------------
    arm_tenant_transaction(session, current_user.id)
    try:
        settled = call_ai_settle(
            session,
            run_id=run_id,
            outcome="succeeded",
            actual_usd=outcome.actual_cost_usd,
            score=outcome.score,
            rubric=outcome.rubric,
            gaps=outcome.gaps,
            strengths=outcome.strengths,
            error_paths=error_paths,
        )
    except RunAlreadySettled:
        # A concurrent retry settled first; the stored report is identical
        # by provider determinism (PIN-A4). Serve it.
        arm_tenant_transaction(session, current_user.id)
        settled = _settlement_snapshot(session, current_user.id, run_id)

    started_at = datetime.fromisoformat(settled["run_created_at"])
    finished_at = datetime.fromisoformat(settled["event_created_at"])
    actual = outcome.actual_cost_usd
    ai_run = AiRunEnvelope(
        provider=provider.name,
        model=settled["model"],
        status=AiRunStatus.succeeded,
        startedAt=started_at,
        finishedAt=finished_at,
        durationMs=int((finished_at - started_at).total_seconds() * 1000),
        estimatedCostUsd=float(settled["reserved_max_usd"]),
        actualCostUsd=float(actual),
        synthetic=provider.synthetic,
    )
    result = DeepMatchResult(
        jobId=id,
        resumeId=body.resumeId,
        score=outcome.score,
        kind=DeepMatchKind.deep,
        strengths=list(outcome.strengths),
        gaps=[gap["text"] for gap in outcome.gaps],
        costUsd=round(float(actual), 2),
        aiRun=ai_run,
    )
    session.commit()
    return result


def _settlement_snapshot(
    session: TenantSession, user_id: UUID, run_id: UUID
) -> dict[str, str]:
    """Rebuild the settle return payload for an already-settled run (the
    RunAlreadySettled race branch)."""
    run = session.exec(
        select(models.AiRun)
        .where(models.AiRun.id == run_id)
        .where(models.AiRun.user_id == user_id)
    ).one()
    event = session.exec(
        select(models.AiRunEvent)
        .where(models.AiRunEvent.run_id == run_id)
        .where(models.AiRunEvent.user_id == user_id)
        .where(col(models.AiRunEvent.kind) == "succeeded")
    ).one()
    return {
        "run_created_at": run.created_at.isoformat(),
        "event_created_at": event.created_at.isoformat(),
        "reserved_max_usd": str(run.reserved_max_usd),
        "model": run.model,
    }


@router.get("/match-report", operation_id="getMatchReport", response_model=MatchReport)
def get_match_report(
    session: TenantSession,
    current_user: CurrentUser,
    resumeId: UUID = Query(...),  # noqa: N803 -- wire name verbatim
    jobId: UUID = Query(...),  # noqa: N803 -- wire name verbatim
) -> MatchReport:
    """Match report for a (resume, job) pair (getMatchReport, DB-backed).

    Serves the CURRENT version (MAX(version), PIN-A7). Unknown pair,
    foreign resume, foreign job, and never-scored pair are all the same 404
    (tenant-indistinguishable).
    """
    row = session.exec(
        select(models.MatchReport)
        .where(models.MatchReport.user_id == current_user.id)
        .where(models.MatchReport.job_id == jobId)
        .where(models.MatchReport.resume_id == resumeId)
        .order_by(col(models.MatchReport.version).desc())
        .limit(1)
    ).first()
    if row is None:
        raise NotFoundError(f"match-report?resumeId={resumeId}&jobId={jobId}")
    return row_to_wire_match_report(row)
