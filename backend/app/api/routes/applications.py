"""Applications resource -- the post-commit lifecycle (ADR-006 / D6..D19).

Since sprint-04 3c, ALL 20 flipped ops on this resource are DB-backed
(docs/sprints/sprint-04-spec.md PIN-6); the DEBT-5 mock-store fallback seam
in ``getApplication``/``getResumeSnapshot`` is gone. Wire mapping lives in
``app/application_mapper.py``; the lifecycle ops (markWon/undoMarkWon/
dismissApplication/reactivateApplication) and ``getApplicationTimeline``
drive the ONE stage-mutation function via ``app.stage_flow`` exactly like
``transitionApplication`` (3b).

* ``getApplications``: RECOGNIZED mock search ids (``SEARCH_ID_BACKEND`` /
  ``SEARCH_ID_AI_INFRA``) keep serving their mock pool verbatim (sprint-03
  PIN-3 precedent -- searches stay mock through Release 0.1). Any OTHER
  value -- explicit ``SEARCH_ID_PLATFORM``, an unrecognized id, or omitted --
  is DB-backed: the caller's active applications (``removed_at IS NULL AND
  outcome IS NULL``), joined to job (+ resume via LEFT JOIN). PR-8: the
  mock's old PLATFORM-fallback pool re-derives to the caller's real DB list,
  since PLATFORM was never a persisted entity -- serving the frozen mock
  snapshot post-flip would split one entity across two stores.
* ``getApplication``: DB only (id + ``removed_at IS NULL`` -- a
  terminal-outcome row IS still readable, only the internal soft-remove
  excludes it). A DB miss is a plain 404; the mock-store fallback (DEBT-5)
  is gone as of 3c -- every op that can produce or mutate an application is
  DB-backed now, so a store-only fixture id (never inserted) 404s here.
* ``createApplication``: keeps the sprint-02 Job mint dual-write's DB half
  (the created job persists as a real row), but no longer mirrors it into
  ``store.jobs`` -- a freshly created application never appears in the mock
  searchId pools, so that mint fed nothing after 3a. The Application write
  is a DB INSERT (``store.applications`` untouched).

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

from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text as sa_text
from sqlalchemy.exc import DBAPIError
from sqlmodel import col, select

from app import models, store
from app.api.deps import CurrentUser, TenantSession, get_current_user
from app.api.errors import (
    ConflictError,
    InvalidTransitionError,
    NotFoundError,
    ValidationTaggedError,
)
from app.application_mapper import (
    joined_applications_query,
    row_to_wire_snapshot,
    row_to_wire_transition,
    row_to_wire_view,
    wire_application_to_row,
)
from app.core.config import settings
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
        joined_applications_query(current_user.id)
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
    """One application, joined view (getApplication, DB-only since 3c).

    A terminal-outcome row IS still readable here -- only the internal
    soft-remove excludes it. DB miss -> 404 (the mock-store fallback,
    DEBT-5, is gone as of 3c: every op that can produce or mutate an
    application is DB-backed now).
    """
    row = session.exec(
        joined_applications_query(current_user.id).where(models.Application.id == id)
    ).first()
    if row is None:
        raise NotFoundError(f"applications/{id}")
    app_row, job_row, resume_row = row
    return row_to_wire_view(app_row, job_row, resume_row)


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

    Normalized (ADR-006): a DB Job row (stage-2 dual write) plus a DB
    Application row at stage DRAFTING, returning the joined view. Since 3c
    the minted job is NOT mirrored into ``store.jobs`` -- a freshly created
    application never appears in the mock searchId pools (those serve
    fixture jobs only), so the mock mint fed nothing once getApplication's
    DEBT-5 fallback was removed. searchId is auto-assigned via
    :func:`_ensure_default_search` when the client omits it (D15). A
    ``resumeId`` the caller does not own (cross-tenant or unknown) is a
    tenant-indistinguishable 404 -- the composite FK is the DB backstop. ONE
    commit, at the end of the tenant transaction; the wire response is built
    from the in-memory rows BEFORE that commit (see get_tenant_session).
    """
    # Validate the resumeId (if any) BEFORE minting the job: a rejected
    # request must not leave a job side-mutation in the DB.
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
    # Sprint-02 (PIN-1): manual capture persists the canonical job row --
    # what getJobs/getJob/this route's own view serve. Added now, committed
    # once at the end (below) with everything else in this transaction.
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
        joined_applications_query(current_user.id).where(models.Application.id == id)
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
    """Immutable submitted-resume snapshot (getResumeSnapshot, D10, DB-only).

    404 on unknown id (the mock-store fallback, DEBT-5, is gone as of 3c);
    409 ``conflict`` before APPLIED. The REAL snapshot row (written by the
    mutation function at the APPLIED transition, PIN-2) takes precedence; a
    stage-past-drafting application with no snapshot row is a seed/test-
    fixture bug (PIN-15 -- every seeded past-drafting row owns a real
    snapshot) and gets the mock's deterministic read-only synthesis rather
    than a 500, but is not expected in steady-state runtime data.
    """
    app_row = session.exec(
        select(models.Application)
        .where(models.Application.id == id)
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
    ).first()
    if app_row is None:
        raise NotFoundError(f"applications/{id}/snapshot")
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


# ---------------------------------------------------------------------------
# mark-won / undo (D18)
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/mark-won",
    operation_id="markWon",
    response_model=MarkWonResult,
)
def mark_won(
    id: UUID,
    session: TenantSession,
    current_user: CurrentUser,
    body: MarkWonInput | None = Body(default=None),
) -> MarkWonResult:
    """Mark an application WON via the mutation function, mint a time-boxed
    undo grant (markWon, D18, DB-backed since 3c).

    Mock parity: an application whose outcome is already set (archived) is a
    404 here, mirroring the mock's active-pool-only ``store.applications``
    lookup (markWon never looked in the archive). Any ACTIVE stage is a
    legal source -- the mock had no stage validation on markWon -- so
    ``allowed_from=[the pre-read stage]`` keeps the guard race-safe without
    re-deriving the whole legal matrix. The undo window comes from
    ``Settings.UNDO_WINDOW_SECONDS`` (closes DEBT-3, W-1 convention).
    """
    app_row = session.exec(
        select(models.Application)
        .where(models.Application.id == id)
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
        .where(col(models.Application.outcome).is_(None))
    ).first()
    if app_row is None:
        raise NotFoundError(f"applications/{id}/mark-won")
    current_stage = app_row.stage

    result = call_stage_transition(
        session,
        app_id=id,
        target=Stage.won.value,
        allowed_from=[current_stage],
        expected_version=None,
        source=TransitionSource.user.value,
        outcome=Outcome.won.value,
        outcome_reason=body.whatWorked if body else None,
        mint_undo_grant=True,
        undo_window_seconds=settings.UNDO_WINDOW_SECONDS,
        error_paths={"EMP04": f"applications/{id}/mark-won"},
    )
    # The function wrote behind the ORM's back; drop stale identity-map state
    # before the re-read, and build the ENTIRE wire response before commit
    # (SET LOCAL role/GUC die at commit -- see get_tenant_session).
    session.expire_all()
    view_row = session.exec(
        joined_applications_query(current_user.id).where(models.Application.id == id)
    ).one()
    response = MarkWonResult(
        application=row_to_wire_view(*view_row),
        undoToken=UUID(result["grant_id"]),
        undoExpiresAt=result["grant_expires_at"],
        undoWindowSeconds=settings.UNDO_WINDOW_SECONDS,
    )
    session.commit()
    return response


@router.post(
    "/applications/{id}/undo-mark-won",
    operation_id="undoMarkWon",
    response_model=ApplicationView,
)
def undo_mark_won(
    id: UUID, body: UndoMarkWonBody, session: TenantSession, current_user: CurrentUser
) -> ApplicationView:
    """Reverse a mark-won within the grace window via a compensating
    transition (undoMarkWon, D18, PIN-3, DB-backed since 3c).

    No pre-read beyond the function itself -- it owns the atomic grant claim
    (PIN-4). ``target='won'``/``allowed_from=['won']`` are the parameters
    the ONE mutation function requires; the function OVERWRITES its internal
    target with the claimed grant's corrected transition's ``from_stage``
    (migration 7a2c91d40e88) before the guarded UPDATE runs, so the REAL
    compensating stage is derived server-side from the grant, never here.
    Passing ``allowed_from=['won']`` still does real work: it validates the
    application is CURRENTLY in ``won`` (the stage markWon left it in) under
    the same row lock the grant claim serializes against. Unknown token (or
    one belonging to another application) -> 404; an expired/already-
    consumed grant -> 409 ``undo_window_expired`` (the function
    distinguishes via EMP04 vs EMP4A). The corrected (``won``) transition
    row is never touched -- history stays intact (PIN-3, AC-06a).
    """
    call_stage_transition(
        session,
        app_id=id,
        target=Stage.won.value,
        allowed_from=[Stage.won.value],
        expected_version=None,
        source=TransitionSource.user_correction.value,
        clear_outcome=True,
        consume_grant=body.undoToken,
        error_paths={
            "EMP04": f"applications/{id}/undo-mark-won",
            "EMP4A": f"applications/{id}/undo-mark-won",
            # COR-O-2: the app can leave `won` (won -> offer_rescinded)
            # between the grant claim and the guarded UPDATE; map the
            # resulting EMP22 to a proper envelope instead of a bare id.
            "EMP22": f"applications/{id}/undo-mark-won",
        },
    )
    session.expire_all()
    view_row = session.exec(
        joined_applications_query(current_user.id).where(models.Application.id == id)
    ).one()
    response = row_to_wire_view(*view_row)
    session.commit()
    return response


# ---------------------------------------------------------------------------
# reactivate (D19)
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/reactivate",
    operation_id="reactivateApplication",
    response_model=ApplicationView,
)
def reactivate_application(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> ApplicationView:
    """Reactivate a closed/archived application via the mutation function
    (reactivateApplication, D19, DB-backed since 3c).

    Pre-read requires a row WITH a terminal outcome set (the DB mirror of
    the mock's archive-only lookup); a non-archived (or unknown) id is a
    404, mock parity. Clears the outcome and re-enters at APPLIED with
    ``resurrected=true``, ``source=user_reactivation``; the function's
    applied-branch SKIPS a fresh snapshot when ``p_set_resurrected`` is set
    (spec: reactivation re-enters applied WITHOUT a new snapshot -- it
    already owns one from its original applied transition, PIN-15).
    """
    app_row = session.exec(
        select(models.Application)
        .where(models.Application.id == id)
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
        .where(col(models.Application.outcome).is_not(None))
    ).first()
    if app_row is None:
        raise NotFoundError(f"applications/{id}/reactivate")
    current_stage = app_row.stage

    call_stage_transition(
        session,
        app_id=id,
        target=Stage.applied.value,
        allowed_from=[current_stage],
        expected_version=None,
        source=TransitionSource.user_reactivation.value,
        clear_outcome=True,
        set_resurrected=True,
        error_paths={"EMP04": f"applications/{id}/reactivate"},
    )
    session.expire_all()
    view_row = session.exec(
        joined_applications_query(current_user.id).where(models.Application.id == id)
    ).one()
    response = row_to_wire_view(*view_row)
    session.commit()
    return response


# ---------------------------------------------------------------------------
# dismiss (D12, dual-mode)
# ---------------------------------------------------------------------------


@router.post(
    "/applications/{id}/dismiss",
    operation_id="dismissApplication",
    response_model=DismissResult,
)
def dismiss_application(
    id: UUID,
    session: TenantSession,
    current_user: CurrentUser,
    body: DismissBody | None = Body(default=None),
) -> DismissResult:
    """Dismiss an application (dismissApplication, D12 dual-mode, PIN-14,
    DB-backed since 3c).

    Pre-commit (SAVED/DRAFTING): soft-removed via the tiny
    ``application_soft_remove`` SECURITY DEFINER helper -- app_runtime has no
    UPDATE on this table at all, so even the internal ``removed_at`` marker
    needs a definer function (PIN-14: no application row is ever hard-deleted
    at runtime; append-only children make that impossible by design).
    Post-APPLIED (any later stage): the ONE mutation function transitions to
    WITHDREW with ``outcome=withdrawn`` and the D16 reason chips, mock
    parity. PIN-12 (deviation from the mock, recorded) applies to the
    post-APPLIED branch only: it bumps ``version`` and appends a
    ``stage_transition`` row where the mock silently did neither. The
    pre-commit branch soft-removes ONLY -- no version bump, no history row
    (removal is not a stage change).
    """
    app_row = session.exec(
        select(models.Application)
        .where(models.Application.id == id)
        .where(models.Application.user_id == current_user.id)
        .where(col(models.Application.removed_at).is_(None))
    ).first()
    if app_row is None:
        raise NotFoundError(f"applications/{id}/dismiss")

    if app_row.stage in (Stage.saved.value, Stage.drafting.value):
        try:
            session.connection().execute(
                sa_text("SELECT application_soft_remove(:app_id)"), {"app_id": id}
            )
        except DBAPIError as exc:
            session.rollback()
            sqlstate = getattr(exc.orig, "sqlstate", None) or ""
            if sqlstate == "EMP04":
                raise NotFoundError(f"applications/{id}/dismiss") from exc
            raise
        session.commit()
        return DismissResult(outcome=Outcome1.removed)

    reasons = body.reasons if body else None
    call_stage_transition(
        session,
        app_id=id,
        target=Stage.withdrew.value,
        allowed_from=[app_row.stage],
        expected_version=None,
        source=TransitionSource.user.value,
        outcome=Outcome.withdrawn.value,
        outcome_reasons=reasons,
        outcome_reason=reasons[0] if reasons else None,
        error_paths={"EMP04": f"applications/{id}/dismiss"},
    )
    session.commit()
    return DismissResult(outcome=Outcome1.withdrew)


# ---------------------------------------------------------------------------
# timeline (TRK-118)
# ---------------------------------------------------------------------------


@router.get(
    "/applications/{id}/timeline",
    operation_id="getApplicationTimeline",
    response_model=list[TimelineEvent],
)
def get_application_timeline(
    id: UUID, session: TenantSession, current_user: CurrentUser
) -> list[TimelineEvent]:
    """Append-only audit timeline, DERIVED from ``stage_transition`` -- no
    fifth timeline table (getApplicationTimeline, TRK-118, PIN-13, DB-backed
    since 3c).

    A terminal-outcome row IS still readable (only the internal soft-remove
    excludes it, mirroring getApplication). Each transition row (ordered by
    ``seq``) becomes one event (``message = f"Moved to {toStage}"``); an
    application with ZERO transitions yet (still DRAFTING, never
    transitioned) gets the single mock-parity synthetic "Applied via
    <source>" event instead. 404 on unknown id.
    """
    view_row = session.exec(
        joined_applications_query(current_user.id).where(models.Application.id == id)
    ).first()
    if view_row is None:
        raise NotFoundError(f"applications/{id}")
    app_row, job_row, resume_row = view_row
    transitions = session.exec(
        select(models.StageTransition)
        .where(models.StageTransition.application_id == id)
        .where(models.StageTransition.user_id == current_user.id)
        .order_by(col(models.StageTransition.seq))
    ).all()
    if transitions:
        return [
            TimelineEvent(
                id=tr.id,
                time=tr.created_at,
                who="You",
                message=f"Moved to {tr.to_stage}",
                actor=Actor.you,
            )
            for tr in transitions
        ]
    view = row_to_wire_view(app_row, job_row, resume_row)
    return [
        TimelineEvent(
            id=uuid5(NAMESPACE_URL, f"mock:timeline-synth:{id}"),
            time=app_row.created_at,
            who="You",
            message=f"Applied via {view.source}",
            actor=Actor.you,
        )
    ]
