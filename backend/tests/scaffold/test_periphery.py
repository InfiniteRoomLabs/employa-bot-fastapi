"""Behavior tests for the periphery resources: user, notifications, settings,
usage-aggregate, account. No database.

Covers: getCurrentUser persona shape, notifications list/mark-read/mark-all
persistence-until-reset, 404 envelope on unknown notification id, settings
bundle shape sanity (numeric Usd fields, no removed presentation fields),
usage aggregate numerics, and the two account 202 ops.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"
NOTIFICATION_ID_REPLY = "2f3044aa-2e5d-42ba-bff0-3f1e1ad36af0"
NOTIFICATION_ID_MATCH_SCORED = "dacf6597-779a-489b-a4be-66d01da1842b"


# ---------------------------------------------------------------------------
# getCurrentUser
# ---------------------------------------------------------------------------


def test_get_current_user_returns_remy_persona(client: TestClient) -> None:
    resp = client.get("/api/v1/user")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Wes Gilleland"
    assert body["email"] == "wes.gilleland@gmail.com"
    assert body["initials"] == "WG"
    assert body["city"] == "Lexington, KY"
    assert body["years"] == 12
    assert body["comp_floor"] == 210000
    assert "Staff Engineer" in body["target_titles"]


# ---------------------------------------------------------------------------
# notifications (ORI-012)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# settings / usage-aggregate
# ---------------------------------------------------------------------------


def test_get_settings_shape_sanity(client: TestClient) -> None:
    resp = client.get("/api/v1/settings")
    assert resp.status_code == 200
    body = resp.json()

    # Numeric Usd fields, not "$..." strings.
    assert body["profile"]["compFloorUsd"] == 210000
    assert body["monthSpendUsd"] == 3.42
    assert body["monthlyCapUsd"] == 20.00
    assert body["plan"]["priceUsd"] == 29
    assert body["invoices"][0]["amountUsd"] == 29.00
    assert body["providers"][0]["balanceUsd"] == 18.22

    # Keyed toggle state, not presentation copy.
    assert body["privacy"][0] == {"key": "coach-feedback-training", "on": True}

    # No removed presentation fields.
    assert "danger" not in body
    assert "icon" not in body["integrations"][0]
    assert "consequence" not in body["notifPrefs"][0]
    assert "label" not in body["routing"][0]
    assert body["routing"][0]["task"] == "Coach chat"

    # extensionTokens carry a real UUID id (contract format: uuid).
    assert len(body["extensionTokens"][0]["id"]) == 36


def test_get_usage_aggregate_numeric_shape(client: TestClient) -> None:
    resp = client.get("/api/v1/usage-aggregate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["monthSpendUsd"] == 3.42
    assert body["monthlyCapUsd"] == 20.00
    assert body["tokensIn"] == 412000
    assert body["tokensOut"] == 88000
    assert isinstance(body["avgPerSessionUsd"], int | float)


# ---------------------------------------------------------------------------
# account (ACC-export, ACC-danger)
# ---------------------------------------------------------------------------


def test_request_data_export_returns_202_with_signed_url(client: TestClient) -> None:
    resp = client.post("/api/v1/account/data-export")
    assert resp.status_code == 202
    body = resp.json()
    assert body["url"].startswith("https://export.employa.app/download/")
    assert "requestedAt" in body


def test_delete_account_returns_202_with_grace_period(client: TestClient) -> None:
    resp = client.post("/api/v1/account/delete")
    assert resp.status_code == 202
    body = resp.json()
    assert set(body) == {"gracePeriodEndsAt"}
