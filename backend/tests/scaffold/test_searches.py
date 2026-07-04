"""Behavior tests for the SEARCHES exemplar. No database.

Covers: list, get, 404-envelope shape, create defaults, and criteria-update
merge round-trip -- the mock api.ts parity behaviors.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

PLATFORM_ID = "7c0b1f3a-2d4e-4a8c-9b21-1f8c5e3a0d12"
UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"


def test_get_searches_lists_seeded_three(client: TestClient) -> None:
    resp = client.get("/api/v1/searches")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    ids = {s["id"] for s in body}
    assert PLATFORM_ID in ids


def test_get_search_returns_wire_shape(client: TestClient) -> None:
    resp = client.get(f"/api/v1/searches/{PLATFORM_ID}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == PLATFORM_ID
    assert body["name"] == "Staff / Principal - Platform - remote"
    # Frozen wire shape: numbers not strings, machine-token enum.
    assert body["spendMoUsd"] == 0.56
    assert body["criteria"]["remotePolicy"] == "required"
    assert body["criteria"]["baseFloorUsd"] == 210000
    assert body["criteria"]["baseCeilingUsd"] == 285000
    assert body["criteria"]["yearsExperienceMin"] == 8
    assert body["criteria"]["yearsExperienceMax"] == 14
    # Presentation field dropped from the contract.
    assert "eyebrow" not in body


def test_get_search_unknown_id_returns_404_envelope(client: TestClient) -> None:
    resp = client.get(f"/api/v1/searches/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    # Exact Error envelope: {kind, path, message}.
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/searches/{UNKNOWN_ID}"
    assert set(body) <= {"kind", "path", "message"}
    assert "detail" not in body  # not the framework default shape


def test_get_search_malformed_uuid_returns_validation_envelope(
    client: TestClient,
) -> None:
    resp = client.get("/api/v1/searches/not-a-uuid")
    assert resp.status_code == 422
    body = resp.json()
    assert body["kind"] == "validation_error"
    assert body["path"] == "/api/v1/searches/not-a-uuid"


def test_create_search_defaults_and_persists(client: TestClient) -> None:
    payload = {
        "name": "New search",
        "criteria": {
            "titlesInclude": ["Staff Engineer"],
            "titlesExclude": [],
            "locations": ["Remote - US"],
            "remotePolicy": "remote-ok",
            "maxCommuteMin": 0,
            "baseFloorUsd": 200000,
            "baseCeilingUsd": 260000,
        },
    }
    resp = client.post("/api/v1/searches", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "New search"
    assert body["state"] == "active"
    assert body["jobsInInbox"] == 0
    assert body["activeApplications"] == 0
    assert body["shortlisted"] == 0
    assert body["offers"] == 0
    assert body["spendMoUsd"] == 0
    assert body["criteria"]["titlesInclude"] == ["Staff Engineer"]

    # Persisted: it now shows up in the list and is fetchable by its new id.
    new_id = body["id"]
    listing = client.get("/api/v1/searches").json()
    assert len(listing) == 4
    assert client.get(f"/api/v1/searches/{new_id}").status_code == 200


def test_update_search_criteria_merges_in_place(client: TestClient) -> None:
    new_criteria = {
        "titlesInclude": ["Principal Engineer"],
        "titlesExclude": [],
        "locations": ["Remote - global"],
        "remotePolicy": "hybrid-ok",
        "maxCommuteMin": 30,
        "baseFloorUsd": 250000,
        "baseCeilingUsd": 350000,
    }
    resp = client.patch(
        f"/api/v1/searches/{PLATFORM_ID}", json={"criteria": new_criteria}
    )
    assert resp.status_code == 200
    body = resp.json()
    # Criteria replaced by the sent fields...
    assert body["criteria"]["remotePolicy"] == "hybrid-ok"
    assert body["criteria"]["baseFloorUsd"] == 250000
    assert body["criteria"]["titlesInclude"] == ["Principal Engineer"]
    # ...other Search fields preserved (merge in place, not replace).
    assert body["name"] == "Staff / Principal - Platform - remote"
    assert body["jobsInInbox"] == 42

    # Round-trip: a subsequent GET reflects the update.
    again = client.get(f"/api/v1/searches/{PLATFORM_ID}").json()
    assert again["criteria"]["remotePolicy"] == "hybrid-ok"


def test_update_search_criteria_unknown_id_404(client: TestClient) -> None:
    resp = client.patch(
        f"/api/v1/searches/{UNKNOWN_ID}",
        json={
            "criteria": {
                "titlesInclude": [],
                "titlesExclude": [],
                "locations": [],
                "remotePolicy": "required",
                "maxCommuteMin": 0,
                "baseFloorUsd": 0,
                "baseCeilingUsd": 0,
            }
        },
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"
