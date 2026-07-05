"""Periphery resources -- user / notifications / settings / account.

Follows the SCAFFOLD PATTERN in ``routes/searches.py`` (read its header
comment first). One ``APIRouter`` per contract tag (``user``, ``notifications``,
``settings``, ``account``) since these four small resources share no store
state; all four are registered in ``router.py``.

Notes specific to this resource group:

* ``getCurrentUser``/``getSettings``/``getUsageAggregate`` are singleton reads
  (``store.current_user`` / ``store.settings`` / ``store.usage_aggregate``),
  unlike the id-keyed dict resources -- there is no id-addressed mutation in
  scope for them here.
* ``markNotificationRead``/``markAllNotificationsRead`` mutate
  ``store.notifications`` in place, mirroring the mock api.ts's
  find-and-replace-``unread``-flag semantics.
* ``requestDataExport``/``deleteAccount`` are NOT seeded store state -- the
  mock computes a fresh signed URL / grace-period timestamp on every call
  (``crypto.randomUUID()`` / ``new Date()``), so these routes compute their
  response at request time instead of reading a dict.
* ``AccountDeletionResult`` has no named schema in mvp-api.yaml (the contract
  declares it as an inline object on the 202 response), so datamodel-codegen
  never emitted a model for it. It is defined locally below rather than
  hand-edited into the generated ``models.py``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter
from pydantic import AnyUrl, AwareDatetime, BaseModel

from app.scaffold import store
from app.scaffold.errors import NotFoundError
from app.scaffold.models import (
    DataExportRequest,
    Notification,
    Settings,
    UsageAggregate,
    User,
)

user_router = APIRouter(tags=["user"])
notifications_router = APIRouter(tags=["notifications"])
settings_router = APIRouter(tags=["settings"])
account_router = APIRouter(tags=["account"])


class AccountDeletionResult(BaseModel):
    """Inline 202 response shape for ``deleteAccount`` (no named contract schema)."""

    gracePeriodEndsAt: AwareDatetime


# ---------------------------------------------------------------------------
# user
# ---------------------------------------------------------------------------


@user_router.get("/user", operation_id="getCurrentUser", response_model=User)
def get_current_user() -> User:
    """Current user / persona (getCurrentUser). REMY, seeded verbatim."""
    return store.current_user


# ---------------------------------------------------------------------------
# notifications (ORI-012)
# ---------------------------------------------------------------------------


@notifications_router.get(
    "/notifications", operation_id="getNotifications", response_model=list[Notification]
)
def get_notifications() -> list[Notification]:
    """Notifications (getNotifications)."""
    return list(store.notifications.values())


@notifications_router.post(
    "/notifications/{id}/read",
    operation_id="markNotificationRead",
    response_model=Notification,
)
def mark_notification_read(id: UUID) -> Notification:
    """Mark one notification read (markNotificationRead, ORI-012).

    404 envelope on unknown id. Mirrors mock api.ts: replaces the notification
    with ``unread=False``, all other fields preserved.
    """
    existing = store.notifications.get(id)
    if existing is None:
        raise NotFoundError(f"notifications/{id}")
    updated = existing.model_copy(update={"unread": False})
    store.notifications[id] = updated
    return updated


@notifications_router.post(
    "/notifications/mark-all-read",
    operation_id="markAllNotificationsRead",
    response_model=list[Notification],
)
def mark_all_notifications_read() -> list[Notification]:
    """Mark all notifications read (markAllNotificationsRead, ORI-012)."""
    for id, notification in store.notifications.items():
        store.notifications[id] = notification.model_copy(update={"unread": False})
    return list(store.notifications.values())


# ---------------------------------------------------------------------------
# settings
# ---------------------------------------------------------------------------


@settings_router.get("/settings", operation_id="getSettings", response_model=Settings)
def get_settings() -> Settings:
    """Full settings bundle (getSettings)."""
    return store.settings


@settings_router.get(
    "/usage-aggregate", operation_id="getUsageAggregate", response_model=UsageAggregate
)
def get_usage_aggregate() -> UsageAggregate:
    """Aggregated token-usage summary for the current billing period (getUsageAggregate)."""
    return store.usage_aggregate


# ---------------------------------------------------------------------------
# account (ACC-export, ACC-danger)
# ---------------------------------------------------------------------------


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
