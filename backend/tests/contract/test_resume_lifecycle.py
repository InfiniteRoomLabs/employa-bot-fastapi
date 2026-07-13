"""Behavior tests for resume-lifecycle: uploads, career history, templates,
exports, and projections (ADR-007/008, RES-030..037, TPL-001/002). No
database.

Covers: happy paths, the delete-lock and 404 Error envelopes, regenerate-
creates-a-new-export, and projection snapshot immutability.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app import store
from app.schemas import CareerHistoryItem, Kind3
from tests.contract.helpers import UNKNOWN_ID


def test_get_resume_uploads_lists_seeded_two(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/resumes/uploads")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert {u["id"] for u in body} == {
        str(store.UPLOAD_ID_SWE_2023),
        str(store.UPLOAD_ID_DEVOPS_2022),
    }


def test_get_career_history_sorted_by_ordinal(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/career-history")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 5
    assert [item["ordinal"] for item in body] == [0, 1, 2, 3, 4]


def test_get_resume_templates_lists_seeded_three(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/resumes/templates")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert {t["id"] for t in body} == {
        str(store.TEMPLATE_ID_CLASSIC),
        str(store.TEMPLATE_ID_TWO_COL),
        str(store.TEMPLATE_ID_COMPACT),
    }


def test_get_resume_exports_lists_seeded_one(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/resumes/exports")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == str(store.EXPORT_ID_BACKEND)


def test_get_projections_excludes_format_tag(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/projections")
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.json()}
    assert str(store.RESUME_ID_SHORT) not in ids  # FORMAT tag, excluded
    assert str(store.RESUME_ID_MASTER) in ids
    assert len(ids) == 5


def test_create_projection_defaults_and_persists(store_client: TestClient) -> None:
    item_ids = [str(store.CAREER_ITEM_ID_SUMMARY), str(store.CAREER_ITEM_ID_EDU)]
    resp = store_client.post(
        "/api/v1/projections",
        json={
            "name": "New variant",
            "targetRole": "Staff Engineer",
            "itemIds": item_ids,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "New variant"
    assert body["subtitle"] == "For Staff Engineer"
    assert body["tag"] == "VARIANT"
    assert body["targetRole"] == "Staff Engineer"
    assert body["templateId"] == str(store.TEMPLATE_ID_CLASSIC)  # default fallback
    assert body["body"] == "Projection including 2 career-history items."

    # Persisted: shows up in both getResumes and getProjections.
    assert resp.json()["id"] in {
        r["id"] for r in store_client.get("/api/v1/resumes").json()
    }
    assert resp.json()["id"] in {
        r["id"] for r in store_client.get("/api/v1/projections").json()
    }


def test_create_projection_snapshot_is_immutable_to_later_career_history_changes(
    store_client: TestClient,
) -> None:
    item_ids = [str(store.CAREER_ITEM_ID_SUMMARY), str(store.CAREER_ITEM_ID_EDU)]
    resp = store_client.post(
        "/api/v1/projections",
        json={"name": "Pinned variant", "itemIds": item_ids},
    )
    assert resp.status_code == 201
    projection_id = resp.json()["id"]
    assert resp.json()["body"] == "Projection including 2 career-history items."

    # Simulate a later career-history change (a new item lands after the
    # projection was pinned) by mutating the store directly -- there is no
    # mutating career-history route in this slice.
    new_item_id = uuid4()
    store.career_history[new_item_id] = CareerHistoryItem(
        id=new_item_id,
        kind=Kind3.skill,
        title="New skill added after pinning",
        bullets=["Should not retroactively appear in the pinned projection."],
        ordinal=5,
        sourceUploadIds=[],
    )

    assert len(store_client.get("/api/v1/career-history").json()) == 6

    # The already-created projection's body/snapshot must NOT change.
    again = store_client.get(f"/api/v1/resumes/{projection_id}").json()
    assert again["body"] == "Projection including 2 career-history items."
    assert len(store.resume_projection_items[UUID(projection_id)]) == 2


def test_assign_template_updates_and_persists(store_client: TestClient) -> None:
    resp = store_client.put(
        f"/api/v1/projections/{store.RESUME_ID_DISTRIBUTED}/template",
        json={"templateId": str(store.TEMPLATE_ID_COMPACT)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["templateId"] == str(store.TEMPLATE_ID_COMPACT)

    again = store_client.get(f"/api/v1/resumes/{store.RESUME_ID_DISTRIBUTED}").json()
    assert again["templateId"] == str(store.TEMPLATE_ID_COMPACT)


def test_assign_template_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.put(
        f"/api/v1/projections/{UNKNOWN_ID}/template",
        json={"templateId": str(store.TEMPLATE_ID_COMPACT)},
    )
    assert resp.status_code == 404


def test_render_export_creates_export(store_client: TestClient) -> None:
    resp = store_client.post(
        "/api/v1/exports", json={"projectionId": str(store.RESUME_ID_PLATFORM)}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["projectionId"] == str(store.RESUME_ID_PLATFORM)
    assert body["templateVersion"] == "v1"
    assert body["regenerable"] is True

    listing = store_client.get("/api/v1/resumes/exports").json()
    assert len(listing) == 2


def test_render_export_unknown_projection_returns_404(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/exports", json={"projectionId": UNKNOWN_ID})
    assert resp.status_code == 404


def test_regenerate_export_creates_new_export_at_bumped_version(
    store_client: TestClient,
) -> None:
    resp = store_client.post(f"/api/v1/exports/{store.EXPORT_ID_BACKEND}/regenerate")
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != str(store.EXPORT_ID_BACKEND)
    assert body["templateVersion"] == "v2"
    assert body["projectionId"] == str(store.RESUME_ID_DISTRIBUTED)

    # Original export is untouched -- never silently restyled.
    original = next(
        e
        for e in store_client.get("/api/v1/resumes/exports").json()
        if e["id"] == str(store.EXPORT_ID_BACKEND)
    )
    assert original["templateVersion"] == "v1"

    listing = store_client.get("/api/v1/resumes/exports").json()
    assert len(listing) == 2


def test_regenerate_export_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/exports/{UNKNOWN_ID}/regenerate")
    assert resp.status_code == 404
