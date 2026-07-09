"""Behavior tests for jobs / shortlist / match (9 ops). No database.

Covers: list/get happy paths, searchId filtering (jobs inbox + shortlist),
404 envelope on unknown UUIDs, add/dismiss shortlist round-trip, cost
preview arithmetic, deep-score run + synthetic AiRunEnvelope, and the
cap_reached 402 envelope.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import store

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"

JOB_ID_STRIPE = "b7e9c4a1-0d2f-4c83-9a16-1e5f7c3b8d40"
JOB_ID_FLYIO = "e0b2f7d4-3a5c-4fb6-ad49-4b8caf6eb073"

SEARCH_ID_PLATFORM = "7c0b1f3a-2d4e-4a8c-9b21-1f8c5e3a0d12"
SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"

RESUME_ID = "11111111-1111-4111-8111-111111111111"


# ---------------------------------------------------------------------------
# jobs
# ---------------------------------------------------------------------------


def test_get_jobs_lists_seeded_seven(client: TestClient) -> None:
    resp = client.get("/api/v1/jobs")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 7
    ids = {j["id"] for j in body}
    assert JOB_ID_STRIPE in ids


def test_get_job_returns_wire_shape(client: TestClient) -> None:
    resp = client.get(f"/api/v1/jobs/{JOB_ID_STRIPE}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["company"] == "Stripe"
    assert body["compensation"] == {"min": 255000, "max": 305000, "extra": []}
    assert body["match"]["score"] == 92


def test_get_job_partial_capture_omits_match(client: TestClient) -> None:
    resp = client.get(f"/api/v1/jobs/{JOB_ID_FLYIO}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["match"] is None
    assert "summary" not in body or body["summary"] is None


def test_get_job_unknown_id_returns_404_envelope(client: TestClient) -> None:
    resp = client.get(f"/api/v1/jobs/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/jobs/{UNKNOWN_ID}"
    assert set(body) <= {"kind", "path", "message"}


def test_get_jobs_inbox_defaults_to_canonical(client: TestClient) -> None:
    resp = client.get("/api/v1/jobs/inbox")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 7
    companies = {item["company"] for item in body}
    assert "Stripe" in companies


def test_get_jobs_inbox_filters_by_search_id(client: TestClient) -> None:
    resp = client.get("/api/v1/jobs/inbox", params={"searchId": SEARCH_ID_BACKEND})
    assert resp.status_code == 200
    body = resp.json()
    companies = {item["company"] for item in body}
    assert companies == {"Wise", "Adyen", "Column", "Increase", "Unit", "Marqeta"}


def test_get_jobs_inbox_unknown_search_id_falls_back_to_canonical(
    client: TestClient,
) -> None:
    resp = client.get("/api/v1/jobs/inbox", params={"searchId": UNKNOWN_ID})
    assert resp.status_code == 200
    assert len(resp.json()) == 7


# ---------------------------------------------------------------------------
# shortlist
# ---------------------------------------------------------------------------


def test_get_shortlist_defaults_to_canonical_six(client: TestClient) -> None:
    resp = client.get("/api/v1/shortlist")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 6
    companies = {entry["company"] for entry in body}
    assert "Stripe" in companies


def test_get_shortlist_filters_by_search_id(client: TestClient) -> None:
    resp = client.get("/api/v1/shortlist", params={"searchId": SEARCH_ID_BACKEND})
    assert resp.status_code == 200
    body = resp.json()
    companies = {entry["company"] for entry in body}
    assert companies == {"Wise", "Adyen", "Marqeta", "Modern Treasury"}


def test_add_to_shortlist_then_dismiss_round_trip(client: TestClient) -> None:
    payload = {
        "company": "Acme",
        "role": "Staff Engineer",
        "location": "Remote - US",
        "salary": {"min": 200000, "max": 250000, "extra": []},
        "match": 70,
    }
    resp = client.post("/api/v1/shortlist", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["company"] == "Acme"
    assert body["source"] == "you"
    assert "id" in body

    # Persisted: shows up in the default (no-searchId) listing.
    listing = client.get("/api/v1/shortlist").json()
    assert len(listing) == 7
    assert any(e["id"] == body["id"] for e in listing)

    # Dismiss it by id.
    entry_id = body["id"]
    dismiss = client.delete(f"/api/v1/shortlist/{entry_id}")
    assert dismiss.status_code == 204

    listing_after = client.get("/api/v1/shortlist").json()
    assert len(listing_after) == 6
    assert not any(e["id"] == entry_id for e in listing_after)


def test_add_to_shortlist_does_not_affect_platform_search_view(
    client: TestClient,
) -> None:
    """Ported quirk from the mock: the platform per-search view is a
    separate pristine copy from the mutable default view, so add/dismiss
    only ever show up when querying with no searchId."""
    payload = {
        "company": "Acme",
        "role": "Staff Engineer",
        "location": "Remote - US",
        "salary": None,
        "match": 70,
    }
    client.post("/api/v1/shortlist", json=payload)

    scoped = client.get(
        "/api/v1/shortlist", params={"searchId": SEARCH_ID_PLATFORM}
    ).json()
    assert len(scoped) == 6
    assert not any(e["company"] == "Acme" for e in scoped)


def test_dismiss_from_shortlist_unknown_id_returns_404_envelope(
    client: TestClient,
) -> None:
    resp = client.delete(f"/api/v1/shortlist/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/shortlist/{UNKNOWN_ID}"


# ---------------------------------------------------------------------------
# match
# ---------------------------------------------------------------------------


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
