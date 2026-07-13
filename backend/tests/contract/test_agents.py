"""Behavior tests for the agents resource. No database.

Covers: list/get/patch shapes, 404 envelopes, agent-log filters, trust-tier
ladder + patch, and the review-queue derivation -- including the 4 DEFERRED
mock-parity stubs (getReviewQueue, approveAgentAction, rejectAgentAction,
patchAgentTrustTier).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import store
from tests.contract.helpers import UNKNOWN_ID

# ---------------------------------------------------------------------------
# agents
# ---------------------------------------------------------------------------


def test_get_agents_lists_seeded_three(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/agents")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    ids = {a["id"] for a in body}
    assert str(store.AGENT_ID_STALE) in ids


def test_get_agent_returns_wire_shape(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/agents/{store.AGENT_ID_STALE}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Stale-detector"
    assert body["state"] == "running"
    assert body["costUsd"] == 0.08
    assert body["actions"] == 88
    assert body["trustTier"] == "suggest"
    # Presentation fields dropped from the contract (icon, stateLabel).
    assert "icon" not in body
    assert "stateLabel" not in body


def test_get_agent_unknown_id_returns_404_envelope(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/agents/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert set(body) <= {"kind", "path", "message"}


def test_patch_agent_merges_state_and_preserves_other_fields(
    store_client: TestClient,
) -> None:
    resp = store_client.patch(
        f"/api/v1/agents/{store.AGENT_ID_STALE}", json={"state": "paused"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "paused"
    # Untouched fields preserved (merge, not replace).
    assert body["name"] == "Stale-detector"
    assert body["costUsd"] == 0.08

    # live-only patch leaves state alone.
    resp2 = store_client.patch(f"/api/v1/agents/{store.AGENT_ID_STALE}", json={"live": False})
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["live"] is False
    assert body2["state"] == "paused"


def test_patch_agent_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.patch(f"/api/v1/agents/{UNKNOWN_ID}", json={"live": True})
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_get_agent_permissions_enriches_required_tier(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/agents/{store.AGENT_ID_GHOST}/permissions")
    assert resp.status_code == 200
    body = resp.json()
    by_permission = {p["permission"]: p for p in body}
    assert by_permission["Read application stage"]["granted"] is True
    assert by_permission["Read application stage"]["requiredTier"] == "observe"
    assert by_permission["Mark applications rejected"]["granted"] is True
    assert by_permission["Mark applications rejected"]["requiredTier"] == "autonomous"


def test_get_agent_permissions_unknown_id_returns_empty_list(
    store_client: TestClient,
) -> None:
    resp = store_client.get(f"/api/v1/agents/{UNKNOWN_ID}/permissions")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_agent_trust_tier_returns_current_and_ladder(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/agents/{store.AGENT_ID_COACH}/trust-tier")
    assert resp.status_code == 200
    body = resp.json()
    assert body["agentId"] == str(store.AGENT_ID_COACH)
    assert body["currentTier"] == "observe"
    assert [rung["tier"] for rung in body["ladder"]] == [
        "observe",
        "suggest",
        "act-with-approval",
        "autonomous",
    ]


def test_get_agent_trust_tier_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/agents/{UNKNOWN_ID}/trust-tier")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_get_agent_log_no_filter_returns_all_six(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/agents/log")
    assert resp.status_code == 200
    assert len(resp.json()) == 6


def test_get_agent_log_filters_by_agent_id(store_client: TestClient) -> None:
    resp = store_client.get(
        "/api/v1/agents/log", params={"agentId": str(store.AGENT_ID_GHOST)}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert all(entry["agentId"] == str(store.AGENT_ID_GHOST) for entry in body)


def test_get_agent_log_filters_by_kind(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/agents/log", params={"kind": "await"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["kind"] == "await"
    assert body[0]["message"] == "Drafted follow-up for Stripe — awaiting your send"


def test_get_agent_log_filters_combine(store_client: TestClient) -> None:
    resp = store_client.get(
        "/api/v1/agents/log",
        params={"agentId": str(store.AGENT_ID_STALE), "kind": "auto"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert all(
        e["agentId"] == str(store.AGENT_ID_STALE) and e["kind"] == "auto" for e in body
    )


# ---------------------------------------------------------------------------
# DEFERRED (DECISIONS-NEEDED #1): review queue + approve/reject
# ---------------------------------------------------------------------------


def test_get_review_queue_derives_await_entries_only(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/agents/review-queue")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["agentId"] == str(store.AGENT_ID_COACH)
    assert body[0]["message"] == "Drafted follow-up for Stripe — awaiting your send"
    # id is a stable UUID (deterministic uuid5), not the opaque `ref` string.
    uuid.UUID(body[0]["id"])


def test_approve_agent_action_no_op_success(store_client: TestClient) -> None:
    queue = store_client.get("/api/v1/agents/review-queue").json()
    item_id = queue[0]["id"]
    resp = store_client.post(f"/api/v1/agents/review-queue/{item_id}/approve")
    assert resp.status_code == 204


def test_approve_agent_action_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/agents/review-queue/{UNKNOWN_ID}/approve")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_reject_agent_action_no_op_success(store_client: TestClient) -> None:
    queue = store_client.get("/api/v1/agents/review-queue").json()
    item_id = queue[0]["id"]
    resp = store_client.post(f"/api/v1/agents/review-queue/{item_id}/reject")
    assert resp.status_code == 204


def test_reject_agent_action_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/agents/review-queue/{UNKNOWN_ID}/reject")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DEFERRED (DECISIONS-NEEDED #2): trust-tier patch
# ---------------------------------------------------------------------------


def test_patch_agent_trust_tier_always_returns_granted(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/agents/{store.AGENT_ID_STALE}/trust-tier",
        json={"targetTier": "autonomous"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "granted"
    assert body["currentTier"] == "autonomous"
    assert body["agentId"] == str(store.AGENT_ID_STALE)

    # Persisted: a subsequent trust-tier GET reflects the change.
    again = store_client.get(f"/api/v1/agents/{store.AGENT_ID_STALE}/trust-tier").json()
    assert again["currentTier"] == "autonomous"


def test_patch_agent_trust_tier_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/agents/{UNKNOWN_ID}/trust-tier",
        json={"targetTier": "observe"},
    )
    assert resp.status_code == 404
