"""Behavior tests for the applications resource (ADR-006 / D6..D19). No
database.

Covers the transitionApplication core op exhaustively (every legal edge in
the settled matrix accepted; a representative illegal edge per source stage
rejected; version conflict; the applied/resumeId conditional and its
snapshot side effect), plus the full lifecycle: mark-won + undo (incl. an
expired window), dismiss dual-mode, reactivate, the timeline, and
createApplication's Job mint.
"""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app import store
from app.api.routes.applications import LEGAL_TRANSITIONS
from app.schemas import Stage
from tests.contract.helpers import MODAL, STRIPE, B
from tests.contract.helpers import UNKNOWN_ID as UNKNOWN

# Seeded well-known application ids (verbatim slugToUuid outputs).
VERCEL = "6a6918ec-3133-4cb3-8e36-d670323bfc73"  # platform, offer
ARC_WON = "8568e175-05d4-443b-8b0c-2e7a9bec6c16"  # archive, won
ARC_REJ = "85681ed3-7ad9-4514-8ae6-7f4b8e524091"  # archive, rejected

SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"
SEARCH_ID_AI_INFRA = "ad9e6c14-5b80-4f17-a3d2-7e6f9c1b0a55"
RESUME_ID = "c1a7e2b0-4d31-4f86-9a52-0b6d3e7f1c84"  # RESUME_ID_MASTER


def _put_app_at(stage: Stage, version: int = 1) -> str:
    """Re-stage the seeded Stripe application in the store (it carries a
    resolvable job + resume), returning its id -- a cheap way to place an
    application at any source stage without minting a fresh graph."""
    base = store.applications[UUID(STRIPE)]
    store.applications[UUID(STRIPE)] = base.model_copy(
        update={"stage": stage, "version": version}
    )
    return STRIPE


# ---------------------------------------------------------------------------
# reads: getApplications / getApplication
# ---------------------------------------------------------------------------


def test_get_applications_defaults_to_platform(store_client: TestClient) -> None:
    resp = store_client.get(f"{B}/applications")
    assert resp.status_code == 200
    assert len(resp.json()) == 14


def test_get_applications_filters_by_search_id(store_client: TestClient) -> None:
    assert (
        len(
            store_client.get(
                f"{B}/applications", params={"searchId": SEARCH_ID_BACKEND}
            ).json()
        )
        == 3
    )
    assert (
        len(
            store_client.get(
                f"{B}/applications", params={"searchId": SEARCH_ID_AI_INFRA}
            ).json()
        )
        == 1
    )


def test_get_applications_unknown_search_falls_back_to_platform(
    store_client: TestClient,
) -> None:
    assert (
        len(store_client.get(f"{B}/applications", params={"searchId": UNKNOWN}).json())
        == 14
    )


def test_get_application_joined_view(store_client: TestClient) -> None:
    resp = store_client.get(f"{B}/applications/{STRIPE}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["company"] == "Stripe"
    assert body["role"] == "Staff Engineer, Payments core"
    assert body["resumeName"] == "Distributed-systems"
    assert body["match"] == 92
    assert body["job"]["id"] == body["jobId"]


def test_get_application_resolves_archived(store_client: TestClient) -> None:
    assert store_client.get(f"{B}/applications/{ARC_WON}").status_code == 200


def test_get_application_unknown_404(store_client: TestClient) -> None:
    resp = store_client.get(f"{B}/applications/{UNKNOWN}")
    assert resp.status_code == 404
    assert resp.json()["kind"] == "not_found"
    assert resp.json()["path"] == f"{B}/applications/{UNKNOWN}"


# ---------------------------------------------------------------------------
# transitionApplication -- every legal edge accepted
# ---------------------------------------------------------------------------

_LEGAL_PAIRS = [
    (source, target)
    for source, targets in LEGAL_TRANSITIONS.items()
    for target in sorted(targets, key=lambda s: s.value)
]


@pytest.mark.parametrize(
    ("source", "target"),
    _LEGAL_PAIRS,
    ids=[f"{s.value}->{t.value}" for s, t in _LEGAL_PAIRS],
)
def test_legal_transition_accepted(
    store_client: TestClient, source: Stage, target: Stage
) -> None:
    _put_app_at(source)
    payload: dict[str, object] = {"targetStage": target.value, "expectedVersion": 1}
    if target == Stage.applied:
        payload["resumeId"] = RESUME_ID
    resp = store_client.post(f"{B}/applications/{STRIPE}/transitions", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["application"]["stage"] == target.value
    assert body["application"]["version"] == 2  # bumped on success
    assert body["transition"]["fromStage"] == source.value
    assert body["transition"]["toStage"] == target.value
    assert body["transition"]["source"] == "user"


# ---------------------------------------------------------------------------
# transitionApplication -- a representative illegal edge per source stage
# ---------------------------------------------------------------------------


def _one_illegal_target(source: Stage) -> Stage:
    allowed = LEGAL_TRANSITIONS[source]
    for candidate in LEGAL_TRANSITIONS:
        if candidate != source and candidate not in allowed:
            return candidate
    raise AssertionError("every stage has at least one illegal target")


_ILLEGAL_PAIRS = [(s, _one_illegal_target(s)) for s in LEGAL_TRANSITIONS]


@pytest.mark.parametrize(
    ("source", "target"),
    _ILLEGAL_PAIRS,
    ids=[f"{s.value}->{t.value}" for s, t in _ILLEGAL_PAIRS],
)
def test_illegal_transition_rejected(
    store_client: TestClient, source: Stage, target: Stage
) -> None:
    _put_app_at(source)
    resp = store_client.post(
        f"{B}/applications/{STRIPE}/transitions",
        json={"targetStage": target.value, "expectedVersion": 1},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["kind"] == "invalid_transition"


# ---------------------------------------------------------------------------
# transitionApplication -- version guard + applied/resumeId + snapshot
# ---------------------------------------------------------------------------


def test_transition_version_conflict(store_client: TestClient) -> None:
    _put_app_at(Stage.applied, version=1)
    resp = store_client.post(
        f"{B}/applications/{STRIPE}/transitions",
        json={"targetStage": "screening", "expectedVersion": 99},
    )
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_applied_requires_resume_id(store_client: TestClient) -> None:
    _put_app_at(Stage.drafting)
    resp = store_client.post(
        f"{B}/applications/{STRIPE}/transitions",
        json={"targetStage": "applied", "expectedVersion": 1},
    )
    assert resp.status_code == 422
    assert resp.json()["kind"] == "validation_error"


def test_applied_captures_snapshot(store_client: TestClient) -> None:
    _put_app_at(Stage.drafting)
    resp = store_client.post(
        f"{B}/applications/{STRIPE}/transitions",
        json={"targetStage": "applied", "expectedVersion": 1, "resumeId": RESUME_ID},
    )
    assert resp.status_code == 200
    assert resp.json()["application"]["submittedSnapshotId"] is not None
    snap = store_client.get(f"{B}/applications/{STRIPE}/snapshot")
    assert snap.status_code == 200
    assert snap.json()["resumeId"] == RESUME_ID
    assert snap.json()["applicationId"] == STRIPE


def test_snapshot_conflict_before_applied(store_client: TestClient) -> None:
    # MODAL is seeded at DRAFTING -- no submitted copy exists yet.
    resp = store_client.get(f"{B}/applications/{MODAL}/snapshot")
    assert resp.status_code == 409
    assert resp.json()["kind"] == "conflict"


def test_snapshot_synthesized_for_seeded_applied(store_client: TestClient) -> None:
    # Seeded APPLIED app with no captured snapshot -> mock-parity synthesis.
    resp = store_client.get(f"{B}/applications/{STRIPE}/snapshot")
    assert resp.status_code == 200


def test_snapshot_unknown_app_404(store_client: TestClient) -> None:
    assert store_client.get(f"{B}/applications/{UNKNOWN}/snapshot").status_code == 404


# ---------------------------------------------------------------------------
# markWon / undoMarkWon (D18)
# ---------------------------------------------------------------------------


def test_mark_won_archives_and_grants_undo(store_client: TestClient) -> None:
    resp = store_client.post(
        f"{B}/applications/{VERCEL}/mark-won", json={"whatWorked": "prep"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["application"]["outcome"] == "won"
    assert body["undoWindowSeconds"] == 300
    assert body["undoToken"]
    assert body["undoExpiresAt"]
    # moved out of the active pool, into the archive (won count 1 -> 2).
    assert store_client.get(f"{B}/archive/counts").json()["won"] == 2
    assert store_client.get(f"{B}/applications/{VERCEL}").json()["outcome"] == "won"


def test_mark_won_undo_round_trip(store_client: TestClient) -> None:
    token = store_client.post(f"{B}/applications/{VERCEL}/mark-won", json={}).json()[
        "undoToken"
    ]
    resp = store_client.post(
        f"{B}/applications/{VERCEL}/undo-mark-won", json={"undoToken": token}
    )
    assert resp.status_code == 200
    assert resp.json()["stage"] == "offer"  # restored to the pre-win stage
    assert store_client.get(f"{B}/archive/counts").json()["won"] == 1


def test_mark_won_undo_expired_window(store_client: TestClient) -> None:
    token = store_client.post(f"{B}/applications/{VERCEL}/mark-won", json={}).json()[
        "undoToken"
    ]
    # Freeze the clock forward by forcing the grant's expiry into the past.
    store.undo_grants[UUID(token)].expires_at = store.now() - timedelta(seconds=1)
    resp = store_client.post(
        f"{B}/applications/{VERCEL}/undo-mark-won", json={"undoToken": token}
    )
    assert resp.status_code == 409
    assert resp.json()["kind"] == "undo_window_expired"


def test_undo_unknown_token_404(store_client: TestClient) -> None:
    resp = store_client.post(
        f"{B}/applications/{VERCEL}/undo-mark-won", json={"undoToken": UNKNOWN}
    )
    assert resp.status_code == 404


def test_mark_won_unknown_app_404(store_client: TestClient) -> None:
    assert (
        store_client.post(f"{B}/applications/{UNKNOWN}/mark-won", json={}).status_code
        == 404
    )


# ---------------------------------------------------------------------------
# reactivate (D19)
# ---------------------------------------------------------------------------


def test_reactivate_clears_outcome_and_resurrects(store_client: TestClient) -> None:
    resp = store_client.post(f"{B}/applications/{ARC_REJ}/reactivate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["stage"] == "applied"
    assert body["resurrected"] is True
    assert body["outcome"] is None
    # now back in the active platform pool.
    ids = [a["id"] for a in store_client.get(f"{B}/applications").json()]
    assert ARC_REJ in ids


def test_reactivate_unknown_404(store_client: TestClient) -> None:
    assert (
        store_client.post(f"{B}/applications/{UNKNOWN}/reactivate").status_code == 404
    )


# ---------------------------------------------------------------------------
# dismiss (D12 dual-mode)
# ---------------------------------------------------------------------------


def test_dismiss_pre_commit_hard_removes(store_client: TestClient) -> None:
    # MODAL is seeded at DRAFTING -> hard remove, outcome=removed.
    resp = store_client.post(f"{B}/applications/{MODAL}/dismiss", json={})
    assert resp.status_code == 200
    assert resp.json()["outcome"] == "removed"
    assert store_client.get(f"{B}/applications/{MODAL}").status_code == 404


def test_dismiss_post_applied_withdraws_and_archives(store_client: TestClient) -> None:
    # STRIPE is seeded at APPLIED -> maps to WITHDREW + archive.
    resp = store_client.post(
        f"{B}/applications/{STRIPE}/dismiss", json={"reasons": ["comp", "location"]}
    )
    assert resp.status_code == 200
    assert resp.json()["outcome"] == "withdrew"
    archived = store_client.get(f"{B}/applications/{STRIPE}").json()
    assert archived["outcome"] == "withdrawn"
    assert archived["stage"] == "withdrew"
    # counted in the "passed" archive bucket now.
    assert store_client.get(f"{B}/archive/counts").json()["passed"] == 15


def test_dismiss_unknown_404(store_client: TestClient) -> None:
    assert (
        store_client.post(f"{B}/applications/{UNKNOWN}/dismiss", json={}).status_code
        == 404
    )


# ---------------------------------------------------------------------------
# timeline (TRK-118)
# ---------------------------------------------------------------------------


def test_timeline_seeded(store_client: TestClient) -> None:
    resp = store_client.get(f"{B}/applications/{STRIPE}/timeline")
    assert resp.status_code == 200
    assert len(resp.json()) == 4
    assert resp.json()[0]["who"] == "You"


def test_timeline_synthetic_fallback(store_client: TestClient) -> None:
    # NEON is seeded but has no fixture timeline -> synthetic single event.
    neon = "a822d3fe-0cda-4434-8464-9774e3fc8684"
    resp = store_client.get(f"{B}/applications/{neon}/timeline")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["message"].startswith("Applied via")


def test_timeline_records_transition(store_client: TestClient) -> None:
    _put_app_at(Stage.applied)
    before = len(store_client.get(f"{B}/applications/{STRIPE}/timeline").json())
    store_client.post(
        f"{B}/applications/{STRIPE}/transitions",
        json={"targetStage": "screening", "expectedVersion": 1},
    )
    after = store_client.get(f"{B}/applications/{STRIPE}/timeline").json()
    assert len(after) == before + 1
    assert after[-1]["message"] == "Moved to screening"


def test_timeline_unknown_404(store_client: TestClient) -> None:
    assert store_client.get(f"{B}/applications/{UNKNOWN}/timeline").status_code == 404


# ---------------------------------------------------------------------------
# createApplication (ORI-014) -- mints a Job
# ---------------------------------------------------------------------------


def test_create_application_mints_job(store_client: TestClient) -> None:
    jobs_before = len(store_client.get(f"{B}/jobs").json())
    resp = store_client.post(
        f"{B}/applications",
        json={
            "company": "Acme",
            "role": "Staff Engineer",
            "location": "Remote - US",
            "salary": {"min": 200000, "max": 250000, "extra": []},
            "match": 77,
            "source": "greenhouse",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["company"] == "Acme"
    assert body["stage"] == "drafting"
    assert body["searchId"] is not None  # auto-assigned via ensure-default-search
    # the posting was minted into the job store and resolves via getJob.
    assert len(store_client.get(f"{B}/jobs").json()) == jobs_before + 1
    assert store_client.get(f"{B}/jobs/{body['jobId']}").status_code == 200


def test_create_application_honors_explicit_search(store_client: TestClient) -> None:
    resp = store_client.post(
        f"{B}/applications",
        json={
            "company": "Beta",
            "role": "Principal Engineer",
            "location": "Remote - US",
            "salary": None,
            "match": 60,
            "source": "lever",
            "searchId": SEARCH_ID_BACKEND,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["searchId"] == SEARCH_ID_BACKEND
