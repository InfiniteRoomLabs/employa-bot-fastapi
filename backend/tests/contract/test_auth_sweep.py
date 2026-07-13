"""401 sweep (AC-03, spec PIN-3) -- DB-free, real auth dependency.

The route universe is derived PROGRAMMATICALLY from ``app.routes`` (never a
hand-maintained list, per Codex D1-3), minus a small named exempt set that
must work unauthenticated. Every other route, hit without a token, must
return the contract 401 envelope -- and every envelope body must be
byte-identical modulo ``path``, which is what "single normalized code path"
looks like from the wire.

The 401 sweep itself stays DB-free because the missing-token path in
``deps.get_current_user`` raises before any database access. The
exempt-route check is the one exception: password-recovery/reset-password
are DB-backed, so THAT test needs the database up (QA panel note).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app

# Routes that MUST work without a token (the full list, reviewed at S3).
EXEMPT: set[tuple[str, str]] = {
    ("/api/v1/login/access-token", "POST"),
    ("/api/v1/password-recovery/{email}", "POST"),
    ("/api/v1/reset-password/", "POST"),
    ("/api/v1/users/signup", "POST"),
    ("/api/v1/utils/health-check/", "GET"),
}


def _fill_params(path: str) -> str:
    """Substitute path params with plausible values (auth runs before 422s)."""
    out = []
    for segment in path.split("/"):
        if segment.startswith("{") and segment.endswith("}"):
            out.append("probe@example.com" if "email" in segment else str(uuid.uuid4()))
        else:
            out.append(segment)
    return "/".join(out)


def _route_universe() -> list[tuple[str, str]]:
    """Every served (path, METHOD) under /api/v1, from the runtime OpenAPI.

    ``app.openapi()`` is the app's own enumeration of its route table (recent
    FastAPI defers ``include_router`` behind a lazy ``_IncludedRouter``, so
    ``app.routes`` is no longer directly walkable before startup).
    """
    universe = []
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith("/api/v1"):
            continue
        for method in operations:
            if method.upper() in {"HEAD", "OPTIONS", "PARAMETERS"}:
                continue
            universe.append((path, method.upper()))
    return sorted(universe)


def test_route_universe_is_nontrivial() -> None:
    """Guard the sweep itself: the app must expose the full contract surface."""
    assert len(_route_universe()) >= 89 + len(EXEMPT)


def test_every_route_401s_without_a_token_via_one_envelope(
    unauthenticated_client: TestClient,
) -> None:
    swept = 0
    for path, method in _route_universe():
        if (path, method) in EXEMPT:
            continue
        probe_path = _fill_params(path)
        response = unauthenticated_client.request(method, probe_path)
        assert response.status_code == 401, (
            f"{method} {path}: expected 401 without a token, got {response.status_code}"
        )
        # Byte-identical envelope modulo the (request-specific) path.
        assert response.json() == {
            "kind": "unauthorized",
            "path": probe_path,
            "message": "Could not validate credentials",
        }, f"{method} {path}: non-uniform 401 body {response.json()}"
        swept += 1

    assert swept, "sweep matched no routes"


def test_exempt_routes_do_not_401_without_a_token(
    unauthenticated_client: TestClient,
) -> None:
    """The exempt list stays honest: none of it demands a bearer token."""
    universe = set(_route_universe())
    for path, method in EXEMPT:
        assert (path, method) in universe, f"exempt route {method} {path} vanished"
        response = unauthenticated_client.request(method, _fill_params(path))
        assert response.status_code != 401, (
            f"{method} {path} is exempt but returned 401"
        )
