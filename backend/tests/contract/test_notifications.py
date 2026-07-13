"""Behavior tests for the notifications resource (ORI-012). No database.

Covers: list seeded six, mark-read persistence-until-reset, 404 envelope on
unknown notification id, and mark-all-read.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"
NOTIFICATION_ID_REPLY = "2f3044aa-2e5d-42ba-bff0-3f1e1ad36af0"
NOTIFICATION_ID_MATCH_SCORED = "dacf6597-779a-489b-a4be-66d01da1842b"


def test_get_notifications_lists_seeded_six(client: TestClient) -> None:
    resp = client.get("/api/v1/notifications")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 6
    ids = {n["id"] for n in body}
    assert NOTIFICATION_ID_REPLY in ids
    # Frozen wire shape: no presentation-only "icon" field.
    assert "icon" not in body[0]


def test_mark_notification_read_flips_unread_and_persists(client: TestClient) -> None:
    resp = client.post(f"/api/v1/notifications/{NOTIFICATION_ID_REPLY}/read")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == NOTIFICATION_ID_REPLY
    assert body["unread"] is False
    # Other fields preserved.
    assert body["title"] == "Recruiter reply - Vercel"

    # Persists until reset -- round-trip via a fresh GET.
    again = client.get("/api/v1/notifications").json()
    reply = next(n for n in again if n["id"] == NOTIFICATION_ID_REPLY)
    assert reply["unread"] is False


def test_mark_notification_read_unknown_id_returns_404_envelope(
    client: TestClient,
) -> None:
    resp = client.post(f"/api/v1/notifications/{UNKNOWN_ID}/read")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/notifications/{UNKNOWN_ID}/read"
    assert set(body) <= {"kind", "path", "message"}


def test_mark_all_notifications_read_returns_full_collection(
    client: TestClient,
) -> None:
    resp = client.post("/api/v1/notifications/mark-all-read")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 6
    assert all(n["unread"] is False for n in body)

    # Persists: a previously-read-already notification (unread was already
    # False/absent) and a previously-unread one are both read now.
    again = client.get("/api/v1/notifications").json()
    assert all(n["unread"] is False for n in again)
    scored = next(n for n in again if n["id"] == NOTIFICATION_ID_MATCH_SCORED)
    assert scored["unread"] is False
