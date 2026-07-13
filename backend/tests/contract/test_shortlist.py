"""Behavior tests for the shortlist resource. No database.

Covers: searchId filtering, add/dismiss round-trip, and the 404 envelope on
unknown UUIDs.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import SEARCH_ID_BACKEND, UNKNOWN_ID

SEARCH_ID_PLATFORM = "7c0b1f3a-2d4e-4a8c-9b21-1f8c5e3a0d12"


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
