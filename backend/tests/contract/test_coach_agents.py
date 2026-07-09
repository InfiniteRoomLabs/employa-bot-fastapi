"""Behavior tests for the agents + coach resources. No database.

Covers: list/get/patch shapes, 404 envelopes, agent-log filters, trust-tier
ladder + patch, the review-queue derivation, and the coach thread bundle --
including the 6 DEFERRED mock-parity stubs (proposeCoachEdit,
saveCoachProposal, getReviewQueue, approveAgentAction, rejectAgentAction,
patchAgentTrustTier).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import store

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"


# ---------------------------------------------------------------------------
# agents
# ---------------------------------------------------------------------------


def test_get_agents_lists_seeded_three(client: TestClient) -> None:
    resp = client.get("/api/v1/agents")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    ids = {a["id"] for a in body}
    assert str(store.AGENT_ID_STALE) in ids


def test_get_agent_returns_wire_shape(client: TestClient) -> None:
    resp = client.get(f"/api/v1/agents/{store.AGENT_ID_STALE}")
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


def test_get_agent_unknown_id_returns_404_envelope(client: TestClient) -> None:
    resp = client.get(f"/api/v1/agents/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert set(body) <= {"kind", "path", "message"}


def test_patch_agent_merges_state_and_preserves_other_fields(
    client: TestClient,
) -> None:
    resp = client.patch(
        f"/api/v1/agents/{store.AGENT_ID_STALE}", json={"state": "paused"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "paused"
    # Untouched fields preserved (merge, not replace).
    assert body["name"] == "Stale-detector"
    assert body["costUsd"] == 0.08

    # live-only patch leaves state alone.
    resp2 = client.patch(f"/api/v1/agents/{store.AGENT_ID_STALE}", json={"live": False})
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["live"] is False
    assert body2["state"] == "paused"


def test_patch_agent_unknown_id_404(client: TestClient) -> None:
    resp = client.patch(f"/api/v1/agents/{UNKNOWN_ID}", json={"live": True})
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_get_agent_permissions_enriches_required_tier(client: TestClient) -> None:
    resp = client.get(f"/api/v1/agents/{store.AGENT_ID_GHOST}/permissions")
    assert resp.status_code == 200
    body = resp.json()
    by_permission = {p["permission"]: p for p in body}
    assert by_permission["Read application stage"]["granted"] is True
    assert by_permission["Read application stage"]["requiredTier"] == "observe"
    assert by_permission["Mark applications rejected"]["granted"] is True
    assert by_permission["Mark applications rejected"]["requiredTier"] == "autonomous"


def test_get_agent_permissions_unknown_id_returns_empty_list(
    client: TestClient,
) -> None:
    resp = client.get(f"/api/v1/agents/{UNKNOWN_ID}/permissions")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_agent_trust_tier_returns_current_and_ladder(client: TestClient) -> None:
    resp = client.get(f"/api/v1/agents/{store.AGENT_ID_COACH}/trust-tier")
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


def test_get_agent_trust_tier_unknown_id_404(client: TestClient) -> None:
    resp = client.get(f"/api/v1/agents/{UNKNOWN_ID}/trust-tier")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_get_agent_log_no_filter_returns_all_six(client: TestClient) -> None:
    resp = client.get("/api/v1/agents/log")
    assert resp.status_code == 200
    assert len(resp.json()) == 6


def test_get_agent_log_filters_by_agent_id(client: TestClient) -> None:
    resp = client.get(
        "/api/v1/agents/log", params={"agentId": str(store.AGENT_ID_GHOST)}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert all(entry["agentId"] == str(store.AGENT_ID_GHOST) for entry in body)


def test_get_agent_log_filters_by_kind(client: TestClient) -> None:
    resp = client.get("/api/v1/agents/log", params={"kind": "await"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["kind"] == "await"
    assert body[0]["message"] == "Drafted follow-up for Stripe — awaiting your send"


def test_get_agent_log_filters_combine(client: TestClient) -> None:
    resp = client.get(
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


def test_get_review_queue_derives_await_entries_only(client: TestClient) -> None:
    resp = client.get("/api/v1/agents/review-queue")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["agentId"] == str(store.AGENT_ID_COACH)
    assert body[0]["message"] == "Drafted follow-up for Stripe — awaiting your send"
    # id is a stable UUID (deterministic uuid5), not the opaque `ref` string.
    uuid.UUID(body[0]["id"])


def test_approve_agent_action_no_op_success(client: TestClient) -> None:
    queue = client.get("/api/v1/agents/review-queue").json()
    item_id = queue[0]["id"]
    resp = client.post(f"/api/v1/agents/review-queue/{item_id}/approve")
    assert resp.status_code == 204


def test_approve_agent_action_unknown_id_404(client: TestClient) -> None:
    resp = client.post(f"/api/v1/agents/review-queue/{UNKNOWN_ID}/approve")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_reject_agent_action_no_op_success(client: TestClient) -> None:
    queue = client.get("/api/v1/agents/review-queue").json()
    item_id = queue[0]["id"]
    resp = client.post(f"/api/v1/agents/review-queue/{item_id}/reject")
    assert resp.status_code == 204


def test_reject_agent_action_unknown_id_404(client: TestClient) -> None:
    resp = client.post(f"/api/v1/agents/review-queue/{UNKNOWN_ID}/reject")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DEFERRED (DECISIONS-NEEDED #2): trust-tier patch
# ---------------------------------------------------------------------------


def test_patch_agent_trust_tier_always_returns_granted(client: TestClient) -> None:
    resp = client.patch(
        f"/api/v1/agents/{store.AGENT_ID_STALE}/trust-tier",
        json={"targetTier": "autonomous"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "granted"
    assert body["currentTier"] == "autonomous"
    assert body["agentId"] == str(store.AGENT_ID_STALE)

    # Persisted: a subsequent trust-tier GET reflects the change.
    again = client.get(f"/api/v1/agents/{store.AGENT_ID_STALE}/trust-tier").json()
    assert again["currentTier"] == "autonomous"


def test_patch_agent_trust_tier_unknown_id_404(client: TestClient) -> None:
    resp = client.patch(
        f"/api/v1/agents/{UNKNOWN_ID}/trust-tier",
        json={"targetTier": "observe"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# coach
# ---------------------------------------------------------------------------


def test_get_coach_threads_lists_seeded_five(client: TestClient) -> None:
    resp = client.get("/api/v1/coach/threads")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 5
    ids = {t["id"] for t in body}
    assert str(store.THREAD_ID_STRIPE) in ids


def test_get_coach_thread_stripe_bundle_has_messages_and_context(
    client: TestClient,
) -> None:
    resp = client.get(f"/api/v1/coach/threads/{store.THREAD_ID_STRIPE}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["thread"]["title"] == "Stripe follow-up"
    assert body["thread"]["active"] is True
    assert len(body["messages"]) == 5
    assert body["messages"][0]["author"] == "bot"
    assert body["messages"][2]["draftAttachments"][0]["kind"] == "resume"
    assert len(body["context"]) == 4
    assert body["context"][0]["label"] == "Application"


def test_get_coach_thread_other_thread_has_empty_messages(client: TestClient) -> None:
    resp = client.get(f"/api/v1/coach/threads/{store.THREAD_ID_LINEAR}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["messages"] == []
    # Still gets its own per-thread context cards (not the canonical fallback).
    assert any(card["label"] == "Interview type" for card in body["context"])


def test_get_coach_thread_unknown_id_returns_404_envelope(client: TestClient) -> None:
    resp = client.get(f"/api/v1/coach/threads/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert set(body) <= {"kind", "path", "message"}


# ---------------------------------------------------------------------------
# DEFERRED (DECISIONS-NEEDED #1): coach proposals
# ---------------------------------------------------------------------------


def test_propose_coach_edit_returns_canned_pending_proposal(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/coach/proposals",
        json={"scope": "résumé", "label": "this resume"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["subject"]["scope"] == "résumé"
    assert body["diff"][0]["field"] == "Experience bullet"


def test_propose_coach_edit_falls_back_to_resume_fixture_for_unmapped_scope(
    client: TestClient,
) -> None:
    resp = client.post(
        "/api/v1/coach/proposals",
        json={"scope": "general", "label": "general strategy"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["summary"].startswith("Tightened the ingest-pipeline bullet")


def test_save_coach_proposal_returns_attributed_timeline_event(
    client: TestClient,
) -> None:
    # Path id is UUID-shaped per the contract's shared `id` parameter (the
    # proposal's own `id` field is a plain string set by proposeCoachEdit to
    # `str(uuid4())`, but this stub doesn't look the path id up anywhere).
    proposal_id = str(uuid.uuid4())
    proposal = {
        "id": proposal_id,
        "subject": {"scope": "résumé", "label": "this resume"},
        "summary": "Tightened the ingest-pipeline bullet.",
        "diff": [{"field": "Experience bullet", "before": "before", "after": "after"}],
        "status": "pending",
    }
    resp = client.post(f"/api/v1/coach/proposals/{proposal_id}/accept", json=proposal)
    assert resp.status_code == 200
    body = resp.json()
    assert body["who"] == "Coach"
    assert body["actor"] == "coach-on-behalf"
    assert body["message"] == "Tightened the ingest-pipeline bullet."
