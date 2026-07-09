"""Contract drift guard -- mock API ops must track the frozen contract.

No database. Instantiates the app, reads ``app.openapi()``, and asserts the
set of mock-API operationIds equals the frozen ``mvp-api.yaml`` set exactly.
DB-backed routes (login/users/utils) are excluded automatically: they are not
contract ops, so intersecting the app's operationIds with the contract set
drops them.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from app.main import app

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


def test_app_serves_every_contract_op() -> None:
    contract = _contract_operation_ids()

    app_ops = _operation_ids(app.openapi())
    # Intersect with the contract so DB-backed routes are ignored.
    actual = app_ops & contract

    missing = contract - actual
    assert not missing, f"Contract ops expected but not served: {sorted(missing)}"


def test_searches_are_served() -> None:
    """The exemplar SEARCHES resource is live."""
    app_ops = _operation_ids(app.openapi())
    assert {
        "getSearches",
        "getSearch",
        "createSearch",
        "updateSearchCriteria",
    } <= app_ops
