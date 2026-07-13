"""Behavior tests for the jobs resource. No database.

Covers: list/get happy paths, searchId filtering (jobs inbox), and the 404
envelope on unknown UUIDs.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import JOB_ID_STRIPE, SEARCH_ID_BACKEND, UNKNOWN_ID

JOB_ID_FLYIO = "e0b2f7d4-3a5c-4fb6-ad49-4b8caf6eb073"


def test_get_jobs_lists_seeded_seven(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/jobs")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 7
    ids = {j["id"] for j in body}
    assert JOB_ID_STRIPE in ids


def test_get_job_returns_wire_shape(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/jobs/{JOB_ID_STRIPE}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["company"] == "Stripe"
    assert body["compensation"] == {"min": 255000, "max": 305000, "extra": []}
    assert body["match"]["score"] == 92


def test_get_job_partial_capture_omits_match(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/jobs/{JOB_ID_FLYIO}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["match"] is None
    assert "summary" not in body or body["summary"] is None


def test_get_job_unknown_id_returns_404_envelope(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/jobs/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/jobs/{UNKNOWN_ID}"
    assert set(body) <= {"kind", "path", "message"}


def test_get_jobs_inbox_defaults_to_canonical(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/jobs/inbox")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 7
    companies = {item["company"] for item in body}
    assert "Stripe" in companies


def test_get_jobs_inbox_filters_by_search_id(store_client: TestClient) -> None:
    resp = store_client.get(
        "/api/v1/jobs/inbox", params={"searchId": SEARCH_ID_BACKEND}
    )
    assert resp.status_code == 200
    body = resp.json()
    companies = {item["company"] for item in body}
    assert companies == {"Wise", "Adyen", "Column", "Increase", "Unit", "Marqeta"}


def test_get_jobs_inbox_unknown_search_id_falls_back_to_canonical(
    store_client: TestClient,
) -> None:
    resp = store_client.get("/api/v1/jobs/inbox", params={"searchId": UNKNOWN_ID})
    assert resp.status_code == 200
    assert len(resp.json()) == 7
