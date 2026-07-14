"""Behavior tests for the MOCK-SERVED applications surface. No database.

Since sprint-04 3a, getApplications' default view / getApplication /
createApplication are DB-backed (docs/sprints/sprint-04-spec.md PIN-6); their
fidelity/tenancy/provenance coverage lives in
``tests/api/routes/test_applications.py``. Only getApplications' RECOGNIZED
mock searchId view (BACKEND/AI_INFRA) is still mock-served and covered here
(PIN-3 precedent from ``tests/contract/test_shortlist.py``).

Since sprint-04 3b, transitionApplication and getResumeSnapshot's DB-row path
are ALSO DB-backed (PIN-6): the op is DB-only post-flip -- mock store
fixtures are not transitionable -- so the legal/illegal matrix, the version-
conflict guard, the applied/resumeId conditional, and the resulting snapshot
now live in ``tests/api/routes/test_transitions.py``. What's left here is
what STILL stays mock through 3c: mark-won + undo (incl. an expired window),
dismiss dual-mode, reactivate, and the timeline -- plus getResumeSnapshot's
STORE-fixture synthesis fallback (the route retains that seam for seeded
mock applications).
"""

from __future__ import annotations

from datetime import timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from app import store
from tests.contract.helpers import MODAL, STRIPE, B
from tests.contract.helpers import UNKNOWN_ID as UNKNOWN

# Seeded well-known application ids (verbatim slugToUuid outputs).
VERCEL = "6a6918ec-3133-4cb3-8e36-d670323bfc73"  # platform, offer
ARC_WON = "8568e175-05d4-443b-8b0c-2e7a9bec6c16"  # archive, won
ARC_REJ = "85681ed3-7ad9-4514-8ae6-7f4b8e524091"  # archive, rejected

SEARCH_ID_BACKEND = "b53a91e7-0f44-4d2b-8a05-6c1d2e9b4f30"
SEARCH_ID_AI_INFRA = "ad9e6c14-5b80-4f17-a3d2-7e6f9c1b0a55"


# ---------------------------------------------------------------------------
# reads: getApplications' recognized-searchId mock view (PIN-3 precedent)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# transitionApplication (the legal/illegal matrix, version conflict, the
# applied/resumeId conditional, and its snapshot side effect) is DB-only
# since sprint-04 3b -- mock store fixtures like STRIPE are no longer
# transitionable. That coverage lives entirely in
# tests/api/routes/test_transitions.py now. What's left here is
# getResumeSnapshot's STORE-fixture path: the route retains the mock
# fallback (DEBT-5) for seeded fixtures a DB-only transitionApplication can
# no longer produce, so its 409/200-synthesis/404 behavior on those fixtures
# is still worth covering directly.
# ---------------------------------------------------------------------------


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
    # Moved out of the active pool, into the mock archive. Checked directly
    # against the mock store, not getArchiveCounts: since sprint-04 3a that
    # op is DB-backed (PIN-16) and markWon stays mock through 3c, so a mock
    # archive move doesn't (yet) move the DB-backed counts -- an accepted
    # seam of this checkpoint's operation-boundary split, same class as
    # DEBT-5.
    assert UUID(VERCEL) in store.archive
    assert UUID(VERCEL) not in store.applications
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
    # Restored to the mock active pool (checked directly -- see the
    # DB-backed-getArchiveCounts note above).
    assert UUID(VERCEL) in store.applications
    assert UUID(VERCEL) not in store.archive


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
    # Now readable again as a live (non-archived) application via
    # getApplication -- checked at the ITEM endpoint (mock-store fallback),
    # not the collection endpoint: since sprint-04 3a getApplications'
    # default view is DB-backed (PIN-6) and reactivateApplication itself
    # stays mock through 3b/3c, so a reactivated mock fixture does not
    # (yet) resurface in that DB-backed list -- an accepted seam of this
    # checkpoint's operation-boundary split, same class as DEBT-5.
    again = store_client.get(f"{B}/applications/{ARC_REJ}")
    assert again.status_code == 200
    assert again.json()["stage"] == "applied"


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
    # Moved into the mock archive's "passed" bucket (checked directly, not
    # via getArchive/getArchiveCounts -- DB-backed since sprint-04 3a while
    # dismissApplication stays mock through 3c; see the mark-won note above).
    assert UUID(STRIPE) in store.archive
    assert store.archive[UUID(STRIPE)].outcome == "withdrawn"


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


# test_timeline_records_transition (append-via-transition coverage) drove
# its mutation through transitionApplication, now DB-only -- removed here;
# the timeline's transition-derived coverage returns in 3c once
# getApplicationTimeline itself flips to a stage_transition projection
# (PIN-13).


def test_timeline_unknown_404(store_client: TestClient) -> None:
    assert store_client.get(f"{B}/applications/{UNKNOWN}/timeline").status_code == 404


# createApplication (ORI-014) is DB-backed since sprint-04 3a -- its Job-mint
# and DB-persistence coverage now lives in
# tests/api/routes/test_applications.py.
