"""Archive resource (ORI-009) -- outcome-bucketed closed applications.

Since sprint-04 3a both ops are DB-backed (docs/sprints/sprint-04-spec.md
PIN-16): ``markWon``/``dismissApplication`` (still mock through 3c) move an
application to a terminal outcome, but the archive READ itself is an
outcome-bucketed SELECT over the same ``application`` table ``getApplication``
now serves -- splitting it across the mock store and the DB would be the
exact abandonment-safety seam v3/DEBT-5 forbids. The ``kind`` -> outcome
mapping mirrors the mock exactly: ``won`` -> outcome ``won``; ``passed`` ->
outcome in (``rejected``, ``withdrawn``). Joined views via
``app/application_mapper.py`` (the same ``row_to_wire_view`` getApplications/
getApplication use).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_
from sqlmodel import Session as SqlSession
from sqlmodel import col, select

from app import models
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.application_mapper import row_to_wire_view
from app.schemas import ApplicationView

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["archive"])

_PASSED_OUTCOMES: tuple[str, ...] = ("rejected", "withdrawn")


def _archive_ids(
    session: SqlSession, current_user_id: UUID, wanted: tuple[str, ...]
) -> list[UUID]:
    return list(
        session.exec(
            select(models.Application.id)
            .where(models.Application.user_id == current_user_id)
            .where(col(models.Application.removed_at).is_(None))
            .where(col(models.Application.outcome).in_(wanted))
        ).all()
    )


@router.get("/archive", operation_id="getArchive", response_model=list[ApplicationView])
def get_archive(
    session: TenantSession, current_user: CurrentUser, kind: str = Query(...)
) -> list[ApplicationView]:
    """Archived applications by outcome bucket (getArchive, ORI-009, PIN-16).

    ``kind=won`` -> outcome ``won``; ``kind=passed`` (or any other value) ->
    outcome in (``rejected``, ``withdrawn``), mirroring the mock's fallthrough.
    """
    wanted: tuple[str, ...] = ("won",) if kind == "won" else _PASSED_OUTCOMES
    rows = session.exec(
        select(models.Application, models.Job, models.Resume)
        .join(
            models.Job,
            and_(
                col(models.Job.id) == col(models.Application.job_id),
                col(models.Job.user_id) == current_user.id,
            ),
        )
        .outerjoin(
            models.Resume,
            and_(
                col(models.Resume.id) == col(models.Application.resume_id),
                col(models.Resume.user_id) == current_user.id,
            ),
        )
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
        .where(col(models.Application.outcome).in_(wanted))
    ).all()
    return [
        row_to_wire_view(app_row, job_row, resume_row)
        for app_row, job_row, resume_row in rows
    ]


@router.get("/archive/counts", operation_id="getArchiveCounts")
def get_archive_counts(
    session: TenantSession, current_user: CurrentUser
) -> dict[str, int]:
    """Live archive badge counts (getArchiveCounts, DB-backed).

    ``won`` = outcome ``won``; ``passed`` = outcome in (``rejected``,
    ``withdrawn``).
    """
    won = len(_archive_ids(session, current_user.id, ("won",)))
    passed = len(_archive_ids(session, current_user.id, _PASSED_OUTCOMES))
    return {"won": won, "passed": passed}
