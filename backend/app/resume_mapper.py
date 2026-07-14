"""Wire <-> row mapping for the resume vertical (sprint-04 3a).

``schemas.Resume`` is the frozen contract shape; ``models.Resume`` is the
tenant child row. ``fork_job_id`` is a row-only provenance column (PIN-18):
it has NO field on the wire ``Resume`` shape, so ``wire_resume_to_row`` takes
it as an explicit keyword (default ``None``) rather than reading it off the
wire object, and ``row_to_wire_resume`` never emits it.

``row_to_wire_resume`` funnels through ``schemas.Resume.model_validate`` so
any row the DB can hold that the wire cannot express fails loudly (the
runtime drift guard).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app import schemas
from app.models import Resume as ResumeRow


def wire_resume_to_row(
    resume: schemas.Resume, *, user_id: UUID, fork_job_id: UUID | None = None
) -> ResumeRow:
    """Build the tenant child row for a wire Resume (create/duplicate/fork)."""
    return ResumeRow(
        id=resume.id,
        user_id=user_id,
        name=resume.name,
        subtitle=resume.subtitle,
        version=resume.version,
        used_in=resume.usedIn,
        updated=resume.updated,
        tag=resume.tag.value,
        match=resume.match,
        body=resume.body,
        source_upload_id=resume.sourceUploadId,
        template_id=resume.templateId,
        target_role=resume.targetRole,
        scoring_enabled=resume.scoringEnabled,
        fork_job_id=fork_job_id,
    )


def row_to_wire_resume(row: ResumeRow) -> schemas.Resume:
    """Validate the tenant child row back into the wire shape.

    ``fork_job_id`` is deliberately NOT included -- it has no wire field.
    """
    payload: dict[str, Any] = {
        "id": row.id,
        "name": row.name,
        "subtitle": row.subtitle,
        "version": row.version,
        "usedIn": row.used_in,
        "updated": row.updated,
        "tag": row.tag,
        "match": row.match,
        "body": row.body,
        "sourceUploadId": row.source_upload_id,
        "templateId": row.template_id,
        "targetRole": row.target_role,
        "scoringEnabled": row.scoring_enabled,
    }
    return schemas.Resume.model_validate(payload)
