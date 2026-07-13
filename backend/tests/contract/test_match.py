"""Behavior tests for the match resource. No database.

Covers: match report echo, cost preview arithmetic, deep-score run +
synthetic AiRunEnvelope, and the cap_reached 402 envelope.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import store
from tests.contract.helpers import JOB_ID_STRIPE, UNKNOWN_ID

RESUME_ID = "11111111-1111-4111-8111-111111111111"


def test_get_match_report_echoes_query_ids_onto_canonical_fixture(
    client: TestClient,
) -> None:
    resp = client.get(
        "/api/v1/match-report",
        params={"resumeId": RESUME_ID, "jobId": JOB_ID_STRIPE},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["resumeId"] == RESUME_ID
    assert body["jobId"] == JOB_ID_STRIPE
    assert body["score"] == 92
    assert len(body["rubric"]) == 4
    assert len(body["gaps"]) == 3
    assert len(body["strengths"]) == 4


def test_preview_deep_match_score_cost_arithmetic(client: TestClient) -> None:
    resp = client.post(
        f"/api/v1/jobs/{JOB_ID_STRIPE}/preview-deep-score",
        json={"resumeIds": [RESUME_ID]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == [
        {"resumeId": RESUME_ID, "model": "gemini-1.5-pro", "estCostUsd": 0.14}
    ]
    assert body["totalUsd"] == 0.14
    assert body["capRemainingUsd"] == 16.58
    assert body["overCap"] is False


def test_preview_deep_match_score_unknown_job_404(client: TestClient) -> None:
    resp = client.post(
        f"/api/v1/jobs/{UNKNOWN_ID}/preview-deep-score",
        json={"resumeIds": [RESUME_ID]},
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_run_deep_match_score_returns_synthetic_ai_run(client: TestClient) -> None:
    resp = client.post(
        f"/api/v1/jobs/{JOB_ID_STRIPE}/deep-score",
        json={"resumeId": RESUME_ID},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["jobId"] == JOB_ID_STRIPE
    assert body["resumeId"] == RESUME_ID
    assert body["kind"] == "deep"
    assert body["score"] == 95  # base 92 + 3
    assert body["costUsd"] == 0.14
    ai_run = body["aiRun"]
    assert ai_run["provider"] == "fake"
    assert ai_run["status"] == "succeeded"
    assert ai_run["synthetic"] is True
    assert ai_run["estimatedCostUsd"] == 0.14
    assert ai_run["actualCostUsd"] == 0.14
    assert ai_run["durationMs"] >= 0

    # Spend is recorded against the monthly budget.
    assert store.month_spend_usd == 3.56


def test_run_deep_match_score_cap_reached_returns_402_envelope(
    client: TestClient,
) -> None:
    store.month_spend_usd = 19.99  # headroom (0.01) < unit cost (0.14)
    resp = client.post(
        f"/api/v1/jobs/{JOB_ID_STRIPE}/deep-score",
        json={"resumeId": RESUME_ID},
    )
    assert resp.status_code == 402
    body = resp.json()
    assert body["kind"] == "cap_reached"
    assert body["path"] == f"/api/v1/jobs/{JOB_ID_STRIPE}/deep-score"
    # No spend recorded on the rejected run.
    assert store.month_spend_usd == 19.99


def test_run_deep_match_score_unknown_job_404(client: TestClient) -> None:
    resp = client.post(
        f"/api/v1/jobs/{UNKNOWN_ID}/deep-score",
        json={"resumeId": RESUME_ID},
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"
