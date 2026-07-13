"""Behavior tests for the archive resource (ORI-009). No database.

Covers: outcome-bucketed reads, seeded counts, and the required `kind`
query param.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import B


def test_archive_buckets(client: TestClient) -> None:
    assert len(client.get(f"{B}/archive", params={"kind": "won"}).json()) == 1
    assert len(client.get(f"{B}/archive", params={"kind": "passed"}).json()) == 14


def test_archive_counts_seeded(client: TestClient) -> None:
    assert client.get(f"{B}/archive/counts").json() == {"won": 1, "passed": 14}


def test_archive_kind_required(client: TestClient) -> None:
    assert client.get(f"{B}/archive").status_code == 422
