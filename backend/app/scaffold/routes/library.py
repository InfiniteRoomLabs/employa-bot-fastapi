"""Library resource: contacts, projects, accomplishments, answers, credentials,
and the shared trash (soft-delete) lifecycle across the first four kinds.

Follows the SCAFFOLD PATTERN from ``routes/searches.py`` (see that file's
docstring for the numbered rules). Resource-specific judgment calls:

* Soft delete (D24): ``delete*`` routes set ``deletedAt``; every list getter
  filters items where ``deletedAt is not None``. ``restoreLibraryItem`` clears
  it; ``purgeLibraryItem`` removes the row permanently.
* Unknown id on ANY id-addressed route here -- including restore, purge, and
  deletion-impact -- raises ``NotFoundError`` (404), per pattern rule 5. The
  mock ``api.ts`` is lenient (a silent no-op on an unmatched id) because its
  UI never exercises that path; the scaffold enforces the stricter, more
  useful contract behavior instead.
* ``update*`` routes accept the full ``*Draft`` body (the contract's PATCH
  request body is the non-partial Draft schema, not `Partial<Draft>` like the
  mock's TS type) and replace every draft field, bumping ``updated``. Since
  every Draft field is required, this has the same effect as the mock's
  partial-merge for any request a real client can actually send.
* ``deriveAccomplishmentFromProject`` is a synthetic AI op (no provider in
  the scaffold): it snapshots the source Project into a NEW Accomplishment
  with a ``source.projectId`` backlink (NOT live-bound -- editing the Project
  afterward does not change the derived Accomplishment, mirroring mock
  api.ts) and returns a synthetic ``AiRunEnvelope`` (provider="fake",
  status="succeeded", synthetic=true).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter
from pydantic import BaseModel

from app.scaffold import store
from app.scaffold.errors import NotFoundError
from app.scaffold.models import (
    Accomplishment,
    AccomplishmentDeriveResult,
    AccomplishmentDraft,
    AiRunEnvelope,
    AiRunStatus,
    Answer,
    AnswerDraft,
    Contact,
    ContactDraft,
    Credential,
    DeletionImpact,
    Dependent,
    Item,
    LibraryKind,
    Project,
    ProjectDraft,
    Source1,
    TrashEntry,
)

router = APIRouter(tags=["library"])


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------


@router.get("/contacts", operation_id="getContacts", response_model=list[Contact])
def get_contacts() -> list[Contact]:
    """Contacts, soft-deleted excluded (getContacts, D24)."""
    return [c for c in store.contacts.values() if c.deletedAt is None]


@router.post(
    "/contacts", operation_id="createContact", response_model=Contact, status_code=201
)
def create_contact(body: ContactDraft) -> Contact:
    """Create a contact (createContact, CON-001/002)."""
    new_contact = Contact(**body.model_dump(), id=uuid4(), updated=datetime.now(UTC))
    store.contacts[new_contact.id] = new_contact
    return new_contact


@router.get("/contacts/{id}", operation_id="getContact", response_model=Contact)
def get_contact(id: UUID) -> Contact:
    """One contact (getContact). 404 envelope on unknown id."""
    hit = store.contacts.get(id)
    if hit is None:
        raise NotFoundError(f"contacts/{id}")
    return hit


@router.patch("/contacts/{id}", operation_id="updateContact", response_model=Contact)
def update_contact(id: UUID, body: ContactDraft) -> Contact:
    """Update a contact (updateContact). Replaces draft fields, bumps updated."""
    existing = store.contacts.get(id)
    if existing is None:
        raise NotFoundError(f"contacts/{id}")
    updated = existing.model_copy(
        update={**body.model_dump(), "updated": datetime.now(UTC)}
    )
    store.contacts[id] = updated
    return updated


@router.delete("/contacts/{id}", operation_id="deleteContact", status_code=204)
def delete_contact(id: UUID) -> None:
    """Soft-delete a contact into the trash (deleteContact, D24)."""
    existing = store.contacts.get(id)
    if existing is None:
        raise NotFoundError(f"contacts/{id}")
    store.contacts[id] = existing.model_copy(update={"deletedAt": datetime.now(UTC)})


# ---------------------------------------------------------------------------
# Accomplishments
# ---------------------------------------------------------------------------


@router.get(
    "/accomplishments",
    operation_id="getAccomplishments",
    response_model=list[Accomplishment],
)
def get_accomplishments() -> list[Accomplishment]:
    """Accomplishments, soft-deleted excluded (getAccomplishments, D24)."""
    return [a for a in store.accomplishments.values() if a.deletedAt is None]


@router.post(
    "/accomplishments",
    operation_id="createAccomplishment",
    response_model=Accomplishment,
    status_code=201,
)
def create_accomplishment(body: AccomplishmentDraft) -> Accomplishment:
    """Create an accomplishment (createAccomplishment, ACC-001)."""
    new_accomplishment = Accomplishment(
        **body.model_dump(), id=uuid4(), usedIn=0, updated=datetime.now(UTC)
    )
    store.accomplishments[new_accomplishment.id] = new_accomplishment
    return new_accomplishment


@router.patch(
    "/accomplishments/{id}",
    operation_id="updateAccomplishment",
    response_model=Accomplishment,
)
def update_accomplishment(id: UUID, body: AccomplishmentDraft) -> Accomplishment:
    """Update an accomplishment. Replaces draft fields, bumps updated."""
    existing = store.accomplishments.get(id)
    if existing is None:
        raise NotFoundError(f"accomplishments/{id}")
    updated = existing.model_copy(
        update={**body.model_dump(), "updated": datetime.now(UTC)}
    )
    store.accomplishments[id] = updated
    return updated


@router.delete(
    "/accomplishments/{id}", operation_id="deleteAccomplishment", status_code=204
)
def delete_accomplishment(id: UUID) -> None:
    """Soft-delete an accomplishment (deleteAccomplishment, D24)."""
    existing = store.accomplishments.get(id)
    if existing is None:
        raise NotFoundError(f"accomplishments/{id}")
    store.accomplishments[id] = existing.model_copy(
        update={"deletedAt": datetime.now(UTC)}
    )


class DeriveAccomplishmentFromProjectBody(BaseModel):
    """Local request-body shape for deriveAccomplishmentFromProject.

    The contract inlines this object (``{projectId}``) rather than naming a
    reusable schema, so ``datamodel-codegen`` did not emit a model for it in
    ``app.scaffold.models``. Defined here rather than editing the generated
    file.
    """

    projectId: UUID


@router.post(
    "/accomplishments/derive-from-project",
    operation_id="deriveAccomplishmentFromProject",
    response_model=AccomplishmentDeriveResult,
    status_code=201,
)
def derive_accomplishment_from_project(
    body: DeriveAccomplishmentFromProjectBody,
) -> AccomplishmentDeriveResult:
    """Distill a Project into a NEW accomplishment (deriveAccomplishmentFromProject, ACC-002).

    Synthetic AI op -- no provider in the scaffold. Snapshots + backlinks the
    source Project (mirrors mock api.ts: title copied verbatim, summary is
    the project body truncated to 160 chars, tags copied, ``source.projectId``
    set). The result is NOT live-bound to the Project. 404 if the project is
    missing or already soft-deleted (D24: soft-deleted items are not valid
    derive sources).
    """
    project = store.projects.get(body.projectId)
    if project is None or project.deletedAt is not None:
        raise NotFoundError(f"projects/{body.projectId}")
    now = datetime.now(UTC)
    new_accomplishment = Accomplishment(
        id=uuid4(),
        title=project.title,
        summary=project.body[:160],
        tags=list(project.tags),
        source=Source1(projectId=project.id),
        usedIn=0,
        updated=now,
    )
    store.accomplishments[new_accomplishment.id] = new_accomplishment
    ai_run = AiRunEnvelope(
        provider="fake",
        model="fake-1",
        status=AiRunStatus.succeeded,
        startedAt=now,
        finishedAt=now,
        durationMs=0,
        estimatedCostUsd=0,
        actualCostUsd=0,
        synthetic=True,
    )
    return AccomplishmentDeriveResult(accomplishment=new_accomplishment, aiRun=ai_run)


# ---------------------------------------------------------------------------
# Answers
# ---------------------------------------------------------------------------


@router.get("/answers", operation_id="getAnswers", response_model=list[Answer])
def get_answers() -> list[Answer]:
    """Saved answers, soft-deleted excluded (getAnswers, D24)."""
    return [a for a in store.answers.values() if a.deletedAt is None]


@router.post(
    "/answers", operation_id="createAnswer", response_model=Answer, status_code=201
)
def create_answer(body: AnswerDraft) -> Answer:
    """Create an answer (createAnswer, ANS-001)."""
    new_answer = Answer(**body.model_dump(), id=uuid4(), updated=datetime.now(UTC))
    store.answers[new_answer.id] = new_answer
    return new_answer


@router.patch("/answers/{id}", operation_id="updateAnswer", response_model=Answer)
def update_answer(id: UUID, body: AnswerDraft) -> Answer:
    """Update an answer. Replaces draft fields, bumps updated."""
    existing = store.answers.get(id)
    if existing is None:
        raise NotFoundError(f"answers/{id}")
    updated = existing.model_copy(
        update={**body.model_dump(), "updated": datetime.now(UTC)}
    )
    store.answers[id] = updated
    return updated


@router.delete("/answers/{id}", operation_id="deleteAnswer", status_code=204)
def delete_answer(id: UUID) -> None:
    """Soft-delete an answer (deleteAnswer, D24)."""
    existing = store.answers.get(id)
    if existing is None:
        raise NotFoundError(f"answers/{id}")
    store.answers[id] = existing.model_copy(update={"deletedAt": datetime.now(UTC)})


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.get("/projects", operation_id="getProjects", response_model=list[Project])
def get_projects() -> list[Project]:
    """Projects, soft-deleted excluded (getProjects, D24)."""
    return [p for p in store.projects.values() if p.deletedAt is None]


@router.post(
    "/projects", operation_id="createProject", response_model=Project, status_code=201
)
def create_project(body: ProjectDraft) -> Project:
    """Create a project (createProject, PRJ-001)."""
    new_project = Project(**body.model_dump(), id=uuid4(), updated=datetime.now(UTC))
    store.projects[new_project.id] = new_project
    return new_project


@router.patch("/projects/{id}", operation_id="updateProject", response_model=Project)
def update_project(id: UUID, body: ProjectDraft) -> Project:
    """Update a project. Replaces draft fields, bumps updated."""
    existing = store.projects.get(id)
    if existing is None:
        raise NotFoundError(f"projects/{id}")
    updated = existing.model_copy(
        update={**body.model_dump(), "updated": datetime.now(UTC)}
    )
    store.projects[id] = updated
    return updated


@router.delete("/projects/{id}", operation_id="deleteProject", status_code=204)
def delete_project(id: UUID) -> None:
    """Soft-delete a project (deleteProject, D24)."""
    existing = store.projects.get(id)
    if existing is None:
        raise NotFoundError(f"projects/{id}")
    store.projects[id] = existing.model_copy(update={"deletedAt": datetime.now(UTC)})


# ---------------------------------------------------------------------------
# Credentials (read-only, CRD-001, Post-MVP)
# ---------------------------------------------------------------------------


@router.get(
    "/credentials", operation_id="getCredentials", response_model=list[Credential]
)
def get_credentials() -> list[Credential]:
    """Credentials, read-only list (getCredentials, CRD-001)."""
    return list(store.credentials.values())


# ---------------------------------------------------------------------------
# Trash: getTrash / restoreLibraryItem / purgeLibraryItem / getDeletionImpact
# ---------------------------------------------------------------------------
#
# Dispatched per-kind with explicit branches rather than a generic
# "store for kind" helper: each in-memory store dict is concretely typed
# (dict[UUID, Contact], dict[UUID, Project], ...) and Python's dict is
# invariant in its value type, so a helper returning a single
# dict[UUID, Contact | Accomplishment | Answer | Project]-typed view would
# not type-check under mypy strict against the concrete backing dicts.


def _library_item_exists(kind: LibraryKind, id: UUID) -> bool:
    if kind is LibraryKind.contact:
        return id in store.contacts
    if kind is LibraryKind.accomplishment:
        return id in store.accomplishments
    if kind is LibraryKind.answer:
        return id in store.answers
    return id in store.projects


@router.get("/library/trash", operation_id="getTrash", response_model=list[TrashEntry])
def get_trash() -> list[TrashEntry]:
    """All soft-deleted Library entities, newest-deleted first (getTrash, D24)."""
    entries: list[TrashEntry] = [
        TrashEntry(
            kind=LibraryKind.contact, id=c.id, label=c.name, deletedAt=c.deletedAt
        )
        for c in store.contacts.values()
        if c.deletedAt is not None
    ]
    entries += [
        TrashEntry(
            kind=LibraryKind.accomplishment,
            id=a.id,
            label=a.title,
            deletedAt=a.deletedAt,
        )
        for a in store.accomplishments.values()
        if a.deletedAt is not None
    ]
    entries += [
        TrashEntry(
            kind=LibraryKind.answer, id=a.id, label=a.question, deletedAt=a.deletedAt
        )
        for a in store.answers.values()
        if a.deletedAt is not None
    ]
    entries += [
        TrashEntry(
            kind=LibraryKind.project, id=p.id, label=p.title, deletedAt=p.deletedAt
        )
        for p in store.projects.values()
        if p.deletedAt is not None
    ]
    entries.sort(key=lambda e: e.deletedAt, reverse=True)
    return entries


@router.post(
    "/library/{kind}/{id}/restore", operation_id="restoreLibraryItem", status_code=204
)
def restore_library_item(kind: LibraryKind, id: UUID) -> None:
    """Restore a soft-deleted Library item (restoreLibraryItem, D24)."""
    if kind is LibraryKind.contact:
        existing_contact = store.contacts.get(id)
        if existing_contact is None:
            raise NotFoundError(f"library/{kind.value}/{id}")
        store.contacts[id] = existing_contact.model_copy(update={"deletedAt": None})
        return
    if kind is LibraryKind.accomplishment:
        existing_accomplishment = store.accomplishments.get(id)
        if existing_accomplishment is None:
            raise NotFoundError(f"library/{kind.value}/{id}")
        store.accomplishments[id] = existing_accomplishment.model_copy(
            update={"deletedAt": None}
        )
        return
    if kind is LibraryKind.answer:
        existing_answer = store.answers.get(id)
        if existing_answer is None:
            raise NotFoundError(f"library/{kind.value}/{id}")
        store.answers[id] = existing_answer.model_copy(update={"deletedAt": None})
        return
    existing_project = store.projects.get(id)
    if existing_project is None:
        raise NotFoundError(f"library/{kind.value}/{id}")
    store.projects[id] = existing_project.model_copy(update={"deletedAt": None})


@router.delete(
    "/library/{kind}/{id}/purge", operation_id="purgeLibraryItem", status_code=204
)
def purge_library_item(kind: LibraryKind, id: UUID) -> None:
    """Permanently purge a soft-deleted item -- frees quota (purgeLibraryItem, D24)."""
    if kind is LibraryKind.contact:
        if id not in store.contacts:
            raise NotFoundError(f"library/{kind.value}/{id}")
        del store.contacts[id]
        return
    if kind is LibraryKind.accomplishment:
        if id not in store.accomplishments:
            raise NotFoundError(f"library/{kind.value}/{id}")
        del store.accomplishments[id]
        return
    if kind is LibraryKind.answer:
        if id not in store.answers:
            raise NotFoundError(f"library/{kind.value}/{id}")
        del store.answers[id]
        return
    if id not in store.projects:
        raise NotFoundError(f"library/{kind.value}/{id}")
    del store.projects[id]


@router.get(
    "/library/{kind}/{id}/deletion-impact",
    operation_id="getDeletionImpact",
    response_model=DeletionImpact,
)
def get_deletion_impact(kind: LibraryKind, id: UUID) -> DeletionImpact:
    """Dependent-count report before a delete (getDeletionImpact, D24).

    Only Projects have dependents in the frozen contract: Accomplishments
    distilled from a Project reference it via ``source.projectId`` (ACC-002).
    Mirrors mock api.ts, which only reports accomplishment dependents (and
    only live, non-soft-deleted ones) for the ``project`` kind.
    """
    if not _library_item_exists(kind, id):
        raise NotFoundError(f"library/{kind.value}/{id}")

    dependents: list[Dependent] = []
    if kind is LibraryKind.project:
        dependent_items = [
            Item(id=a.id, label=a.title)
            for a in store.accomplishments.values()
            if a.deletedAt is None and a.source is not None and a.source.projectId == id
        ]
        if dependent_items:
            dependents.append(
                Dependent(
                    kind=LibraryKind.accomplishment,
                    count=len(dependent_items),
                    items=dependent_items,
                )
            )
    total = sum(d.count for d in dependents)
    return DeletionImpact(kind=kind, id=id, dependents=dependents, total=total)
