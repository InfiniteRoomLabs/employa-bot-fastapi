"""Coach resource (COA-021 / COA-031 / COA-032 / COA-036).

Follows the ``routes/searches.py`` pattern (see its header for the full rule
list). 2 of this resource's 4 ops are DEFERRED (founder-ruled 2026-07-04,
DECISIONS-NEEDED #1): ``proposeCoachEdit`` and ``saveCoachProposal``. They are
served as mock-parity stubs so the UI functions, but the proposal-approval
state machine they depend on is not frozen. Each is tagged with a
``# DEFERRED (...)`` comment.

``/coach/greeting`` is NOT in the contract (founder ruled 2026-07-04,
DECISIONS-NEEDED #5: canned client copy, no backend route) and is
intentionally not implemented here.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import store
from app.api.deps import get_current_user
from app.api.errors import NotFoundError
from app.schemas import (
    Actor,
    CoachMessage,
    CoachProposal,
    CoachSubject,
    CoachThread,
    CoachThreadScope,
    ContextCard,
    TimelineEvent,
)

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["coach"])


@router.get(
    "/coach/threads", operation_id="getCoachThreads", response_model=list[CoachThread]
)
def get_coach_threads() -> list[CoachThread]:
    """Coach threads (getCoachThreads)."""
    return list(store.coach_threads.values())


class CoachThreadBundle(BaseModel):
    """Response shape for ``getCoachThread`` -- the contract defines this as
    an anonymous inline object (``{thread, messages, context}``), so
    datamodel-codegen emits no named schema for it. Modeled locally here to
    keep ``response_model`` typed per the mock route pattern.
    """

    thread: CoachThread
    messages: list[CoachMessage]
    context: list[ContextCard]


@router.get(
    "/coach/threads/{id}",
    operation_id="getCoachThread",
    response_model=CoachThreadBundle,
)
def get_coach_thread(id: UUID) -> CoachThreadBundle:
    """One thread with messages + context cards (COA-021).

    Mirrors mock api.ts: only the "stripe-followup" thread realizes messages
    in the source design -- every other thread returns an empty list
    (CUR-024 empty state). Context cards fall back to the canonical set for
    any thread id not present in the per-thread map (matches mock's ``??``).
    """
    thread = store.coach_threads.get(id)
    if thread is None:
        raise NotFoundError(f"coach/threads/{id}")
    messages = store.coach_messages if id == store.THREAD_ID_STRIPE else []
    context = store.coach_context_by_thread.get(id, store.COACH_CONTEXT_CARDS)
    return CoachThreadBundle(thread=thread, messages=messages, context=context)


@router.post(
    "/coach/proposals",
    operation_id="proposeCoachEdit",
    response_model=CoachProposal,
    status_code=201,
)
def propose_coach_edit(body: CoachSubject) -> CoachProposal:
    """Coach drafts a change proposal (COA-032, gate 1).

    # DEFERRED (DECISIONS-NEEDED #1): mock-parity stub, real semantics not
    frozen. Returns a canned pending ``CoachProposal`` keyed by
    ``subject.scope``, mirroring the mock's ``COACH_PROPOSAL_FIXTURES``
    lookup (falls back to the 'résumé' fixture for any other scope).
    """
    canned = store.COACH_PROPOSAL_FIXTURES.get(
        body.scope, store.COACH_PROPOSAL_FIXTURES[CoachThreadScope.résumé]
    )
    return canned.model_copy(
        update={"id": str(uuid4()), "subject": body, "status": "pending"}
    )


@router.post(
    "/coach/proposals/{id}/accept",
    operation_id="saveCoachProposal",
    response_model=TimelineEvent,
)
def save_coach_proposal(id: UUID, body: CoachProposal) -> TimelineEvent:
    """Persist an accepted proposal (COA-032 gate 2 / COA-033 / COA-036).

    # DEFERRED (DECISIONS-NEEDED #1): mock-parity stub, real semantics not
    frozen -- no proposal store exists yet to look ``id`` up against (the
    mock accepts any well-formed proposal it's handed). Returns an attributed
    audit event ("Coach, on behalf of you"), matching the mock's return shape.
    """
    del id  # path id is unused: nothing to look up until the machine lands
    return TimelineEvent(
        id=uuid4(),
        time=store.iso_ago(),
        who="Coach",
        actor=Actor.coach_on_behalf,
        message=body.summary,
    )
