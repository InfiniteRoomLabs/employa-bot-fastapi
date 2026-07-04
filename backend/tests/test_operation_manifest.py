"""Validate docs/operation-ownership.yaml against the frozen mvp-api.yaml contract.

Pure YAML/parsing only -- no database, no FastAPI app import. Must run standalone:

    uv run --project backend pytest tests/test_operation_manifest.py -q
"""

from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "docs" / "operation-ownership.yaml"
SPEC_PATH = REPO_ROOT / "mvp-api.yaml"

VALID_STATUSES = {"planned", "implemented", "deferred"}
HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


class _DuplicateKeyError(ValueError):
    """Raised when a YAML mapping contains the same key more than once."""


class _StrictLoader(yaml.SafeLoader):
    """A SafeLoader (NOT yaml.Loader/UnsafeLoader) that additionally rejects
    duplicate mapping keys instead of silently letting the last one win
    (PyYAML's default behavior). Only the mapping constructor is overridden;
    every other constructor is inherited unchanged from SafeLoader, so this
    still refuses arbitrary Python object tags (`!!python/object`, etc.) --
    it is exactly as safe as `yaml.safe_load`, just stricter about keys."""


def _construct_mapping_no_duplicates(
    loader: yaml.SafeLoader, node: yaml.MappingNode
) -> dict[Any, Any]:
    mapping: dict[Any, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=True)
        if key in mapping:
            raise _DuplicateKeyError(f"duplicate key {key!r} in {node.start_mark}")
        mapping[key] = loader.construct_object(value_node, deep=True)
    return mapping


_StrictLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct_mapping_no_duplicates
)


def _load_yaml_strict(path: Path) -> Any:
    return yaml.load(path.read_text(encoding="utf-8"), Loader=_StrictLoader)


def _load_manifest_operations() -> dict[str, dict[str, Any]]:
    data = _load_yaml_strict(MANIFEST_PATH)
    assert isinstance(data, dict), f"{MANIFEST_PATH} did not parse to a mapping"
    operations = data.get("operations")
    assert isinstance(operations, dict), (
        f"{MANIFEST_PATH} must have a top-level 'operations' mapping"
    )
    return operations


def _load_spec_operation_ids() -> set[str]:
    spec = _load_yaml_strict(SPEC_PATH)
    assert isinstance(spec, dict), f"{SPEC_PATH} did not parse to a mapping"
    paths = spec.get("paths")
    assert isinstance(paths, dict), f"{SPEC_PATH} has no top-level 'paths' mapping"

    operation_ids: set[str] = set()
    for path_item in paths.values():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            operation_id = operation.get("operationId")
            if operation_id:
                operation_ids.add(operation_id)
    return operation_ids


def test_manifest_and_spec_files_exist() -> None:
    assert MANIFEST_PATH.is_file(), f"missing manifest at {MANIFEST_PATH}"
    assert SPEC_PATH.is_file(), f"missing frozen contract at {SPEC_PATH}"


def test_manifest_has_no_duplicate_operation_ids() -> None:
    # _load_manifest_operations() raises _DuplicateKeyError via the strict
    # loader if the same operationId key appears twice in the YAML source.
    operations = _load_manifest_operations()
    assert len(operations) > 0, "manifest 'operations' mapping is empty"


def test_every_spec_operation_id_appears_in_manifest_exactly_once() -> None:
    operations = _load_manifest_operations()
    spec_operation_ids = _load_spec_operation_ids()

    assert spec_operation_ids, (
        f"no operationIds found in {SPEC_PATH} -- spec parsing is likely broken"
    )

    manifest_operation_ids = set(operations.keys())
    missing_from_manifest = spec_operation_ids - manifest_operation_ids
    assert not missing_from_manifest, (
        f"operationIds present in {SPEC_PATH} but missing from the manifest: "
        f"{sorted(missing_from_manifest)}"
    )


def test_manifest_has_no_orphan_operation_ids() -> None:
    operations = _load_manifest_operations()
    spec_operation_ids = _load_spec_operation_ids()

    manifest_operation_ids = set(operations.keys())
    orphans = manifest_operation_ids - spec_operation_ids
    assert not orphans, (
        f"manifest entries with no matching operation in {SPEC_PATH}: {sorted(orphans)}"
    )


def test_every_entry_has_a_valid_status() -> None:
    operations = _load_manifest_operations()
    invalid = {
        operation_id: entry.get("status")
        for operation_id, entry in operations.items()
        if entry.get("status") not in VALID_STATUSES
    }
    assert not invalid, f"entries with an invalid 'status': {invalid}"


def test_every_deferred_entry_has_a_non_empty_reason() -> None:
    operations = _load_manifest_operations()
    deferred_without_reason = [
        operation_id
        for operation_id, entry in operations.items()
        if entry.get("status") == "deferred"
        and not str(entry.get("reason", "")).strip()
    ]
    assert not deferred_without_reason, (
        f"deferred entries missing a non-empty 'reason': {deferred_without_reason}"
    )


def test_every_entry_has_a_valid_slice_and_ai_flag() -> None:
    operations = _load_manifest_operations()

    bad_slice = {
        operation_id: entry.get("slice")
        for operation_id, entry in operations.items()
        if not isinstance(entry.get("slice"), int)
        or isinstance(entry.get("slice"), bool)
        or entry.get("slice") not in range(1, 7)
    }
    assert not bad_slice, f"entries with a 'slice' that is not an int 1-6: {bad_slice}"

    bad_ai_flag = {
        operation_id: entry.get("ai")
        for operation_id, entry in operations.items()
        if not isinstance(entry.get("ai"), bool)
    }
    assert not bad_ai_flag, f"entries with a non-bool 'ai' flag: {bad_ai_flag}"
