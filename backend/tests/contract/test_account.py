"""Behavior tests for the account resource: current user + account actions.
No database.

Covers: getCurrentUser persona shape and the two account 202 ops
(data-export, delete-account).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# getCurrentUser
# ---------------------------------------------------------------------------


def test_get_current_user_returns_remy_persona(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/user")
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
# account (ACC-export, ACC-danger)
# ---------------------------------------------------------------------------


def test_request_data_export_returns_202_with_signed_url(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/account/data-export")
    assert resp.status_code == 202
    body = resp.json()
    assert body["url"].startswith("https://export.employa.app/download/")
    assert "requestedAt" in body


def test_delete_account_returns_202_with_grace_period(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/account/delete")
    assert resp.status_code == 202
    body = resp.json()
    assert set(body) == {"gracePeriodEndsAt"}
