"""Notifications resource (mock API).

Follows the mock route pattern in ``routes/searches.py`` (read its header
comment first). ``markNotificationRead``/``markAllNotificationsRead`` mutate
``store.notifications`` in place, mirroring the mock api.ts's
find-and-replace-``unread``-flag semantics (ORI-012).
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app import store
from app.api.deps import get_current_user
from app.api.errors import NotFoundError
from app.schemas import Notification

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["notifications"])


@router.get(
    "/notifications", operation_id="getNotifications", response_model=list[Notification]
)
def get_notifications() -> list[Notification]:
    """Notifications (getNotifications)."""
    return list(store.notifications.values())


@router.post(
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


@router.post(
    "/notifications/mark-all-read",
    operation_id="markAllNotificationsRead",
    response_model=list[Notification],
)
def mark_all_notifications_read() -> list[Notification]:
    """Mark all notifications read (markAllNotificationsRead, ORI-012)."""
    for id, notification in store.notifications.items():
        store.notifications[id] = notification.model_copy(update={"unread": False})
    return list(store.notifications.values())
