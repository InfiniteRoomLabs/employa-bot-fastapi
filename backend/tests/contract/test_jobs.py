"""Behavior tests for the MOCK-SERVED jobs surface. No database.

Since sprint-02 only ``getJobsInbox`` is mock-served here (PIN-2,
docs/sprints/sprint-02-spec.md); the DB-backed ``getJobs``/``getJob``
coverage (fidelity, tenancy, provenance) lives in
``tests/api/routes/test_jobs.py``.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import SEARCH_ID_BACKEND, UNKNOWN_ID


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
