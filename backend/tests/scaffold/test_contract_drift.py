"""Contract drift guard -- scaffolded ops must track the frozen contract.

No database. Instantiates the app, reads ``app.openapi()``, and asserts the
set of scaffolded operationIds equals the frozen ``mvp-api.yaml`` set MINUS
``NOT_YET_SCAFFOLDED``. Template-native routes (login/users/items/utils) are
excluded automatically: they are not contract ops, so intersecting the app's
operationIds with the contract set drops them.

As phase-2 agents land routes and shrink ``NOT_YET_SCAFFOLDED`` (in
``tests/scaffold/coverage.py``), this test forces the matching routes to exist
with the exact operationId -- and fails on any stale or extra id.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.main import app
from tests.scaffold.coverage import NOT_YET_SCAFFOLDED

REPO_ROOT = Path(__file__).resolve().parents[3]
SPEC_PATH = REPO_ROOT / "mvp-api.yaml"

_HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


def _operation_ids(spec: dict[str, Any]) -> set[str]:
    ids: set[str] = set()
    for path_item in spec.get("paths", {}).values():
        for method, op in path_item.items():
            if method in _HTTP_METHODS and isinstance(op, dict) and "operationId" in op:
                ids.add(op["operationId"])
    return ids


def _contract_operation_ids() -> set[str]:
    spec = yaml.safe_load(SPEC_PATH.read_text())
    return _operation_ids(spec)


def test_contract_has_89_operations() -> None:
    assert len(_contract_operation_ids()) == 89


def test_not_yet_scaffolded_is_subset_of_contract() -> None:
    """The ledger must only name real contract ops (no stale/typo'd ids)."""
    contract = _contract_operation_ids()
    stale = NOT_YET_SCAFFOLDED - contract
    assert not stale, f"NOT_YET_SCAFFOLDED names non-contract ops: {sorted(stale)}"


def test_scaffolded_ops_match_contract_minus_ledger() -> None:
    contract = _contract_operation_ids()
    expected_scaffolded = contract - NOT_YET_SCAFFOLDED

    app_ops = _operation_ids(app.openapi())
    # Intersect with the contract so template-native routes are ignored.
    actual_scaffolded = app_ops & contract

    missing = expected_scaffolded - actual_scaffolded
    extra = actual_scaffolded - expected_scaffolded
    assert not missing, f"Contract ops expected but not scaffolded: {sorted(missing)}"
    assert not extra, (
        "Scaffolded ops not accounted for in coverage ledger "
        f"(remove them from NOT_YET_SCAFFOLDED): {sorted(extra)}"
    )


def test_searches_are_scaffolded() -> None:
    """The exemplar SEARCHES resource is live (stays true as phase 2 grows)."""
    app_ops = _operation_ids(app.openapi())
    assert {
        "getSearches",
        "getSearch",
        "createSearch",
        "updateSearchCriteria",
    } <= app_ops
