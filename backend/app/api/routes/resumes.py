"""Resumes resource -- CRUD + lifecycle actions (RES-019 / CUR-020).

Follows the MOCK ROUTE PATTERN in ``routes/searches.py`` (read that file's
header first). One local deviation worth flagging: ``mvp-api.yaml`` inlines
the ``patchResume`` and ``forkResumeAsDraft`` request bodies as anonymous
objects (no ``$ref``), so ``datamodel-codegen`` never emitted models for them
in ``app.schemas``. ``PatchResumeBody`` / ``ForkResumeInput`` below
are small hand-authored request models for those two bodies only -- every
response still uses the generated ``Resume`` model.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import store
from app.api.deps import get_current_user
from app.api.errors import ConflictError, NotFoundError
from app.schemas import Resume, ResumeTag

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["resumes"])

# Tags a resume must NOT have (plus usedIn > 0) to be deletable (deleteResume).
LOCKED_TAGS = frozenset({ResumeTag.TAILORED, ResumeTag.MASTER, ResumeTag.DEFAULT})


class PatchResumeBody(BaseModel):
    """Anonymous inline body for ``PATCH /resumes/{id}``.

    Collapses 3 mock mutations (renameResume/saveResumeBody/
    patchResumeScoring) onto one PATCH; every field optional, only
    client-sent fields are applied (exclude_unset merge in the route).
    """

    name: str | None = None
    body: str | None = None
    scoringEnabled: bool | None = None


class ForkResumeInput(BaseModel):
    """Anonymous inline body for ``POST /resumes/{id}/fork``."""

    jobId: UUID


@router.get("/resumes", operation_id="getResumes", response_model=list[Resume])
def get_resumes() -> list[Resume]:
    """All resumes (getResumes)."""
    return list(store.resumes.values())


@router.post(
    "/resumes", operation_id="createResume", response_model=Resume, status_code=201
)
def create_resume() -> Resume:
    """Create a blank draft resume (createResume, RES-019).

    Mirrors mock api.ts ``createResume``: no request body, fixed blank
    defaults, tag=DRAFT.
    """
    new_resume = Resume(
        id=uuid4(),
        name="Untitled revision",
        subtitle="",
        version="v1",
        usedIn=0,
        updated=store.now(),
        tag=ResumeTag.DRAFT,
        body="",
    )
    store.resumes[new_resume.id] = new_resume
    return new_resume


@router.get("/resumes/{id}", operation_id="getResume", response_model=Resume)
def get_resume(id: UUID) -> Resume:
    """One resume, id-only (getResume). 404 envelope on unknown id.

    MOCK QUIRK dropped per contract: the mock also resolves by name/array
    index for backwards compat; this route resolves by id only.
    """
    hit = store.resumes.get(id)
    if hit is None:
        raise NotFoundError(f"resumes/{id}")
    return hit


@router.patch("/resumes/{id}", operation_id="patchResume", response_model=Resume)
def patch_resume(id: UUID, body: PatchResumeBody) -> Resume:
    """Patch a resume: rename / save body / toggle scoring (patchResume).

    Collapses 3 mock mutations onto one PATCH; only client-sent fields are
    merged in (``exclude_unset``), matching mock api.ts semantics -- none of
    the three mock mutations touch ``updated`` either, so this route doesn't.
    """
    existing = store.resumes.get(id)
    if existing is None:
        raise NotFoundError(f"resumes/{id}")
    updated = existing.model_copy(update=body.model_dump(exclude_unset=True))
    store.resumes[id] = updated
    return updated


@router.delete("/resumes/{id}", operation_id="deleteResume", status_code=204)
def delete_resume(id: UUID) -> None:
    """Delete a resume (deleteResume, RES-019).

    Guards locked resumes: TAILORED / MASTER / DEFAULT tag, or ``usedIn`` > 0
    -> 409 conflict envelope. Mirrors mock api.ts ``deleteResume``.
    """
    existing = store.resumes.get(id)
    if existing is None:
        raise NotFoundError(f"resumes/{id}")
    if existing.tag in LOCKED_TAGS or existing.usedIn > 0:
        raise ConflictError(f"resumes/{id}/delete")
    del store.resumes[id]


@router.post(
    "/resumes/{id}/duplicate",
    operation_id="duplicateResume",
    response_model=Resume,
    status_code=201,
)
def duplicate_resume(id: UUID) -> Resume:
    """Duplicate a resume as a DRAFT (duplicateResume, RES-019)."""
    source = store.resumes.get(id)
    if source is None:
        raise NotFoundError(f"resumes/{id}")
    copy = source.model_copy(
        update={
            "id": uuid4(),
            "name": f"{source.name} (copy)",
            "tag": ResumeTag.DRAFT,
            "usedIn": 0,
            "updated": store.now(),
        }
    )
    store.resumes[copy.id] = copy
    return copy


@router.post(
    "/resumes/{id}/set-default",
    operation_id="setDefaultResume",
    response_model=list[Resume],
)
def set_default_resume(id: UUID) -> list[Resume]:
    """Set a resume as DEFAULT, demoting the previous DEFAULT to VARIANT.

    Returns the full updated collection (setDefaultResume, RES-019). Mirrors
    mock api.ts: only ``tag`` changes, ``updated`` is left untouched on both
    the promoted and demoted resumes.
    """
    if id not in store.resumes:
        raise NotFoundError(f"resumes/{id}")
    for rid, resume in store.resumes.items():
        if resume.tag == ResumeTag.DEFAULT:
            store.resumes[rid] = resume.model_copy(update={"tag": ResumeTag.VARIANT})
    target = store.resumes[id]
    store.resumes[id] = target.model_copy(update={"tag": ResumeTag.DEFAULT})
    return list(store.resumes.values())


@router.post(
    "/resumes/{id}/fork",
    operation_id="forkResumeAsDraft",
    response_model=Resume,
    status_code=201,
)
def fork_resume_as_draft(id: UUID, body: ForkResumeInput) -> Resume:
    """Fork a resume as a tailored draft for a job (forkResumeAsDraft, CUR-020).

    Mirrors mock api.ts ``forkResumeAsDraft``: copies the basis resume, tags
    the fork DRAFT, resets usedIn/updated. ``jobId`` has no field on the
    ``Resume`` wire shape (mock: "the seam stays -- in a real API this would
    associate the draft"); it's recorded in the private
    ``store.resume_fork_jobs`` provenance side-store instead of being
    silently dropped.
    """
    basis = store.resumes.get(id)
    if basis is None:
        raise NotFoundError(f"resumes/{id}")
    fork = basis.model_copy(
        update={
            "id": uuid4(),
            "name": f"{basis.name} - tailored draft",
            "tag": ResumeTag.DRAFT,
            "usedIn": 0,
            "updated": store.now(),
        }
    )
    store.resumes[fork.id] = fork
    store.resume_fork_jobs[fork.id] = body.jobId
    return fork
