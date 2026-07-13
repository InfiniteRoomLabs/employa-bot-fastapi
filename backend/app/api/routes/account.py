"""Current user + account resources (mock API).

Follows the mock route pattern in ``routes/searches.py`` (read its header
comment first). Two routers: ``user`` (the contract's singular ``/user``
persona read -- distinct from the real DB-backed ``/users/*`` in
``routes/users.py``) and ``account``.

Notes specific to this resource group:

* ``getCurrentUser`` is a singleton read (``store.current_user``).
* ``requestDataExport``/``deleteAccount`` are NOT seeded store state -- the
  mock computes a fresh signed URL / grace-period timestamp on every call
  (``crypto.randomUUID()`` / ``new Date()``), so these routes compute their
  response at request time instead of reading a dict.
* ``AccountDeletionResult`` has no named schema in mvp-api.yaml (the contract
  declares it as an inline object on the 202 response), so datamodel-codegen
  never emitted a model for it. It is defined locally below rather than
  hand-edited into the generated ``schemas.py``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import AnyUrl, AwareDatetime, BaseModel

from app.api.deps import CurrentUser, get_current_user
from app.schemas import DataExportRequest, User

user_router = APIRouter(dependencies=[Depends(get_current_user)], tags=["user"])
account_router = APIRouter(dependencies=[Depends(get_current_user)], tags=["account"])


class AccountDeletionResult(BaseModel):
    """Inline 202 response shape for ``deleteAccount`` (no named contract schema)."""

    gracePeriodEndsAt: AwareDatetime


@user_router.get("/user", operation_id="getCurrentUser", response_model=User)
def get_current_user_op(current_user: CurrentUser) -> User:
    """Current user / persona (getCurrentUser) -- the FIRST implemented op.

    Served from the DATABASE user resolved by the auth dependency, mapped to
    the wire ``User`` (``name <- full_name``, the rest 1:1). Profile fields a
    row may lack (e.g. FIRST_SUPERUSER) fall back to empty/zero -- the wire
    schema requires every field.
    """
    return User(
        name=current_user.full_name or "",
        email=current_user.email,
        initials=current_user.initials or "",
        city=current_user.city or "",
        current=current_user.current or "",
        years=current_user.years or 0,
        comp_floor=current_user.comp_floor or 0,
        target_titles=current_user.target_titles,
    )


@account_router.post(
    "/account/data-export",
    operation_id="requestDataExport",
    response_model=DataExportRequest,
    status_code=202,
)
def request_data_export() -> DataExportRequest:
    """Request a full account data export (requestDataExport, ACC-export).

    Fake signed URL, computed fresh on every call (mirrors mock api.ts's
    ``crypto.randomUUID()`` + ``new Date()`` -- no seeded store state).
    """
    return DataExportRequest(
        url=AnyUrl(f"https://export.employa.app/download/{uuid4()}.zip"),
        requestedAt=datetime.now(UTC),
    )


@account_router.post(
    "/account/delete",
    operation_id="deleteAccount",
    response_model=AccountDeletionResult,
    status_code=202,
)
def delete_account() -> AccountDeletionResult:
    """Initiate account deletion with a 30-day grace period (deleteAccount, ACC-danger)."""
    return AccountDeletionResult(
        gracePeriodEndsAt=datetime.now(UTC) + timedelta(days=30)
    )
