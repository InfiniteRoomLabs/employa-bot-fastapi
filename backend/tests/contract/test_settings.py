"""Behavior tests for the settings + usage-aggregate resources. No database.

Covers: settings bundle shape sanity (numeric Usd fields, no removed
presentation fields) and usage aggregate numerics.
"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_get_settings_shape_sanity(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/settings")
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


def test_get_usage_aggregate_numeric_shape(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/usage-aggregate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["monthSpendUsd"] == 3.42
    assert body["monthlyCapUsd"] == 20.00
    assert body["tokensIn"] == 412000
    assert body["tokensOut"] == 88000
    assert isinstance(body["avgPerSessionUsd"], int | float)
