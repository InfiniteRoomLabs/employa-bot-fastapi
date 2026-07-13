"""Behavior tests for resumes (RES-019 / CUR-020). No database.

Covers: happy paths, the 404 Error envelope, the delete-lock 409 envelope
(by tag and by usedIn), and set-default demotion.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import store
from tests.contract.helpers import UNKNOWN_ID


def test_get_resumes_lists_seeded_six(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/resumes")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 6
    ids = {r["id"] for r in body}
    assert str(store.RESUME_ID_MASTER) in ids


def test_get_resume_returns_wire_shape(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/resumes/{store.RESUME_ID_MASTER}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Master"
    assert body["tag"] == "MASTER"
    assert body["usedIn"] == 0
    assert body["match"] is None


def test_get_resume_unknown_id_returns_404_envelope(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/resumes/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert body["path"] == f"/api/v1/resumes/{UNKNOWN_ID}"
    assert set(body) <= {"kind", "path", "message"}


def test_create_resume_defaults_and_persists(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/resumes")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Untitled revision"
    assert body["subtitle"] == ""
    assert body["version"] == "v1"
    assert body["usedIn"] == 0
    assert body["tag"] == "DRAFT"
    assert body["body"] == ""

    listing = store_client.get("/api/v1/resumes").json()
    assert len(listing) == 7
    assert store_client.get(f"/api/v1/resumes/{body['id']}").status_code == 200


def test_patch_resume_merges_only_sent_fields(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/resumes/{store.RESUME_ID_FOUNDER}",
        json={"name": "Founder narrative v2"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Founder narrative v2"
    # Untouched fields preserved.
    assert body["tag"] == "DRAFT"
    assert body["subtitle"] == "Different framing - exploring"

    resp2 = store_client.patch(
        f"/api/v1/resumes/{store.RESUME_ID_FOUNDER}",
        json={"scoringEnabled": False},
    )
    body2 = resp2.json()
    assert body2["scoringEnabled"] is False
    # Rename from the previous PATCH persisted.
    assert body2["name"] == "Founder narrative v2"


def test_patch_resume_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.patch(f"/api/v1/resumes/{UNKNOWN_ID}", json={"name": "x"})
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_delete_resume_removes_unlocked_draft(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/resumes/{store.RESUME_ID_FOUNDER}")
    assert resp.status_code == 204
    listing = store_client.get("/api/v1/resumes").json()
    assert str(store.RESUME_ID_FOUNDER) not in {r["id"] for r in listing}


def test_delete_resume_locked_tag_returns_409_envelope(store_client: TestClient) -> None:
    # MASTER tag is locked regardless of usedIn.
    resp = store_client.delete(f"/api/v1/resumes/{store.RESUME_ID_MASTER}")
    assert resp.status_code == 409
    body = resp.json()
    assert body["kind"] == "conflict"
    assert set(body) <= {"kind", "path", "message"}


def test_delete_resume_used_in_positive_returns_409_envelope(
    store_client: TestClient,
) -> None:
    # PLATFORM is tag=VARIANT (not a locked tag) but usedIn=3 > 0.
    resp = store_client.delete(f"/api/v1/resumes/{store.RESUME_ID_PLATFORM}")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_delete_resume_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/resumes/{UNKNOWN_ID}")
    assert resp.status_code == 404


def test_duplicate_resume_creates_draft_copy(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/resumes/{store.RESUME_ID_PLATFORM}/duplicate")
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] != str(store.RESUME_ID_PLATFORM)
    assert body["name"] == "Platform / infra (copy)"
    assert body["tag"] == "DRAFT"
    assert body["usedIn"] == 0
    # Non-mutated fields carried over from the source.
    assert body["subtitle"] == "Developer-platform emphasis"

    listing = store_client.get("/api/v1/resumes").json()
    assert len(listing) == 7


def test_duplicate_resume_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/resumes/{UNKNOWN_ID}/duplicate")
    assert resp.status_code == 404


def test_set_default_resume_demotes_previous_default(store_client: TestClient) -> None:
    # DISTRIBUTED starts as DEFAULT; PLATFORM starts as VARIANT.
    resp = store_client.post(f"/api/v1/resumes/{store.RESUME_ID_PLATFORM}/set-default")
    assert resp.status_code == 200
    collection = {r["id"]: r for r in resp.json()}
    assert collection[str(store.RESUME_ID_PLATFORM)]["tag"] == "DEFAULT"
    assert collection[str(store.RESUME_ID_DISTRIBUTED)]["tag"] == "VARIANT"

    # Round-trip: persisted, not just returned.
    again = store_client.get("/api/v1/resumes").json()
    again_by_id = {r["id"]: r for r in again}
    assert again_by_id[str(store.RESUME_ID_PLATFORM)]["tag"] == "DEFAULT"
    assert again_by_id[str(store.RESUME_ID_DISTRIBUTED)]["tag"] == "VARIANT"


def test_set_default_resume_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/resumes/{UNKNOWN_ID}/set-default")
    assert resp.status_code == 404


def test_fork_resume_as_draft_creates_tailored_draft(store_client: TestClient) -> None:
    job_id = "11111111-1111-4111-8111-111111111111"
    resp = store_client.post(
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


def test_fork_resume_as_draft_unknown_id_returns_404(store_client: TestClient) -> None:
    resp = store_client.post(
        f"/api/v1/resumes/{UNKNOWN_ID}/fork",
        json={"jobId": "11111111-1111-4111-8111-111111111111"},
    )
    assert resp.status_code == 404
