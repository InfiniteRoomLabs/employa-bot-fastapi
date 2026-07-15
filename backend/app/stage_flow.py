"""Route-side driver for the ONE stage-mutation DB function (spec PIN-1).

Every write of ``application.stage``/``version``/outcome fields goes through
``application_stage_transition`` (migration 7a2c91d40e88): the guarded
versioned UPDATE that aborts on zero rows BEFORE any child write, the
seq-anchored history append, the APPLIED snapshot + resume lock in the same
transaction, and the atomic undo-grant mint/claim. app_runtime cannot touch
those tables directly (PIN-19), so this driver is the only mutation path the
routes have.

The function raises typed SQLSTATEs; this driver maps them onto the contract
envelope (mock check order preserved by the routes' own pre-reads -- the
function re-enforces everything under the row lock, so a pre-read can only
change WHICH error a racing request sees, never the stored data):

    EMP04 -> 404 NotFoundError          (row absent / soft-removed / foreign)
    EMP09 -> 409 ConflictError          (expectedVersion mismatch)
    EMP22 -> 422 InvalidTransitionError (stage not in the allowed set)
    EMP4A -> 409 UndoWindowExpiredError (grant consumed or expired)

Any other DBAPIError re-raises untouched (PR-6: never a catch-all).
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text as sa_text
from sqlalchemy.exc import DBAPIError
from sqlmodel import Session

from app.api.errors import (
    ApiError,
    ConflictError,
    InvalidTransitionError,
    NotFoundError,
    UndoWindowExpiredError,
)

_FN_SQL = sa_text(
    "SELECT application_stage_transition("
    " p_application_id => :app_id,"
    " p_target_stage => :target,"
    " p_allowed_from => :allowed_from,"
    " p_expected_version => :expected_version,"
    " p_source => :source,"
    " p_reason => :reason,"
    " p_reasons => CAST(:reasons AS jsonb),"
    " p_resume_id => :resume_id,"
    " p_outcome => :outcome,"
    " p_outcome_reason => :outcome_reason,"
    " p_outcome_reasons => CAST(:outcome_reasons AS jsonb),"
    " p_clear_outcome => :clear_outcome,"
    " p_set_resurrected => :set_resurrected,"
    " p_mint_undo_grant => :mint_undo_grant,"
    " p_undo_window_seconds => :undo_window_seconds,"
    " p_consume_grant => :consume_grant)"
)

_SQLSTATE_TO_ERROR: dict[str, type[ApiError]] = {
    "EMP04": NotFoundError,
    "EMP09": ConflictError,
    "EMP22": InvalidTransitionError,
    "EMP4A": UndoWindowExpiredError,
}


def call_stage_transition(
    session: Session,
    *,
    app_id: UUID,
    target: str,
    allowed_from: list[str],
    error_paths: dict[str, str],
    expected_version: int | None = None,
    source: str = "user",
    reason: str | None = None,
    reasons: list[str] | None = None,
    resume_id: UUID | None = None,
    outcome: str | None = None,
    outcome_reason: str | None = None,
    outcome_reasons: list[str] | None = None,
    clear_outcome: bool = False,
    set_resurrected: bool = False,
    mint_undo_grant: bool = False,
    undo_window_seconds: int | None = None,
    consume_grant: UUID | None = None,
) -> dict[str, Any]:
    """Execute the function on the tenant transaction; map typed failures.

    ``error_paths`` gives the envelope ``path`` prefix per SQLSTATE. EMP04
    uses the prefix VERBATIM (the mock's 404 message is just the path, and
    unknown-vs-foreign must stay byte-identical); the rest append the
    function's primary message, which is formatted to match the mock text.
    """
    try:
        result = (
            session.connection()
            .execute(
                _FN_SQL,
                {
                    "app_id": app_id,
                    "target": target,
                    "allowed_from": allowed_from,
                    "expected_version": expected_version,
                    "source": source,
                    "reason": reason,
                    "reasons": json.dumps(reasons) if reasons is not None else None,
                    "resume_id": resume_id,
                    "outcome": outcome,
                    "outcome_reason": outcome_reason,
                    "outcome_reasons": (
                        json.dumps(outcome_reasons)
                        if outcome_reasons is not None
                        else None
                    ),
                    "clear_outcome": clear_outcome,
                    "set_resurrected": set_resurrected,
                    "mint_undo_grant": mint_undo_grant,
                    "undo_window_seconds": undo_window_seconds,
                    "consume_grant": consume_grant,
                },
            )
            .scalar_one()
        )
    except DBAPIError as exc:
        sqlstate = getattr(exc.orig, "sqlstate", None) or ""
        error_cls = _SQLSTATE_TO_ERROR.get(sqlstate)
        if error_cls is None:
            raise
        prefix = error_paths.get(sqlstate, error_paths.get("", str(app_id)))
        if sqlstate == "EMP04":
            message = prefix
        else:
            diag = getattr(exc.orig, "diag", None)
            primary = getattr(diag, "message_primary", None) or "failed"
            message = f"{prefix}: {primary}"
        session.rollback()
        raise error_cls(message) from exc
    if isinstance(result, str):  # driver returned jsonb as text
        loaded: dict[str, Any] = json.loads(result)  # pragma: no cover
        return loaded  # pragma: no cover -- psycopg3 auto-loads jsonb
    return dict(result)
