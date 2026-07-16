"""Route-side driver for the two budget functions (sprint-05 spec PIN-A1).

Every write of user_ai_budget / ai_run / ai_run_event / match_report goes
through ``ai_reserve_run`` / ``ai_settle_run`` (migration 9c4d1a7e2b31):
the guarded reservation UPDATE on the locked per-user month row, the
server-derived idempotency key + open-run adoption, and the settlement
conversion/release + report INSERT. app_runtime cannot touch those tables
directly (SELECT-only), so this driver is the only mutation path the routes
have.

The functions raise typed SQLSTATEs; this driver maps them onto the
contract envelope (PR-6: never a catch-all):

    EMP30 -> 402 CapReachedError            (reservation would exceed cap)
    EMP33 -> 404 NotFoundError              (job/resume unknown or foreign --
                                             tenant-indistinguishable)
    EMP31 -> 404 NotFoundError              (run unknown or foreign)
    EMP32 -> RunAlreadySettled              (control flow, not an ApiError:
                                             a concurrent retry settled the
                                             run first; the route serves the
                                             existing report)

EMP00/EMP34 and any other DBAPIError re-raise untouched (500-class bugs).

``arm_tenant_transaction`` re-establishes the tenant transaction (SET LOCAL
ROLE + GUC) after a mid-request commit: the reservation flow is the ONE
sanctioned deviation from the commit-once rule -- reserve commits BEFORE the
provider call and settlement is a second transaction (PIN-A5), so both
SET LOCALs of the first transaction are gone by settle time.
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import text as sa_text
from sqlalchemy.exc import DBAPIError
from sqlmodel import Session

from app.api.errors import ApiError, CapReachedError, NotFoundError


class RunAlreadySettled(Exception):
    """EMP32: another request settled this run between our provider call
    and our settle -- benign under a deterministic provider."""


_RESERVE_SQL = sa_text(
    "SELECT ai_reserve_run("
    " p_job_id => :job_id,"
    " p_resume_id => :resume_id,"
    " p_kind => :kind,"
    " p_provider => :provider,"
    " p_model => :model,"
    " p_max_usd => :max_usd,"
    " p_cap_usd => :cap_usd)"
)

_SETTLE_SQL = sa_text(
    "SELECT ai_settle_run("
    " p_run_id => :run_id,"
    " p_outcome => :outcome,"
    " p_actual_usd => :actual_usd,"
    " p_score => :score,"
    " p_rubric => CAST(:rubric AS jsonb),"
    " p_gaps => CAST(:gaps AS jsonb),"
    " p_strengths => CAST(:strengths AS jsonb))"
)


def arm_tenant_transaction(session: Session, user_id: UUID) -> None:
    """Re-arm the app_runtime role + tenant GUC on a fresh transaction
    (both are SET LOCAL and die at commit -- deps.get_tenant_session)."""
    connection = session.connection()
    connection.execute(sa_text("SET LOCAL ROLE app_runtime"))
    connection.execute(
        sa_text("SELECT set_config('app.user_id', :uid, true)"),
        {"uid": str(user_id)},
    )


def _map_and_raise(
    exc: DBAPIError, *, error_paths: dict[str, str], session: Session
) -> None:
    sqlstate = getattr(exc.orig, "sqlstate", None) or ""
    error_cls: type[ApiError] | None = {
        "EMP30": CapReachedError,
        "EMP31": NotFoundError,
        "EMP33": NotFoundError,
    }.get(sqlstate)
    if sqlstate == "EMP32":
        session.rollback()
        raise RunAlreadySettled from exc
    if error_cls is None:
        raise exc
    message = error_paths.get(sqlstate, error_paths.get("", "match"))
    session.rollback()
    raise error_cls(message) from exc


def _scalar_jsonb(result: Any) -> dict[str, Any]:
    if isinstance(result, str):  # pragma: no cover -- psycopg3 auto-loads
        loaded: dict[str, Any] = json.loads(result)
        return loaded
    return dict(result)


def call_ai_reserve(
    session: Session,
    *,
    job_id: UUID,
    resume_id: UUID,
    provider: str,
    model: str,
    max_usd: Decimal,
    cap_usd: Decimal,
    error_paths: dict[str, str],
    kind: str = "deep_match_score",
) -> dict[str, Any]:
    """Reserve headroom (or adopt the open run) inside the CURRENT tenant
    transaction. The caller commits immediately after (short txn, PIN-A5)."""
    try:
        result = (
            session.connection()
            .execute(
                _RESERVE_SQL,
                {
                    "job_id": job_id,
                    "resume_id": resume_id,
                    "kind": kind,
                    "provider": provider,
                    "model": model,
                    "max_usd": max_usd,
                    "cap_usd": cap_usd,
                },
            )
            .scalar_one()
        )
    except DBAPIError as exc:
        _map_and_raise(exc, error_paths=error_paths, session=session)
        raise  # unreachable; keeps the type checker honest
    return _scalar_jsonb(result)


def call_ai_settle(
    session: Session,
    *,
    run_id: UUID | str,
    outcome: str,
    error_paths: dict[str, str],
    actual_usd: Decimal | None = None,
    score: int | None = None,
    rubric: list[dict[str, Any]] | None = None,
    gaps: list[dict[str, Any]] | None = None,
    strengths: list[str] | None = None,
) -> dict[str, Any]:
    """Settle a run (convert or release the reservation) inside the CURRENT
    tenant transaction."""
    try:
        result = (
            session.connection()
            .execute(
                _SETTLE_SQL,
                {
                    "run_id": str(run_id),
                    "outcome": outcome,
                    "actual_usd": actual_usd,
                    "score": score,
                    "rubric": json.dumps(rubric) if rubric is not None else None,
                    "gaps": json.dumps(gaps) if gaps is not None else None,
                    "strengths": (
                        json.dumps(strengths) if strengths is not None else None
                    ),
                },
            )
            .scalar_one()
        )
    except DBAPIError as exc:
        _map_and_raise(exc, error_paths=error_paths, session=session)
        raise  # unreachable
    return _scalar_jsonb(result)
