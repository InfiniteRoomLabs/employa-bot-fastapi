"""Behavior tests for the LIBRARY resource. No database.

Covers: CRUD per kind (contacts/accomplishments/answers/projects),
soft-delete-excludes-from-list (D24), trash listing + round-trip, purge
permanence, deletion-impact dependent counts, and deriveAccomplishmentFromProject
semantics (snapshot + backlink, not live-bound) plus its synthetic AiRunEnvelope.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import store

UNKNOWN_ID = "00000000-0000-4000-8000-000000000000"

CONTACT_ID = str(store.CONTACT_ID_SARAH_CHEN)
ACCOMPLISHMENT_ID = str(store.ACCOMPLISHMENT_ID_P99)
ANSWER_ID = str(store.ANSWER_ID_COMP)
PROJECT_ID = str(store.PROJECT_ID_INGEST)
PROJECT_ID_TOOLING = str(store.PROJECT_ID_TOOLING)


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------


def test_get_contacts_lists_seeded_three(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/contacts")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert CONTACT_ID in {c["id"] for c in body}


def test_get_contact_returns_wire_shape(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/contacts/{CONTACT_ID}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Sarah Chen"
    assert body["isReference"] is False
    assert body["links"] == [
        {"label": "LinkedIn", "url": "https://linkedin.com/in/example"}
    ]


def test_get_contact_unknown_id_returns_404_envelope(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/contacts/{UNKNOWN_ID}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["kind"] == "not_found"
    assert set(body) <= {"kind", "path", "message"}


def _contact_draft(**overrides: object) -> dict[str, object]:
    draft: dict[str, object] = {
        "name": "New Contact",
        "role": "Hiring Manager",
        "org": "Acme",
        "email": "new@example.com",
        "phone": "",
        "relationship": "Recruiter",
        "isReference": False,
        "tags": [],
        "links": [],
        "notes": "",
    }
    draft.update(overrides)
    return draft


def test_create_contact_persists_and_returns_201(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/contacts", json=_contact_draft())
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "New Contact"
    assert "deletedAt" not in body or body["deletedAt"] is None

    listing = store_client.get("/api/v1/contacts").json()
    assert len(listing) == 4
    assert store_client.get(f"/api/v1/contacts/{body['id']}").status_code == 200


def test_update_contact_replaces_fields_and_bumps_updated(store_client: TestClient) -> None:
    before = store_client.get(f"/api/v1/contacts/{CONTACT_ID}").json()
    resp = store_client.patch(
        f"/api/v1/contacts/{CONTACT_ID}", json=_contact_draft(name="Sarah C. Chen")
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Sarah C. Chen"
    assert body["org"] == "Acme"  # full replace, not a merge of the old org
    assert body["updated"] != before["updated"]


def test_update_contact_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.patch(f"/api/v1/contacts/{UNKNOWN_ID}", json=_contact_draft())
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_delete_contact_soft_deletes_and_excludes_from_list(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/contacts/{CONTACT_ID}")
    assert resp.status_code == 204

    listing = store_client.get("/api/v1/contacts").json()
    assert CONTACT_ID not in {c["id"] for c in listing}
    assert len(listing) == 2

    # The record still exists (soft-deleted) -- fetchable directly by id.
    direct = store_client.get(f"/api/v1/contacts/{CONTACT_ID}")
    assert direct.status_code == 200
    assert direct.json()["deletedAt"] is not None


def test_delete_contact_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/contacts/{UNKNOWN_ID}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Accomplishments
# ---------------------------------------------------------------------------


def _accomplishment_draft(**overrides: object) -> dict[str, object]:
    draft: dict[str, object] = {
        "title": "New accomplishment",
        "summary": "Did a thing.",
        "tags": [],
        "source": None,
    }
    draft.update(overrides)
    return draft


def test_get_accomplishments_lists_seeded_three(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/accomplishments")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert ACCOMPLISHMENT_ID in {a["id"] for a in body}


def test_create_accomplishment_defaults_used_in_zero(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/accomplishments", json=_accomplishment_draft())
    assert resp.status_code == 201
    body = resp.json()
    assert body["usedIn"] == 0
    assert body["source"] is None

    listing = store_client.get("/api/v1/accomplishments").json()
    assert len(listing) == 4


def test_update_accomplishment_replaces_fields(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/accomplishments/{ACCOMPLISHMENT_ID}",
        json=_accomplishment_draft(title="Cut ingest p99 by 90%"),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Cut ingest p99 by 90%"
    # usedIn/id are preserved (not part of the draft payload).
    assert body["usedIn"] == 3


def test_update_accomplishment_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/accomplishments/{UNKNOWN_ID}", json=_accomplishment_draft()
    )
    assert resp.status_code == 404


def test_delete_accomplishment_soft_deletes_and_excludes_from_list(
    store_client: TestClient,
) -> None:
    resp = store_client.delete(f"/api/v1/accomplishments/{ACCOMPLISHMENT_ID}")
    assert resp.status_code == 204
    listing = store_client.get("/api/v1/accomplishments").json()
    assert ACCOMPLISHMENT_ID not in {a["id"] for a in listing}


def test_delete_accomplishment_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/accomplishments/{UNKNOWN_ID}")
    assert resp.status_code == 404


def test_derive_accomplishment_from_project_snapshots_and_backlinks(
    store_client: TestClient,
) -> None:
    project = store_client.get("/api/v1/projects").json()
    ingest = next(p for p in project if p["id"] == PROJECT_ID)

    resp = store_client.post(
        "/api/v1/accomplishments/derive-from-project",
        json={"projectId": PROJECT_ID},
    )
    assert resp.status_code == 201
    body = resp.json()

    derived = body["accomplishment"]
    assert derived["title"] == ingest["title"]
    assert derived["summary"] == ingest["body"][:160]
    assert derived["tags"] == ingest["tags"]
    assert derived["source"] == {"projectId": PROJECT_ID}
    assert derived["usedIn"] == 0

    ai_run = body["aiRun"]
    assert ai_run["provider"] == "fake"
    assert ai_run["status"] == "succeeded"
    assert ai_run["synthetic"] is True

    # Persisted as a real accomplishment, independently of the project.
    listing = store_client.get("/api/v1/accomplishments").json()
    assert derived["id"] in {a["id"] for a in listing}

    # NOT live-bound: mutating the project afterward does not change the
    # already-derived accomplishment.
    store_client.patch(
        f"/api/v1/projects/{PROJECT_ID}",
        json={
            "title": "Renamed project",
            "employer": ingest["employer"],
            "body": ingest["body"],
            "tags": ingest["tags"],
        },
    )
    still_derived = next(
        a
        for a in store_client.get("/api/v1/accomplishments").json()
        if a["id"] == derived["id"]
    )
    assert still_derived["title"] == ingest["title"]


def test_derive_accomplishment_from_project_unknown_project_404(
    store_client: TestClient,
) -> None:
    resp = store_client.post(
        "/api/v1/accomplishments/derive-from-project",
        json={"projectId": UNKNOWN_ID},
    )
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


# ---------------------------------------------------------------------------
# Answers
# ---------------------------------------------------------------------------


def _answer_draft(**overrides: object) -> dict[str, object]:
    draft: dict[str, object] = {
        "question": "New question?",
        "body": "New answer.",
        "category": "other",
        "tags": [],
    }
    draft.update(overrides)
    return draft


def test_get_answers_lists_seeded_four(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/answers")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 4
    assert ANSWER_ID in {a["id"] for a in body}


def test_create_answer_persists(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/answers", json=_answer_draft())
    assert resp.status_code == 201
    listing = store_client.get("/api/v1/answers").json()
    assert len(listing) == 5


def test_update_answer_replaces_fields(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/answers/{ANSWER_ID}", json=_answer_draft(question="Updated?")
    )
    assert resp.status_code == 200
    assert resp.json()["question"] == "Updated?"


def test_update_answer_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.patch(f"/api/v1/answers/{UNKNOWN_ID}", json=_answer_draft())
    assert resp.status_code == 404


def test_delete_answer_soft_deletes_and_excludes_from_list(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/answers/{ANSWER_ID}")
    assert resp.status_code == 204
    listing = store_client.get("/api/v1/answers").json()
    assert ANSWER_ID not in {a["id"] for a in listing}


def test_delete_answer_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/answers/{UNKNOWN_ID}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def _project_draft(**overrides: object) -> dict[str, object]:
    draft: dict[str, object] = {
        "title": "New project",
        "employer": "Acme",
        "body": "Did stuff.",
        "tags": [],
    }
    draft.update(overrides)
    return draft


def test_get_projects_lists_seeded_two(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/projects")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert PROJECT_ID in {p["id"] for p in body}


def test_create_project_persists(store_client: TestClient) -> None:
    resp = store_client.post("/api/v1/projects", json=_project_draft())
    assert resp.status_code == 201
    listing = store_client.get("/api/v1/projects").json()
    assert len(listing) == 3


def test_update_project_replaces_fields(store_client: TestClient) -> None:
    resp = store_client.patch(
        f"/api/v1/projects/{PROJECT_ID}", json=_project_draft(title="Renamed")
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"


def test_update_project_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.patch(f"/api/v1/projects/{UNKNOWN_ID}", json=_project_draft())
    assert resp.status_code == 404


def test_delete_project_soft_deletes_and_excludes_from_list(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/projects/{PROJECT_ID}")
    assert resp.status_code == 204
    listing = store_client.get("/api/v1/projects").json()
    assert PROJECT_ID not in {p["id"] for p in listing}


def test_delete_project_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/projects/{UNKNOWN_ID}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Credentials (read-only)
# ---------------------------------------------------------------------------


def test_get_credentials_empty_seed(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/credentials")
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# Trash: getTrash / restoreLibraryItem / purgeLibraryItem / getDeletionImpact
# ---------------------------------------------------------------------------


def test_trash_is_empty_before_any_delete(store_client: TestClient) -> None:
    resp = store_client.get("/api/v1/library/trash")
    assert resp.status_code == 200
    assert resp.json() == []


def test_trash_lists_soft_deleted_across_kinds_newest_first(store_client: TestClient) -> None:
    store_client.delete(f"/api/v1/contacts/{CONTACT_ID}")
    store_client.delete(f"/api/v1/projects/{PROJECT_ID}")

    resp = store_client.get("/api/v1/library/trash")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 2
    kinds_and_ids = {(e["kind"], e["id"]) for e in entries}
    assert ("contact", CONTACT_ID) in kinds_and_ids
    assert ("project", PROJECT_ID) in kinds_and_ids
    # newest-deleted first: the project (deleted second) sorts before the
    # contact (deleted first).
    assert entries[0]["id"] == PROJECT_ID


def test_restore_library_item_clears_deleted_at_and_round_trips(
    store_client: TestClient,
) -> None:
    store_client.delete(f"/api/v1/contacts/{CONTACT_ID}")
    assert CONTACT_ID not in {c["id"] for c in store_client.get("/api/v1/contacts").json()}

    resp = store_client.post(f"/api/v1/library/contact/{CONTACT_ID}/restore")
    assert resp.status_code == 204

    listing = store_client.get("/api/v1/contacts").json()
    assert CONTACT_ID in {c["id"] for c in listing}
    restored = next(c for c in listing if c["id"] == CONTACT_ID)
    assert restored["deletedAt"] is None

    trash = store_client.get("/api/v1/library/trash").json()
    assert CONTACT_ID not in {e["id"] for e in trash}


def test_restore_library_item_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.post(f"/api/v1/library/contact/{UNKNOWN_ID}/restore")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"


def test_purge_library_item_is_permanent(store_client: TestClient) -> None:
    store_client.delete(f"/api/v1/contacts/{CONTACT_ID}")

    resp = store_client.delete(f"/api/v1/library/contact/{CONTACT_ID}/purge")
    assert resp.status_code == 204

    # Gone from trash...
    trash = store_client.get("/api/v1/library/trash").json()
    assert CONTACT_ID not in {e["id"] for e in trash}
    # ...and gone entirely -- not resurrectable via a direct GET.
    assert store_client.get(f"/api/v1/contacts/{CONTACT_ID}").status_code == 404
    # ...and restore now 404s (nothing left to restore).
    assert (
        store_client.post(f"/api/v1/library/contact/{CONTACT_ID}/restore").status_code == 404
    )


def test_purge_library_item_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.delete(f"/api/v1/library/contact/{UNKNOWN_ID}/purge")
    assert resp.status_code == 404


def test_get_deletion_impact_project_counts_live_accomplishment_dependents(
    store_client: TestClient,
) -> None:
    resp = store_client.get(f"/api/v1/library/project/{PROJECT_ID}/deletion-impact")
    assert resp.status_code == 200
    body = resp.json()
    assert body["kind"] == "project"
    assert body["id"] == PROJECT_ID
    assert body["total"] == 1
    assert len(body["dependents"]) == 1
    dependent_group = body["dependents"][0]
    assert dependent_group["kind"] == "accomplishment"
    assert dependent_group["count"] == 1
    assert dependent_group["items"][0]["id"] == ACCOMPLISHMENT_ID


def test_get_deletion_impact_project_excludes_soft_deleted_dependents(
    store_client: TestClient,
) -> None:
    # The seeded accomplishment sourced from pj-tooling is the only
    # dependent of that project; soft-deleting it should zero the impact.
    tooling_accomplishment_id = next(
        a["id"]
        for a in store_client.get("/api/v1/accomplishments").json()
        if a.get("source") and a["source"]["projectId"] == PROJECT_ID_TOOLING
    )
    store_client.delete(f"/api/v1/accomplishments/{tooling_accomplishment_id}")

    resp = store_client.get(f"/api/v1/library/project/{PROJECT_ID_TOOLING}/deletion-impact")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["dependents"] == []


def test_get_deletion_impact_non_project_kind_has_no_dependents(
    store_client: TestClient,
) -> None:
    resp = store_client.get(f"/api/v1/library/contact/{CONTACT_ID}/deletion-impact")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["dependents"] == []


def test_get_deletion_impact_unknown_id_404(store_client: TestClient) -> None:
    resp = store_client.get(f"/api/v1/library/project/{UNKNOWN_ID}/deletion-impact")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"
