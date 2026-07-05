"""Applications resource -- the post-commit lifecycle (ADR-006 / D6..D19).

Follows the SCAFFOLD PATTERN in ``routes/searches.py`` (read that file's header
first): one router per resource, explicit ``operation_id`` verbatim from
``mvp-api.yaml``, generated ``response_model``, store access via
``app.scaffold.store``, typed errors (never ``HTTPException``), no auth deps.

``transitionApplication`` is the core op. Its legal-move matrix
(:data:`LEGAL_TRANSITIONS`) is DATA transcribed VERBATIM from the settled law
in ``employa-bot-front-end/docs/product/story-map/state-machines.md`` -->
"Application stages" (the stateDiagram + its table + the meta-rules), NOT from
this author's judgment. Edges owned by the SEPARATE lifecycle ops are
deliberately excluded from this matrix:

  * ``won -> offer`` (undo mark-won grace window) is ``undoMarkWon`` territory.
  * terminal -> prior-stage reactivation is ``reactivateApplication``.
  * post-APPLIED dismiss -> WITHDREW is ``dismissApplication`` (D12); the matrix
    only carries the pre-commit ``saved|drafting -> dismissed`` edges.

Two contract rules pydantic cannot express live in route logic (per the
scaffold README carry-forward note): (1) ``resumeId`` is REQUIRED when
``targetStage == applied`` -> 422 ``validation_error``; (2) ``expectedVersion``
must equal ``Application.version`` -> 409 ``conflict``.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel

from app.scaffold import store
from app.scaffold.errors import (
    ConflictError,
    InvalidTransitionError,
    NotFoundError,
    UndoWindowExpiredError,
    ValidationTaggedError,
)
from app.scaffold.models import (
    Actor,
    Application,
    ApplicationView,
    Cadence,
    Classification,
    Commitment,
    CreateApplicationInput,
    DismissResult,
    Employment,
    Job,
    JobCaptureMethod,
    JobLocation,
    JobMatch,
    JobSource,
    JobWorkMode,
    MarkWonInput,
    MarkWonResult,
    Outcome,
    Outcome1,
    ResumeSnapshot,
    Search,
    Stage,
    StageTransition,
    State,
    TimelineEvent,
    TransitionInput,
    TransitionResult,
    TransitionSource,
)

router = APIRouter(tags=["applications"])

UNDO_WINDOW_SECONDS = 300

# ---------------------------------------------------------------------------
# Legal stage-transition matrix (state-machines.md#application-stages).
# Source lines transcribed: the "Application stages" stateDiagram-v2 edges
# (state-machines.md lines ~41-79) plus the meta-rules (~100-107). Terminal
# sources map to the empty set -- leaving them is illegal via THIS op (their
# only legal exit is reactivateApplication).
# ---------------------------------------------------------------------------
LEGAL_TRANSITIONS: dict[Stage, frozenset[Stage]] = {
    # [*] --> SAVED / DRAFTING are creation entries, not transitions.
    Stage.saved: frozenset({Stage.drafting, Stage.dismissed}),
    Stage.drafting: frozenset({Stage.applied, Stage.dismissed}),
    Stage.applied: frozenset(
        {Stage.screening, Stage.rejected, Stage.ghosted, Stage.withdrew}
    ),
    Stage.screening: frozenset(
        {Stage.interview, Stage.rejected, Stage.ghosted, Stage.withdrew}
    ),
    Stage.interview: frozenset(
        {
            Stage.offer,
            Stage.screening,  # backward, TRK-021 (extra tech screen)
            Stage.won,  # skip-ahead (informal offer; flagged non-canonical)
            Stage.rejected,
            Stage.ghosted,
            Stage.withdrew,
        }
    ),
    Stage.offer: frozenset(
        {Stage.won, Stage.offer_rescinded, Stage.withdrew, Stage.ghosted}
    ),
    Stage.won: frozenset({Stage.offer_rescinded}),  # company pulls AFTER accept
    Stage.offer_rescinded: frozenset({Stage.won}),  # company reverses (rare)
    Stage.rejected: frozenset(),
    Stage.ghosted: frozenset(),
    Stage.withdrew: frozenset(),
    Stage.dismissed: frozenset(),
}


# ---------------------------------------------------------------------------
# Hand-authored request bodies for the two ops whose bodies mvp-api.yaml
# inlines as anonymous objects (no $ref -> datamodel-codegen emits no model).
# ---------------------------------------------------------------------------


class UndoMarkWonBody(BaseModel):
    """Anonymous inline body for ``POST /applications/{id}/undo-mark-won``."""

    undoToken: UUID


class DismissBody(BaseModel):
    """Anonymous inline body for ``POST /applications/{id}/dismiss``."""

    reasons: list[str] | None = None


# ---------------------------------------------------------------------------
# collection + item reads
# ---------------------------------------------------------------------------


@router.get(
    "/applications",
    operation_id="getApplications",
    response_model=list[ApplicationView],
)
def get_applications(
    searchId: UUID | None = Query(default=None),  # noqa: N803 -- wire name verbatim
) -> list[ApplicationView]:
    """Applications scoped to a saved search (getApplications).

    Mirrors mock api.ts: BACKEND / AI_INFRA searches select their pool; any
    other value (including omitted/unknown) falls back to the canonical
    platform list.
    """
    if searchId == store.SEARCH_ID_BACKEND:
        target = store.SEARCH_ID_BACKEND
    elif searchId == store.SEARCH_ID_AI_INFRA:
        target = store.SEARCH_ID_AI_INFRA
    else:
        target = store.SEARCH_ID_PLATFORM
    return [
        store.application_view(app)
        for app in store.applications.values()
        if app.searchId == target
    ]


@router.get(
    "/applications/{id}",
    operation_id="getApplication",
    response_model=ApplicationView,
)
def get_application(id: UUID) -> ApplicationView:
    """One application, joined view (getApplication). 404 on unknown id."""
    app = store.applications.get(id) or store.archive.get(id)
    if app is None:
        raise NotFoundError(f"applications/{id}")
    return store.application_view(app)


def _ensure_default_search() -> UUID:
    """Port of mock ensureDefaultSearch (D15): a capture always lands in a
    search. Prefer an existing "My jobs"; else the last-used (last-added)
    search; else auto-create the "My jobs" sentinel so searchId is never null.
    """
    for search in store.searches.values():
        if search.name == "My jobs":
            return search.id
    existing = list(store.searches.values())
    if existing:
        return existing[-1].id
    sentinel = Search(
        id=uuid4(),
        name="My jobs",
        state=State.active,
        criteria=store.BLANK_CRITERIA.model_copy(),
        jobsInInbox=0,
        activeApplications=0,
        shortlisted=0,
        offers=0,
        spendMoUsd=0,
    )
    store.searches[sentinel.id] = sentinel
    return sentinel.id


@router.post(
    "/applications",
    operation_id="createApplication",
    response_model=ApplicationView,
    status_code=201,
)
def create_application(body: CreateApplicationInput) -> ApplicationView:
    """Create an application (createApplication, ORI-014).

    Normalized (ADR-006): mints a Job posting into ``store.jobs`` as a side
    effect (mirrors the mock's dynamic-job mint) plus an ids-only Application
    at stage DRAFTING, and returns the joined view. searchId is auto-assigned
    via :func:`_ensure_default_search` when the client omits it (D15).
    """
    now = store.now()
    job_id = uuid4()
    job = Job(
        id=job_id,
        company=body.company,
        title=body.role,
        location=JobLocation(raw=body.location),
        workMode=JobWorkMode.onsite,
        employment=Employment(
            classification=Classification.w2,
            cadence=Cadence.salary,
            commitment=Commitment.full_time,
        ),
        compensation=body.salary,
        source=JobSource(
            board=body.source, channel=JobCaptureMethod.url, capturedAt=now
        ),
        posted=now,
        match=JobMatch(score=body.match, strengths=[], gaps=[]),
    )
    store.jobs[job_id] = job
    new_app = Application(
        id=uuid4(),
        jobId=job_id,
        resumeId=body.resumeId,
        stage=Stage.drafting,
        version=1,
        createdAt=now,
        outcomeReasons=None,
        searchId=body.searchId or _ensure_default_search(),
    )
    store.applications[new_app.id] = new_app
    return store.application_view(new_app)


# ---------------------------------------------------------------------------
# transitionApplication -- the core op
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/transitions",
    operation_id="transitionApplication",
    response_model=TransitionResult,
)
def transition_application(id: UUID, body: TransitionInput) -> TransitionResult:
    """Apply a stage transition, append-only (transitionApplication).

    Order of checks: unknown id -> 404; version mismatch -> 409 ``conflict``;
    illegal target per :data:`LEGAL_TRANSITIONS` -> 422 ``invalid_transition``;
    ``applied`` without ``resumeId`` -> 422 ``validation_error``. On success a
    transition to ``applied`` materializes the immutable ResumeSnapshot (D10);
    every transition appends an immutable StageTransition, bumps the version,
    and appends a timeline event.
    """
    app = store.applications.get(id)
    if app is None:
        raise NotFoundError(f"applications/{id}")
    if body.expectedVersion != app.version:
        raise ConflictError(
            f"applications/{id}/transitions: expectedVersion "
            f"{body.expectedVersion} != current {app.version}"
        )
    if body.targetStage not in LEGAL_TRANSITIONS.get(app.stage, frozenset()):
        raise InvalidTransitionError(
            f"applications/{id}: {app.stage.value} -> {body.targetStage.value} "
            "is not a legal transition"
        )
    if body.targetStage == Stage.applied and body.resumeId is None:
        raise ValidationTaggedError(
            f"applications/{id}: resumeId is required when targetStage=applied"
        )

    now = store.now()
    updates: dict[str, object] = {
        "stage": body.targetStage,
        "version": app.version + 1,
    }
    if body.targetStage == Stage.applied and body.resumeId is not None:
        resume = store.resumes.get(body.resumeId)
        snapshot = ResumeSnapshot(
            id=uuid4(),
            applicationId=app.id,
            resumeId=body.resumeId,
            name=resume.name if resume else "Submitted resume",
            body=(
                resume.body
                if resume and resume.body
                else "Submitted resume -- locked at APPLIED."
            ),
            templateVersion="v1",
            capturedAt=now,
        )
        store.resume_snapshots[app.id] = snapshot
        updates["resumeId"] = body.resumeId
        updates["submittedSnapshotId"] = str(snapshot.id)

    updated = app.model_copy(update=updates)
    store.applications[app.id] = updated

    transition = StageTransition(
        id=uuid4(),
        applicationId=app.id,
        fromStage=app.stage,
        toStage=body.targetStage,
        source=body.source or TransitionSource.user,
        reason=body.reason,
        reasons=body.reasons,
        resumeId=body.resumeId if body.targetStage == Stage.applied else None,
        createdAt=now,
    )
    store.transition_logs.setdefault(app.id, []).append(transition)
    store.timelines.setdefault(app.id, []).append(
        TimelineEvent(
            id=uuid4(),
            time=now,
            who="You",
            message=f"Moved to {body.targetStage.value}",
            actor=Actor.you,
        )
    )
    return TransitionResult(
        application=store.application_view(updated), transition=transition
    )


# ---------------------------------------------------------------------------
# resume snapshot (D10)
# ---------------------------------------------------------------------------


@router.get(
    "/applications/{id}/snapshot",
    operation_id="getResumeSnapshot",
    response_model=ResumeSnapshot,
)
def get_resume_snapshot(id: UUID) -> ResumeSnapshot:
    """Immutable submitted-resume snapshot (getResumeSnapshot, D10).

    Mock parity: 404 on unknown id; 409 ``conflict`` before APPLIED (no
    submitted copy exists until then). A real snapshot captured at the APPLIED
    transition takes precedence; otherwise one is synthesized from the
    application's selected resume (the seeded applied+ rows have no captured
    snapshot, mirroring the mock's on-the-fly synthesis).
    """
    app = store.applications.get(id) or store.archive.get(id)
    if app is None:
        raise NotFoundError(f"applications/{id}/snapshot")
    if app.stage in (Stage.saved, Stage.drafting):
        raise ConflictError(
            f"applications/{id}/snapshot: no submitted copy exists until "
            "the application reaches APPLIED."
        )
    captured = store.resume_snapshots.get(id)
    if captured is not None:
        return captured
    resume = store.resumes.get(app.resumeId) if app.resumeId else None
    resume_id = app.resumeId or uuid5(NAMESPACE_URL, "mock:no-resume")
    return ResumeSnapshot(
        id=uuid5(NAMESPACE_URL, f"mock:snapshot:{id}"),
        applicationId=id,
        resumeId=resume_id,
        name=resume.name if resume else "Submitted resume",
        body=resume.body
        if resume and resume.body
        else "Submitted resume content -- locked at APPLIED.",
        templateVersion="v1",
        capturedAt=app.createdAt,
    )


# ---------------------------------------------------------------------------
# mark-won / undo (D18)
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/mark-won",
    operation_id="markWon",
    response_model=MarkWonResult,
)
def mark_won(id: UUID, body: MarkWonInput | None = Body(default=None)) -> MarkWonResult:
    """Mark an application WON, archive it, return a 300s undo grant (markWon).

    Records the outcome, moves the app from the active pool to the archive, and
    stores a time-boxed undo grant keyed by token (reversible via undoMarkWon).
    """
    app = store.applications.get(id)
    if app is None:
        raise NotFoundError(f"applications/{id}/mark-won")
    now = store.now()
    won = app.model_copy(
        update={
            "stage": Stage.won,
            "outcome": Outcome.won,
            "outcomeAt": now,
            "outcomeReason": body.whatWorked if body else None,
        }
    )
    del store.applications[id]
    store.archive[id] = won
    token = uuid4()
    expires_at = now + timedelta(seconds=UNDO_WINDOW_SECONDS)
    store.undo_grants[token] = store.UndoGrant(application=app, expires_at=expires_at)
    return MarkWonResult(
        application=store.application_view(won),
        undoToken=token,
        undoExpiresAt=expires_at,
        undoWindowSeconds=UNDO_WINDOW_SECONDS,
    )


@router.post(
    "/applications/{id}/undo-mark-won",
    operation_id="undoMarkWon",
    response_model=ApplicationView,
)
def undo_mark_won(id: UUID, body: UndoMarkWonBody) -> ApplicationView:
    """Reverse a mark-won within the grace window (undoMarkWon, D18).

    Unknown token (or one not belonging to this application) -> 404; an expired
    window -> 409 ``undo_window_expired``. On success the original pre-win
    application is restored to the active pool.
    """
    grant = store.undo_grants.get(body.undoToken)
    if grant is None or grant.application.id != id:
        raise NotFoundError(f"applications/{id}/undo-mark-won")
    if store.now() > grant.expires_at:
        del store.undo_grants[body.undoToken]
        raise UndoWindowExpiredError(
            f"applications/{id}/undo-mark-won: the undo window has expired."
        )
    store.archive.pop(grant.application.id, None)
    store.applications[grant.application.id] = grant.application
    del store.undo_grants[body.undoToken]
    return store.application_view(grant.application)


# ---------------------------------------------------------------------------
# reactivate (D19)
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/reactivate",
    operation_id="reactivateApplication",
    response_model=ApplicationView,
)
def reactivate_application(id: UUID) -> ApplicationView:
    """Reactivate a closed/archived application (reactivateApplication, D19).

    Clears the terminal outcome and re-enters the pipeline at APPLIED with
    ``resurrected=true``. 404 if the id is not in the archive.
    """
    archived = store.archive.get(id)
    if archived is None:
        raise NotFoundError(f"applications/{id}/reactivate")
    revived = archived.model_copy(
        update={
            "stage": Stage.applied,
            "outcome": None,
            "outcomeAt": None,
            "outcomeReason": None,
            "outcomeReasons": None,
            "resurrected": True,
            "version": archived.version + 1,
        }
    )
    del store.archive[id]
    store.applications[id] = revived
    return store.application_view(revived)


# ---------------------------------------------------------------------------
# dismiss (D12, dual-mode)
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/dismiss",
    operation_id="dismissApplication",
    response_model=DismissResult,
)
def dismiss_application(
    id: UUID, body: DismissBody | None = Body(default=None)
) -> DismissResult:
    """Dismiss an application (dismissApplication, D12 dual-mode).

    Pre-commit (SAVED/DRAFTING): hard-removed, ``outcome=removed``. Post-APPLIED
    (any later stage): maps to WITHDREW with reason chips and archives,
    ``outcome=withdrew`` -- a committed application is never silently deleted.
    """
    app = store.applications.get(id)
    if app is None:
        raise NotFoundError(f"applications/{id}/dismiss")
    if app.stage in (Stage.saved, Stage.drafting):
        del store.applications[id]
        return DismissResult(outcome=Outcome1.removed)
    reasons = body.reasons if body else None
    now = store.now()
    withdrawn = app.model_copy(
        update={
            "stage": Stage.withdrew,
            "outcome": Outcome.withdrawn,
            "outcomeAt": now,
            "outcomeReasons": reasons,
            "outcomeReason": reasons[0] if reasons else None,
        }
    )
    del store.applications[id]
    store.archive[id] = withdrawn
    return DismissResult(outcome=Outcome1.withdrew)


# ---------------------------------------------------------------------------
# timeline (TRK-118)
# ---------------------------------------------------------------------------


@router.get(
    "/applications/{id}/timeline",
    operation_id="getApplicationTimeline",
    response_model=list[TimelineEvent],
)
def get_application_timeline(id: UUID) -> list[TimelineEvent]:
    """Append-only audit timeline (getApplicationTimeline, TRK-118).

    Returns the seeded fixture timeline (plus any events appended by
    transitions); falls back to a single synthetic "Applied via <source>"
    event when an application has no seeded timeline. 404 on unknown id.
    """
    events = store.timelines.get(id)
    if events is not None:
        return events
    app = store.applications.get(id) or store.archive.get(id)
    if app is None:
        raise NotFoundError(f"applications/{id}")
    view = store.application_view(app)
    return [
        TimelineEvent(
            id=uuid5(NAMESPACE_URL, f"mock:timeline-synth:{id}"),
            time=app.createdAt,
            who="You",
            message=f"Applied via {view.source}",
            actor=Actor.you,
        )
    ]
