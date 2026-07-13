"""Behavior tests for the coach resource (COA-021 / COA-031 / COA-032 /
COA-036). No database.

Covers: thread list/get shapes, 404 envelope, and the coach thread bundle --
including the 2 DEFERRED mock-parity stubs (proposeCoachEdit,
saveCoachProposal).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import store
from tests.contract.helpers import UNKNOWN_ID

# ---------------------------------------------------------------------------
# coach
# ---------------------------------------------------------------------------


def test_get_coach_threads_lists_seeded_five(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/coach/threads")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 5
    ids = {t["id"] for t in body}
    assert str(store.THREAD_ID_STRIPE) in ids


def test_get_coach_thread_stripe_bundle_has_messages_and_context(
    store_client: TestClient,
) -> None:
    resp = store_client.get(f"/api/v1/coach/threads/{store.THREAD_ID_STRIPE}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["thread"]["title"] == "Stripe follow-up"
    assert body["thread"]["active"] is True
    assert len(body["messages"]) == 5
    assert body["messages"][0]["author"] == "bot"
    assert body["messages"][2]["draftAttachments"][0]["kind"] == "resume"
    assert len(body["context"]) == 4
    assert body["context"][0]["label"] == "Application"


def test_get_coach_thread_other_thread_has_empty_messages(
    store_client: TestClient,
) -> None:
    resp = store_client.get(f"/api/v1/coach/threads/{store.THREAD_ID_LINEAR}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["messages"] == []
    # Still gets its own per-thread context cards (not the canonical fallback).
    assert any(card["label"] == "Interview type" for card in body["context"])


def test_get_coach_thread_unknown_id_returns_404_envelope(
    store_client: TestClient,
) -> None:
    resp = store_client.get(f"/api/v1/coach/threads/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert set(body) <= {"kind", "path", "message"}


# ---------------------------------------------------------------------------
# DEFERRED (DECISIONS-NEEDED #1): coach proposals
# ---------------------------------------------------------------------------


def test_propose_coach_edit_returns_canned_pending_proposal(
    store_client: TestClient,
) -> None:
    resp = store_client.post(
        "/api/v1/coach/proposals",
        json={"scope": "résumé", "label": "this resume"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["subject"]["scope"] == "résumé"
    assert body["diff"][0]["field"] == "Experience bullet"


def test_propose_coach_edit_falls_back_to_resume_fixture_for_unmapped_scope(
    store_client: TestClient,
) -> None:
    resp = store_client.post(
        "/api/v1/coach/proposals",
        json={"scope": "general", "label": "general strategy"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["summary"].startswith("Tightened the ingest-pipeline bullet")


def test_save_coach_proposal_returns_attributed_timeline_event(
    store_client: TestClient,
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
    resp = store_client.post(
        f"/api/v1/coach/proposals/{proposal_id}/accept", json=proposal
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["who"] == "Coach"
    assert body["actor"] == "coach-on-behalf"
    assert body["message"] == "Tightened the ingest-pipeline bullet."
