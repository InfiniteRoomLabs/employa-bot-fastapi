"""Resume-lifecycle resource: uploads, career history, templates, exports,
and projections (ADR-007/008, RES-030..037, TPL-001/002).

Follows the MOCK ROUTE PATTERN in ``routes/searches.py`` (read that file's
header first). ``mvp-api.yaml`` inlines the ``createProjection``,
``assignTemplate``, and ``renderExport`` request bodies as anonymous objects
(no ``$ref``), so ``datamodel-codegen`` never emitted models for them in
``app.schemas``. The three ``*Input`` models below are small
hand-authored request models for those bodies only -- every response still
uses the generated models (``Resume``, ``ResumeExport``, ...).
"""

from __future__ import annotations

import re
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import store
from app.api.deps import get_current_user
from app.api.errors import NotFoundError
from app.schemas import (
    CareerHistoryItem,
    Resume,
    ResumeExport,
    ResumeTag,
    ResumeTemplate,
    ResumeUpload,
)

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["resume-lifecycle"])

_VERSION_RE = re.compile(r"^v(\d+)$")


class CreateProjectionInput(BaseModel):
    """Anonymous inline body for ``POST /projections``."""

    name: str
    targetRole: str | None = None
    itemIds: list[UUID]
    templateId: UUID | None = None
    sourceUploadId: UUID | None = None


class AssignTemplateInput(BaseModel):
    """Anonymous inline body for ``PUT /projections/{id}/template``."""

    templateId: UUID


class RenderExportInput(BaseModel):
    """Anonymous inline body for ``POST /exports``."""

    projectionId: UUID


def _bump_template_version(version: str) -> str:
    """Bump a ``vN`` template version string for regenerateExport (D17).

    Falls back to ``"v2"`` for any version string that doesn't match the
    ``vN`` convention used by every seeded template/export.
    """
    match = _VERSION_RE.match(version)
    if match is None:
        return "v2"
    return f"v{int(match.group(1)) + 1}"


@router.get(
    "/resumes/uploads",
    operation_id="getResumeUploads",
    response_model=list[ResumeUpload],
)
def get_resume_uploads() -> list[ResumeUpload]:
    """Uploaded resume files, immutable (getResumeUploads, RES-030)."""
    return list(store.resume_uploads.values())


@router.get(
    "/career-history",
    operation_id="getCareerHistory",
    response_model=list[CareerHistoryItem],
)
def get_career_history() -> list[CareerHistoryItem]:
    """Parsed career-history items, ordered by ordinal (getCareerHistory, RES-031)."""
    return sorted(store.career_history.values(), key=lambda item: item.ordinal)


@router.get(
    "/resumes/templates",
    operation_id="getResumeTemplates",
    response_model=list[ResumeTemplate],
)
def get_resume_templates() -> list[ResumeTemplate]:
    """Resume layout templates (getResumeTemplates, TPL-001)."""
    return list(store.resume_templates.values())


@router.get(
    "/resumes/exports",
    operation_id="getResumeExports",
    response_model=list[ResumeExport],
)
def get_resume_exports() -> list[ResumeExport]:
    """Rendered exports, one-way (getResumeExports, RES-037)."""
    return list(store.resume_exports.values())


@router.get("/projections", operation_id="getProjections", response_model=list[Resume])
def get_projections() -> list[Resume]:
    """Projections = non-FORMAT resumes (getProjections, RES-034)."""
    return [r for r in store.resumes.values() if r.tag != ResumeTag.FORMAT]


@router.post(
    "/projections",
    operation_id="createProjection",
    response_model=Resume,
    status_code=201,
)
def create_projection(body: CreateProjectionInput) -> Resume:
    """Create a master/variant projection (createProjection, RES-034/035).

    Pins ``itemIds`` at creation time: the ``body`` summary text and the
    ``store.resume_projection_items`` snapshot are both computed ONCE here
    and never recomputed from live career-history state, so a later
    career-history change cannot retroactively mutate an existing
    projection (RES-034/035 pinning: "new career history never auto-injects
    into existing projections").
    """
    template_id = body.templateId or store.TEMPLATE_ID_CLASSIC
    projection = Resume(
        id=uuid4(),
        name=body.name,
        subtitle=(
            f"For {body.targetRole}"
            if body.targetRole
            else "Projection over career history"
        ),
        version="v1",
        usedIn=0,
        updated=store.now(),
        tag=ResumeTag.VARIANT,
        targetRole=body.targetRole,
        templateId=template_id,
        sourceUploadId=body.sourceUploadId,
        body=f"Projection including {len(body.itemIds)} career-history items.",
    )
    store.resumes[projection.id] = projection
    store.resume_projection_items[projection.id] = list(body.itemIds)
    return projection


@router.put(
    "/projections/{id}/template", operation_id="assignTemplate", response_model=Resume
)
def assign_template(id: UUID, body: AssignTemplateInput) -> Resume:
    """Assign a template to a projection (assignTemplate, TPL-002)."""
    existing = store.resumes.get(id)
    if existing is None:
        raise NotFoundError(f"projections/{id}")
    updated = existing.model_copy(
        update={"templateId": body.templateId, "updated": store.now()}
    )
    store.resumes[id] = updated
    return updated


@router.post(
    "/exports",
    operation_id="renderExport",
    response_model=ResumeExport,
    status_code=201,
)
def render_export(body: RenderExportInput) -> ResumeExport:
    """Render a projection through its template into an export (renderExport, RES-037)."""
    projection = store.resumes.get(body.projectionId)
    if projection is None:
        raise NotFoundError(f"projections/{body.projectionId}")
    template_id = projection.templateId or store.TEMPLATE_ID_CLASSIC
    export = ResumeExport(
        id=uuid4(),
        projectionId=body.projectionId,
        templateId=template_id,
        templateVersion="v1",
        filename=f"{re.sub(r'\\s+', '_', projection.name)}.pdf",
        generatedAt=store.now(),
        regenerable=True,
    )
    store.resume_exports[export.id] = export
    return export


@router.post(
    "/exports/{id}/regenerate",
    operation_id="regenerateExport",
    response_model=ResumeExport,
    status_code=201,
)
def regenerate_export(id: UUID) -> ResumeExport:
    """Regenerate an export at the current (bumped) template version.

    Creates a NEW export; the original keeps its own provenance and is never
    silently restyled (regenerateExport, RES-037 / D17).
    """
    source = store.resume_exports.get(id)
    if source is None:
        raise NotFoundError(f"exports/{id}")
    regenerated = source.model_copy(
        update={
            "id": uuid4(),
            "templateVersion": _bump_template_version(source.templateVersion),
            "generatedAt": store.now(),
        }
    )
    store.resume_exports[regenerated.id] = regenerated
    return regenerated
