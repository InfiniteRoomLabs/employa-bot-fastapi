"""Applications resource -- the post-commit lifecycle (ADR-006 / D6..D19).

Since sprint-04 3a, ``getApplications``/``getApplication``/``createApplication``
are DB-backed (docs/sprints/sprint-04-spec.md PIN-6); every other op below
(transitions/lifecycle/snapshot/timeline) STAYS on the MOCK ROUTE PATTERN in
``routes/searches.py`` (read that file's header first) through 3b/3c: store
access via ``app.store``, typed errors (never ``HTTPException``), no
``TenantSession``. Wire mapping for the flipped ops lives in
``app/application_mapper.py``.

* ``getApplications``: RECOGNIZED mock search ids (``SEARCH_ID_BACKEND`` /
  ``SEARCH_ID_AI_INFRA``) keep serving their mock pool verbatim (sprint-03
  PIN-3 precedent -- searches stay mock through Release 0.1). Any OTHER
  value -- explicit ``SEARCH_ID_PLATFORM``, an unrecognized id, or omitted --
  is DB-backed: the caller's active applications (``removed_at IS NULL AND
  outcome IS NULL``), joined to job (+ resume via LEFT JOIN). PR-8: the
  mock's old PLATFORM-fallback pool re-derives to the caller's real DB list,
  since PLATFORM was never a persisted entity -- serving the frozen mock
  snapshot post-flip would split one entity across two stores.
* ``getApplication``: DB first (id + ``removed_at IS NULL`` -- a
  terminal-outcome row IS still readable, matching the mock's archive
  fallback read); a DB miss falls back to the mock store read
  (``store.applications``/``store.archive``) so seeded mock fixtures (still
  referenced by the still-mock lifecycle ops) keep serving. This mock
  fallback is the pre-existing DEBT-5 seam, unchanged this checkpoint -- an
  explicit 3a-internal layer that 3c removes once every op that can produce
  or mutate an application is DB-backed.
* ``createApplication``: keeps the sprint-02 Job mint + ``store.jobs`` + DB
  job dual-write as-is, but the Application write is now a DB INSERT (no
  longer ``store.applications``) -- so a freshly created application is
  readable via ``getApplications``/``getApplication`` but NOT yet
  transitionable via the still-mock lifecycle ops (3b's job).

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
backend README carry-forward note): (1) ``resumeId`` is REQUIRED when
``targetStage == applied`` -> 422 ``validation_error``; (2) ``expectedVersion``
must equal ``Application.version`` -> 409 ``conflict``.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_
from sqlmodel import col, select

from app import models, store
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.api.errors import (
    ConflictError,
    InvalidTransitionError,
    NotFoundError,
    UndoWindowExpiredError,
    ValidationTaggedError,
)
from app.application_mapper import (
    row_to_wire_snapshot,
    row_to_wire_transition,
    row_to_wire_view,
    wire_application_to_row,
)
from app.job_mapper import wire_job_to_row
from app.schemas import (
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
    State,
    TimelineEvent,
    TransitionInput,
    TransitionResult,
    TransitionSource,
)
from app.stage_flow import call_stage_transition

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["applications"])

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


def _joined_applications_query(current_user_id: UUID):  # type: ignore[no-untyped-def]
    """Base SELECT joining application -> job (+ resume via LEFT JOIN), the
    join's ON clauses carrying the app-level tenant predicate as the belt
    (RLS on job/resume is the systemic backstop -- see PIN-7)."""
    return (
        select(models.Application, models.Job, models.Resume)
        .join(
            models.Job,
            and_(
                col(models.Job.id) == col(models.Application.job_id),
                col(models.Job.user_id) == current_user_id,
            ),
        )
        .outerjoin(
            models.Resume,
            and_(
                col(models.Resume.id) == col(models.Application.resume_id),
                col(models.Resume.user_id) == current_user_id,
            ),
        )
        .where(models.Application.user_id == current_user_id)
        .where(col(models.Application.removed_at).is_(None))
    )


@router.get(
    "/applications",
    operation_id="getApplications",
    response_model=list[ApplicationView],
)
def get_applications(
    session: TenantSession,
    current_user: CurrentUser,
    searchId: UUID | None = Query(default=None),  # noqa: N803 -- wire name verbatim
) -> list[ApplicationView]:
    """Applications, joined view (getApplications, PIN-6/PR-8).

    A RECOGNIZED mock search id (BACKEND/AI_INFRA) returns the mock
    per-search projection verbatim (searches stay mock through Release 0.1).
    Any OTHER value -- explicit PLATFORM, an unrecognized id, or omitted --
    is DB-backed: the caller's active applications (excluding soft-removed
    and terminal-outcome rows), ordered created_at then id.
    """
    if searchId == store.SEARCH_ID_BACKEND:
        return [
            store.application_view(app)
            for app in store.applications.values()
            if app.searchId == store.SEARCH_ID_BACKEND
        ]
    if searchId == store.SEARCH_ID_AI_INFRA:
        return [
            store.application_view(app)
            for app in store.applications.values()
            if app.searchId == store.SEARCH_ID_AI_INFRA
        ]
    rows = session.exec(
        _joined_applications_query(current_user.id)
        .where(col(models.Application.outcome).is_(None))
        .order_by(col(models.Application.created_at), col(models.Application.id))
    ).all()
    return [
        row_to_wire_view(app_row, job_row, resume_row)
        for app_row, job_row, resume_row in rows
    ]


@router.get(
    "/applications/{id}",
    operation_id="getApplication",
    response_model=ApplicationView,
)
def get_application(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> ApplicationView:
    """One application, joined view (getApplication, DB-backed).

    DB first (a terminal-outcome row IS still readable here -- only the
    internal soft-remove excludes it). A DB miss falls back to the mock
    store read (``store.applications``/``store.archive``, DEBT-5 -- an
    explicit 3a-internal seam removed in 3c) so seeded mock fixtures still
    referenced by the still-mock lifecycle ops keep serving. Unknown in
    both -> 404.
    """
    row = session.exec(
        _joined_applications_query(current_user.id).where(models.Application.id == id)
    ).first()
    if row is not None:
        app_row, job_row, resume_row = row
        return row_to_wire_view(app_row, job_row, resume_row)
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
def create_application(
    body: CreateApplicationInput,
    session: TenantSession,
    current_user: CurrentUser,
) -> ApplicationView:
    """Create an application (createApplication, ORI-014, DB-backed).

    Normalized (ADR-006): mints a Job posting into ``store.jobs`` as a side
    effect (mirrors the mock's dynamic-job mint, sprint-02 PIN-1's DB dual
    write, unchanged here) plus a DB Application row at stage DRAFTING, and
    returns the joined view. searchId is auto-assigned via
    :func:`_ensure_default_search` when the client omits it (D15). A
    ``resumeId`` the caller does not own (cross-tenant or unknown) is a
    tenant-indistinguishable 404 -- the composite FK is the DB backstop. ONE
    commit, at the end of the tenant transaction; the wire response is built
    from the in-memory rows BEFORE that commit (see get_tenant_session).
    """
    # Validate the resumeId (if any) BEFORE minting the job: a rejected
    # request must not leave a job side-mutation in ``store.jobs``.
    resume_row = None
    if body.resumeId is not None:
        resume_row = session.exec(
            select(models.Resume)
            .where(models.Resume.id == body.resumeId)
            .where(models.Resume.user_id == current_user.id)
        ).first()
        if resume_row is None:
            raise NotFoundError(f"resumes/{body.resumeId}")

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
    # Sprint-02 (PIN-1): manual capture persists the canonical job row. The
    # store copy above stays for the mock joins used by the still-mock
    # lifecycle ops; the DB row is what getJobs/getJob/this route's own view
    # serve. Added now, committed once at the end (below) with everything
    # else in this transaction.
    job_row = wire_job_to_row(job, user_id=current_user.id)
    session.add(job_row)
    # The composite fk_application_job FK is a raw-SQL constraint (DEBT-6):
    # the ORM has no declared relationship between Application and Job, so
    # the unit-of-work has no basis to order the two INSERTs -- flush the
    # job row NOW so it exists in the DB before the application row (which
    # references it) is even staged (same class of ordering trap as
    # set_default_resume's demote-before-promote flush).
    session.flush()

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
    app_row = wire_application_to_row(new_app, user_id=current_user.id)
    session.add(app_row)
    # Build the wire response NOW, from the in-memory rows, while the tenant
    # role/GUC are still live for this transaction (see get_tenant_session).
    result = row_to_wire_view(app_row, job_row, resume_row)
    session.commit()
    return result


# ---------------------------------------------------------------------------
# transitionApplication -- the core op
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/transitions",
    operation_id="transitionApplication",
    response_model=TransitionResult,
)
def transition_application(
    id: UUID,
    body: TransitionInput,
    session: TenantSession,
    current_user: CurrentUser,
) -> TransitionResult:
    """Apply a stage transition via the ONE mutation function (PIN-1, 3b).

    Mock check order, applied on this route's own pre-read exactly like the
    mock applied it on its dict read: unknown id -> 404; version mismatch ->
    409 ``conflict``; illegal target per :data:`LEGAL_TRANSITIONS` -> 422
    ``invalid_transition``; ``applied`` without ``resumeId`` -> 422
    ``validation_error``; then (DB deviation, spec 3b design) a missing OR
    foreign resumeId -> 404, tenant-indistinguishable. The function
    re-enforces every predicate under the row lock -- the guarded versioned
    UPDATE aborts on zero rows before any child write -- so a racing request
    gets a typed error (mapped in ``app.stage_flow``), never partial state.
    APPLIED materializes the snapshot + resume lock in the SAME transaction
    (PIN-2). The op is DB-only post-flip: mock store fixtures are not
    transitionable (they retire in 3c when the seed goes DB-side).
    """
    app_row = session.exec(
        select(models.Application)
        .where(models.Application.id == id)
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
    ).first()
    if app_row is None:
        raise NotFoundError(f"applications/{id}")
    if body.expectedVersion != app_row.version:
        raise ConflictError(
            f"applications/{id}/transitions: expectedVersion "
            f"{body.expectedVersion} != current {app_row.version}"
        )
    current_stage = Stage(app_row.stage)
    if body.targetStage not in LEGAL_TRANSITIONS.get(current_stage, frozenset()):
        raise InvalidTransitionError(
            f"applications/{id}: {current_stage.value} -> {body.targetStage.value} "
            "is not a legal transition"
        )
    if body.targetStage == Stage.applied and body.resumeId is None:
        raise ValidationTaggedError(
            f"applications/{id}: resumeId is required when targetStage=applied"
        )
    if body.targetStage == Stage.applied:
        owned_resume = session.exec(
            select(models.Resume)
            .where(models.Resume.id == body.resumeId)
            .where(models.Resume.user_id == current_user.id)
        ).first()
        if owned_resume is None:
            raise NotFoundError(f"resumes/{body.resumeId}")

    result = call_stage_transition(
        session,
        app_id=id,
        target=body.targetStage.value,
        allowed_from=[current_stage.value],
        expected_version=body.expectedVersion,
        source=(body.source or TransitionSource.user).value,
        reason=body.reason,
        reasons=body.reasons,
        resume_id=body.resumeId if body.targetStage == Stage.applied else None,
        error_paths={
            "EMP04": f"applications/{id}",
            "EMP09": f"applications/{id}/transitions",
            "EMP22": f"applications/{id}",
        },
    )
    # The function wrote behind the ORM's back; drop stale identity-map state
    # before the re-read, and build the ENTIRE wire response before commit
    # (SET LOCAL role/GUC die at commit -- see get_tenant_session).
    session.expire_all()
    view_row = session.exec(
        _joined_applications_query(current_user.id).where(models.Application.id == id)
    ).one()
    transition_row = session.exec(
        select(models.StageTransition)
        .where(models.StageTransition.id == UUID(result["transition_id"]))
        .where(models.StageTransition.user_id == current_user.id)
    ).one()
    response = TransitionResult(
        application=row_to_wire_view(*view_row),
        transition=row_to_wire_transition(transition_row),
    )
    session.commit()
    return response


# ---------------------------------------------------------------------------
# resume snapshot (D10)
# ---------------------------------------------------------------------------


@router.get(
    "/applications/{id}/snapshot",
    operation_id="getResumeSnapshot",
    response_model=ResumeSnapshot,
)
def get_resume_snapshot(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> ResumeSnapshot:
    """Immutable submitted-resume snapshot (getResumeSnapshot, D10, DB 3b).

    Mock parity: 404 on unknown id; 409 ``conflict`` before APPLIED. The
    REAL snapshot row (written by the mutation function at the APPLIED
    transition, PIN-2) takes precedence; a stage-past-drafting application
    with no snapshot row (a runtime path that never legally crossed applied,
    e.g. a future markWon straight from drafting) gets the mock's
    deterministic read-only synthesis. Falls back to the mock store for
    seeded fixtures (same 3a-internal DEBT-5 seam as getApplication,
    removed in 3c).
    """
    app_row = session.exec(
        select(models.Application)
        .where(models.Application.id == id)
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
    ).first()
    if app_row is not None:
        if app_row.stage in (Stage.saved.value, Stage.drafting.value):
            raise ConflictError(
                f"applications/{id}/snapshot: no submitted copy exists until "
                "the application reaches APPLIED."
            )
        snap_row = session.exec(
            select(models.ResumeSnapshot)
            .where(models.ResumeSnapshot.application_id == id)
            .where(models.ResumeSnapshot.user_id == current_user.id)
        ).first()
        if snap_row is not None:
            return row_to_wire_snapshot(snap_row)
        resume_row = (
            session.exec(
                select(models.Resume)
                .where(models.Resume.id == app_row.resume_id)
                .where(models.Resume.user_id == current_user.id)
            ).first()
            if app_row.resume_id
            else None
        )
        resume_id = app_row.resume_id or uuid5(NAMESPACE_URL, "mock:no-resume")
        return ResumeSnapshot(
            id=uuid5(NAMESPACE_URL, f"mock:snapshot:{id}"),
            applicationId=id,
            resumeId=resume_id,
            name=resume_row.name if resume_row else "Submitted resume",
            body=resume_row.body
            if resume_row and resume_row.body
            else "Submitted resume content -- locked at APPLIED.",
            templateVersion="v1",
            capturedAt=app_row.created_at,
        )

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
    fallback_resume_id = app.resumeId or uuid5(NAMESPACE_URL, "mock:no-resume")
    return ResumeSnapshot(
        id=uuid5(NAMESPACE_URL, f"mock:snapshot:{id}"),
        applicationId=id,
        resumeId=fallback_resume_id,
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
