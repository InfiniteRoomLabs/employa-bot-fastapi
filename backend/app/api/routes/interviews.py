"""Interview rounds sub-resource (TRK-117 / TRK-127, D3).

Follows the MOCK ROUTE PATTERN in ``routes/searches.py``. Two ops, both tagged
``interviews`` per ``mvp-api.yaml``. ``patchInterviewRound`` enforces the D3 /
TRK-127 mutation allowlist (ONLY date / type / format / status are mutable) in
route logic via a strict (``extra='forbid'``) body model: any other key is a
422 ``validation_error`` (framework-raised, wearing the contract envelope).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app import store
from app.api.deps import get_current_user
from app.api.errors import NotFoundError
from app.schemas import (
    InterviewFormat,
    InterviewRound,
    InterviewStatus,
    InterviewType,
)

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["interviews"])


class InterviewPatchBody(BaseModel):
    """Anonymous inline body for ``PATCH /applications/{appId}/interviews/{roundId}``.

    ``extra='forbid'`` implements the TRK-127 allowlist: only date/type/format/
    status may be sent; any other field -> 422 ``validation_error``.
    """

    model_config = ConfigDict(extra="forbid")

    date: datetime | None = None
    type: InterviewType | None = None
    format: InterviewFormat | None = None
    status: InterviewStatus | None = None


@router.get(
    "/applications/{id}/interviews",
    operation_id="getInterviewRounds",
    response_model=list[InterviewRound],
)
def get_interview_rounds(id: UUID) -> list[InterviewRound]:
    """Interview rounds for an application (getInterviewRounds, TRK-117).

    Filters the round store by ``appId`` (mock parity: an application with no
    rounds returns an empty list, not a 404).
    """
    return [round_ for round_ in store.interview_rounds if round_.appId == id]


@router.patch(
    "/applications/{appId}/interviews/{roundId}",
    operation_id="patchInterviewRound",
    response_model=InterviewRound,
)
def patch_interview_round(
    appId: UUID,  # noqa: N803 -- wire name verbatim
    roundId: UUID,  # noqa: N803 -- wire name verbatim
    body: InterviewPatchBody,
) -> InterviewRound:
    """Update an interview round, allowlisted fields only (patchInterviewRound).

    404 when the round (belonging to that application) does not exist. Only the
    client-sent allowlisted fields are merged (``exclude_unset``); disallowed
    keys are rejected upstream by the strict body model (422).
    """
    for index, round_ in enumerate(store.interview_rounds):
        if round_.id == roundId and round_.appId == appId:
            updated = round_.model_copy(update=body.model_dump(exclude_unset=True))
            store.interview_rounds[index] = updated
            return updated
    raise NotFoundError(f"applications/{appId}/interviews/{roundId}")
