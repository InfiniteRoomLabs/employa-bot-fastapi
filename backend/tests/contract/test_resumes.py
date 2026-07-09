"""Behavior tests for resumes + resume-lifecycle (17 ops). No database.

Covers: happy paths across both resources, the 404 Error envelope, the
delete-lock 409 envelope (by tag and by usedIn), set-default demotion,
regenerate-creates-a-new-export, and projection snapshot immutability.
"""

from __future__ import annotations

from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app import store
from app.schemas import CareerHistoryItem, Kind3

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"


# ---------------------------------------------------------------------------
# resumes
# ---------------------------------------------------------------------------


def test_get_resumes_lists_seeded_six(client: TestClient) -> None:
    resp = client.get("/api/v1/resumes")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 6
    ids = {r["id"] for r in body}
    assert str(store.RESUME_ID_MASTER) in ids


def test_get_resume_returns_wire_shape(client: TestClient) -> None:
    resp = client.get(f"/api/v1/resumes/{store.RESUME_ID_MASTER}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Master"
    assert body["tag"] == "MASTER"
    assert body["usedIn"] == 0
    assert body["match"] is None


def test_get_resume_unknown_id_returns_404_envelope(client: TestClient) -> None:
    resp = client.get(f"/api/v1/resumes/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/resumes/{UNKNOWN_ID}"
    assert set(body) <= {"kind", "path", "message"}


def test_create_resume_defaults_and_persists(client: TestClient) -> None:
    resp = client.post("/api/v1/resumes")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Untitled revision"
    assert body["subtitle"] == ""
    assert body["version"] == "v1"
    assert body["usedIn"] == 0
    assert body["tag"] == "DRAFT"
    assert body["body"] == ""

    listing = client.get("/api/v1/resumes").json()
    assert len(listing) == 7
    assert client.get(f"/api/v1/resumes/{body['id']}").status_code == 200


def test_patch_resume_merges_only_sent_fields(client: TestClient) -> None:
    resp = client.patch(
        f"/api/v1/resumes/{store.RESUME_ID_FOUNDER}",
        json={"name": "Founder narrative v2"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Founder narrative v2"
    # Untouched fields preserved.
    assert body["tag"] == "DRAFT"
    assert body["subtitle"] == "Different framing - exploring"

    resp2 = client.patch(
        f"/api/v1/resumes/{store.RESUME_ID_FOUNDER}",
        json={"scoringEnabled": False},
    )
    body2 = resp2.json()
    assert body2["scoringEnabled"] is False
    # Rename from the previous PATCH persisted.
    assert body2["name"] == "Founder narrative v2"


def test_patch_resume_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.patch(f"/api/v1/resumes/{UNKNOWN_ID}", json={"name": "x"})
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_delete_resume_removes_unlocked_draft(client: TestClient) -> None:
    resp = client.delete(f"/api/v1/resumes/{store.RESUME_ID_FOUNDER}")
    assert resp.status_code == 204
    listing = client.get("/api/v1/resumes").json()
    assert str(store.RESUME_ID_FOUNDER) not in {r["id"] for r in listing}


def test_delete_resume_locked_tag_returns_409_envelope(client: TestClient) -> None:
    # MASTER tag is locked regardless of usedIn.
    resp = client.delete(f"/api/v1/resumes/{store.RESUME_ID_MASTER}")
    assert resp.status_code == 409
    body = resp.json()
    assert body["kind"] == "conflict"
    assert set(body) <= {"kind", "path", "message"}


def test_delete_resume_used_in_positive_returns_409_envelope(
    client: TestClient,
) -> None:
    # PLATFORM is tag=VARIANT (not a locked tag) but usedIn=3 > 0.
    resp = client.delete(f"/api/v1/resumes/{store.RESUME_ID_PLATFORM}")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_delete_resume_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.delete(f"/api/v1/resumes/{UNKNOWN_ID}")
    assert resp.status_code == 404


def test_duplicate_resume_creates_draft_copy(client: TestClient) -> None:
    resp = client.post(f"/api/v1/resumes/{store.RESUME_ID_PLATFORM}/duplicate")
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != str(store.RESUME_ID_PLATFORM)
    assert body["name"] == "Platform / infra (copy)"
    assert body["tag"] == "DRAFT"
    assert body["usedIn"] == 0
    # Non-mutated fields carried over from the source.
    assert body["subtitle"] == "Developer-platform emphasis"

    listing = client.get("/api/v1/resumes").json()
    assert len(listing) == 7


def test_duplicate_resume_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.post(f"/api/v1/resumes/{UNKNOWN_ID}/duplicate")
    assert resp.status_code == 404


def test_set_default_resume_demotes_previous_default(client: TestClient) -> None:
    # DISTRIBUTED starts as DEFAULT; PLATFORM starts as VARIANT.
    resp = client.post(f"/api/v1/resumes/{store.RESUME_ID_PLATFORM}/set-default")
    assert resp.status_code == 200
    collection = {r["id"]: r for r in resp.json()}
    assert collection[str(store.RESUME_ID_PLATFORM)]["tag"] == "DEFAULT"
    assert collection[str(store.RESUME_ID_DISTRIBUTED)]["tag"] == "VARIANT"

    # Round-trip: persisted, not just returned.
    again = client.get("/api/v1/resumes").json()
    again_by_id = {r["id"]: r for r in again}
    assert again_by_id[str(store.RESUME_ID_PLATFORM)]["tag"] == "DEFAULT"
    assert again_by_id[str(store.RESUME_ID_DISTRIBUTED)]["tag"] == "VARIANT"


def test_set_default_resume_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.post(f"/api/v1/resumes/{UNKNOWN_ID}/set-default")
    assert resp.status_code == 404


def test_fork_resume_as_draft_creates_tailored_draft(client: TestClient) -> None:
    job_id = "11111111-1111-4111-8111-111111111111"
    resp = client.post(
        f"/api/v1/resumes/{store.RESUME_ID_MASTER}/fork",
        json={"jobId": job_id},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != str(store.RESUME_ID_MASTER)
    assert body["name"] == "Master - tailored draft"
    assert body["tag"] == "DRAFT"
    assert body["usedIn"] == 0
    assert body["body"] == store.resumes[store.RESUME_ID_MASTER].body


def test_fork_resume_as_draft_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.post(
        f"/api/v1/resumes/{UNKNOWN_ID}/fork",
        json={"jobId": "11111111-1111-4111-8111-111111111111"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# resume lifecycle
# ---------------------------------------------------------------------------


def test_get_resume_uploads_lists_seeded_two(client: TestClient) -> None:
    resp = client.get("/api/v1/resumes/uploads")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert {u["id"] for u in body} == {
        str(store.UPLOAD_ID_SWE_2023),
        str(store.UPLOAD_ID_DEVOPS_2022),
    }


def test_get_career_history_sorted_by_ordinal(client: TestClient) -> None:
    resp = client.get("/api/v1/career-history")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 5
    assert [item["ordinal"] for item in body] == [0, 1, 2, 3, 4]


def test_get_resume_templates_lists_seeded_three(client: TestClient) -> None:
    resp = client.get("/api/v1/resumes/templates")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert {t["id"] for t in body} == {
        str(store.TEMPLATE_ID_CLASSIC),
        str(store.TEMPLATE_ID_TWO_COL),
        str(store.TEMPLATE_ID_COMPACT),
    }


def test_get_resume_exports_lists_seeded_one(client: TestClient) -> None:
    resp = client.get("/api/v1/resumes/exports")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == str(store.EXPORT_ID_BACKEND)


def test_get_projections_excludes_format_tag(client: TestClient) -> None:
    resp = client.get("/api/v1/projections")
    assert resp.status_code == 200
    ids = {r["id"] for r in resp.json()}
    assert str(store.RESUME_ID_SHORT) not in ids  # FORMAT tag, excluded
    assert str(store.RESUME_ID_MASTER) in ids
    assert len(ids) == 5


def test_create_projection_defaults_and_persists(client: TestClient) -> None:
    item_ids = [str(store.CAREER_ITEM_ID_SUMMARY), str(store.CAREER_ITEM_ID_EDU)]
    resp = client.post(
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
    assert resp.json()["id"] in {r["id"] for r in client.get("/api/v1/resumes").json()}
    assert resp.json()["id"] in {
        r["id"] for r in client.get("/api/v1/projections").json()
    }


def test_create_projection_snapshot_is_immutable_to_later_career_history_changes(
    client: TestClient,
) -> None:
    item_ids = [str(store.CAREER_ITEM_ID_SUMMARY), str(store.CAREER_ITEM_ID_EDU)]
    resp = client.post(
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

    assert len(client.get("/api/v1/career-history").json()) == 6

    # The already-created projection's body/snapshot must NOT change.
    again = client.get(f"/api/v1/resumes/{projection_id}").json()
    assert again["body"] == "Projection including 2 career-history items."
    assert len(store.resume_projection_items[UUID(projection_id)]) == 2


def test_assign_template_updates_and_persists(client: TestClient) -> None:
    resp = client.put(
        f"/api/v1/projections/{store.RESUME_ID_DISTRIBUTED}/template",
        json={"templateId": str(store.TEMPLATE_ID_COMPACT)},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["templateId"] == str(store.TEMPLATE_ID_COMPACT)

    again = client.get(f"/api/v1/resumes/{store.RESUME_ID_DISTRIBUTED}").json()
    assert again["templateId"] == str(store.TEMPLATE_ID_COMPACT)


def test_assign_template_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.put(
        f"/api/v1/projections/{UNKNOWN_ID}/template",
        json={"templateId": str(store.TEMPLATE_ID_COMPACT)},
    )
    assert resp.status_code == 404


def test_render_export_creates_export(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/exports", json={"projectionId": str(store.RESUME_ID_PLATFORM)}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["projectionId"] == str(store.RESUME_ID_PLATFORM)
    assert body["templateVersion"] == "v1"
    assert body["regenerable"] is True

    listing = client.get("/api/v1/resumes/exports").json()
    assert len(listing) == 2


def test_render_export_unknown_projection_returns_404(client: TestClient) -> None:
    resp = client.post("/api/v1/exports", json={"projectionId": UNKNOWN_ID})
    assert resp.status_code == 404


def test_regenerate_export_creates_new_export_at_bumped_version(
    client: TestClient,
) -> None:
    resp = client.post(f"/api/v1/exports/{store.EXPORT_ID_BACKEND}/regenerate")
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != str(store.EXPORT_ID_BACKEND)
    assert body["templateVersion"] == "v2"
    assert body["projectionId"] == str(store.RESUME_ID_DISTRIBUTED)

    # Original export is untouched -- never silently restyled.
    original = next(
        e
        for e in client.get("/api/v1/resumes/exports").json()
        if e["id"] == str(store.EXPORT_ID_BACKEND)
    )
    assert original["templateVersion"] == "v1"

    listing = client.get("/api/v1/resumes/exports").json()
    assert len(listing) == 2


def test_regenerate_export_unknown_id_returns_404(client: TestClient) -> None:
    resp = client.post(f"/api/v1/exports/{UNKNOWN_ID}/regenerate")
    assert resp.status_code == 404
