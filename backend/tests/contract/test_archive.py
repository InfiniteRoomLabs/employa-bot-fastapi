"""Behavior tests for the archive resource (ORI-009). No database.

Covers: outcome-bucketed reads, seeded counts, and the required `kind`
query param.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.contract.helpers import B


def test_archive_buckets(store_client: TestClient) -> None:
    assert len(store_client.get(f"{B}/archive", params={"kind": "won"}).json()) == 1
    assert len(store_client.get(f"{B}/archive", params={"kind": "passed"}).json()) == 14


def test_archive_counts_seeded(store_client: TestClient) -> None:
    assert store_client.get(f"{B}/archive/counts").json() == {"won": 1, "passed": 14}


def test_archive_kind_required(store_client: TestClient) -> None:
    assert store_client.get(f"{B}/archive").status_code == 422
