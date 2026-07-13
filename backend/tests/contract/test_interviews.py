"""Behavior tests for the interview-round sub-resource (TRK-117 / TRK-127).
No database.

Covers: the allowlist enforcement (only date/type/format/status are
mutable), the empty-list case for an application with no rounds, and the
404 envelope on unknown round ids.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import MODAL, STRIPE, B
from tests.contract.helpers import UNKNOWN_ID as UNKNOWN


def test_get_interview_rounds(client: TestClient) -> None:
    resp = client.get(f"{B}/applications/{STRIPE}/interviews")
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    assert {r["type"] for r in resp.json()} == {"recruiter-screen", "technical"}


def test_get_interview_rounds_empty(client: TestClient) -> None:
    # MODAL has no seeded rounds -> empty list, not a 404.
    resp = client.get(f"{B}/applications/{MODAL}/interviews")
    assert resp.status_code == 200
    assert resp.json() == []


def test_patch_interview_round_allowlisted_field(client: TestClient) -> None:
    round_id = client.get(f"{B}/applications/{STRIPE}/interviews").json()[0]["id"]
    resp = client.patch(
        f"{B}/applications/{STRIPE}/interviews/{round_id}",
        json={"status": "cancelled"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_patch_interview_round_rejects_unknown_field(client: TestClient) -> None:
    round_id = client.get(f"{B}/applications/{STRIPE}/interviews").json()[0]["id"]
    resp = client.patch(
        f"{B}/applications/{STRIPE}/interviews/{round_id}",
        json={"appId": UNKNOWN, "note": "not allowed"},
    )
    assert resp.status_code == 422
    assert resp.json()["kind"] == "validation_error"


def test_patch_interview_round_unknown_404(client: TestClient) -> None:
    resp = client.patch(
        f"{B}/applications/{STRIPE}/interviews/{UNKNOWN}", json={"status": "completed"}
    )
    assert resp.status_code == 404
