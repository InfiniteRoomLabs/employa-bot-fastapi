"""Behavior tests for the MOCK-SERVED shortlist surface. No database.

Since sprint-03 only the ``searchId``-scoped getShortlist view is mock-served
here (PIN-3, docs/sprints/sprint-03-spec.md); the DB-backed default view +
addToShortlist + dismissFromShortlist coverage (fidelity, tenancy, dedup,
provenance) lives in ``tests/api/routes/test_shortlist.py``.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import SEARCH_ID_BACKEND


def test_get_shortlist_filters_by_search_id(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/shortlist", params={"searchId": SEARCH_ID_BACKEND})
    assert resp.status_code == 200
    companies = {entry["company"] for entry in resp.json()}
    assert companies == {"Wise", "Adyen", "Marqeta", "Modern Treasury"}


def test_get_shortlist_scoped_view_is_wire_valid(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/shortlist", params={"searchId": SEARCH_ID_BACKEND})
    assert resp.status_code == 200
    for entry in resp.json():
        assert entry["source"] == "you"
        assert set(entry) >= {"id", "company", "role", "location", "match", "saved"}
