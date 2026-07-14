"""Wire <-> row mapping for the applications vertical (sprint-04 3a).

``schemas.Application`` is the frozen contract shape; ``models.Application``
is the tenant child row. ``schemas.ApplicationView`` is the read model --
an ``Application`` joined with its ``Job`` (+ optional ``Resume``), with the
job's display fields flattened on -- the DB-backed equivalent of
``store.application_view`` (``app/store.py`` ~3562), reproduced here EXACTLY:
``company``/``role`` from the job, ``location`` the job's raw location
string, ``salary`` the job's compensation, ``match`` the job's match score
(else 0), ``source`` the job's source board, ``resumeName`` the resume's
name (else the "No resume selected" sentinel).

``row_to_wire_application``/``row_to_wire_view`` funnel through
``schemas.Application.model_validate`` / ``schemas.ApplicationView`` so any
row the DB can hold that the wire cannot express fails loudly (the runtime
drift guard).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app import schemas
from app.job_mapper import row_to_wire_job
from app.models import Application as ApplicationRow
from app.models import Job as JobRow
from app.models import Resume as ResumeRow
from app.models import ResumeSnapshot as ResumeSnapshotRow
from app.models import StageTransition as StageTransitionRow
from app.resume_mapper import row_to_wire_resume


def wire_application_to_row(
    app: schemas.Application, *, user_id: UUID
) -> ApplicationRow:
    """Build the tenant child row for a wire Application (create path)."""
    return ApplicationRow(
        id=app.id,
        user_id=user_id,
        job_id=app.jobId,
        resume_id=app.resumeId,
        stage=app.stage.value,
        version=app.version,
        created_at=app.createdAt,
        flag=app.flag.value if app.flag is not None else None,
        contact=app.contact,
        coach_nudge=app.coachNudge,
        resurrected=app.resurrected,
        outcome=app.outcome.value if app.outcome is not None else None,
        outcome_at=app.outcomeAt,
        outcome_reason=app.outcomeReason,
        outcome_reasons=app.outcomeReasons,
        system_reasons=app.systemReasons,
        submitted_snapshot_id=(
            UUID(app.submittedSnapshotId) if app.submittedSnapshotId else None
        ),
        search_id=app.searchId,
    )


def row_to_wire_application(row: ApplicationRow) -> schemas.Application:
    """Validate the tenant child row back into the wire ``Application`` shape.

    ``removed_at`` is deliberately NOT included -- it has no wire field
    (PIN-14, the internal soft-remove marker for pre-commit dismiss).
    """
    payload: dict[str, Any] = {
        "id": row.id,
        "jobId": row.job_id,
        "resumeId": row.resume_id,
        "stage": row.stage,
        "version": row.version,
        "createdAt": row.created_at,
        "flag": row.flag,
        "contact": row.contact,
        "coachNudge": row.coach_nudge,
        "resurrected": row.resurrected,
        "outcome": row.outcome,
        "outcomeAt": row.outcome_at,
        "outcomeReason": row.outcome_reason,
        "outcomeReasons": row.outcome_reasons,
        "systemReasons": row.system_reasons,
        "submittedSnapshotId": (
            str(row.submitted_snapshot_id) if row.submitted_snapshot_id else None
        ),
        "searchId": row.search_id,
    }
    return schemas.Application.model_validate(payload)


def row_to_wire_view(
    app_row: ApplicationRow, job_row: JobRow, resume_row: ResumeRow | None
) -> schemas.ApplicationView:
    """Join an Application row to its Job (+ optional Resume) rows, flattening
    the display fields onto the read model -- the DB-backed equivalent of
    ``store.application_view``. Reproduced field-for-field (see module
    docstring); any drift from the mock's join semantics is a bug here.
    """
    app = row_to_wire_application(app_row)
    job = row_to_wire_job(job_row)
    resume = row_to_wire_resume(resume_row) if resume_row is not None else None
    return schemas.ApplicationView(
        **app.model_dump(),
        job=job,
        resume=resume,
        company=job.company,
        role=job.title,
        location=job.location.raw,
        salary=job.compensation,
        match=job.match.score if job.match else 0,
        source=job.source.board,
        resumeName=resume.name if resume else "No resume selected",
    )


def row_to_wire_transition(row: StageTransitionRow) -> schemas.StageTransition:
    """Validate a history row into the wire ``StageTransition`` shape.

    ``seq`` and ``corrects_transition_id`` are row-only (the wire carries the
    correction lineage via ``source=user_correction`` semantics, not an id).
    """
    payload: dict[str, Any] = {
        "id": row.id,
        "applicationId": row.application_id,
        "fromStage": row.from_stage,
        "toStage": row.to_stage,
        "source": row.source,
        "reason": row.reason,
        "reasons": row.reasons,
        "resumeId": row.resume_id,
        "createdAt": row.created_at,
    }
    return schemas.StageTransition.model_validate(payload)


def row_to_wire_snapshot(row: ResumeSnapshotRow) -> schemas.ResumeSnapshot:
    """Validate a snapshot row into the wire ``ResumeSnapshot`` shape."""
    payload: dict[str, Any] = {
        "id": row.id,
        "applicationId": row.application_id,
        "resumeId": row.resume_id,
        "name": row.name,
        "body": row.body,
        "templateVersion": row.template_version,
        "capturedAt": row.captured_at,
    }
    return schemas.ResumeSnapshot.model_validate(payload)
