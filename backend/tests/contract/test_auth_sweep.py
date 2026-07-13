"""401 sweep (AC-03, spec PIN-3) -- DB-free, real auth dependency.

The route universe is derived PROGRAMMATICALLY from the runtime route tree
(never a hand-maintained list, per Codex D1-3; never the OpenAPI document,
per Codex D2-2 -- schema-hidden routes are still served), minus a small named
exempt set that must work unauthenticated. Every other route, hit without a token, must
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

from fastapi.routing import APIRoute
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


def _walk_routes(routes: list[object], prefix: str = "") -> list[tuple[str, APIRoute]]:
    """Flatten the RUNTIME route tree (Codex D2-2: the universe must come from
    what is SERVED, not from the OpenAPI document -- an include_in_schema=False
    route is served but invisible to openapi()). Recent FastAPI defers
    include_router behind lazy ``_IncludedRouter`` nodes; recurse through them,
    accumulating prefixes."""
    out: list[tuple[str, APIRoute]] = []
    for route in routes:
        if isinstance(route, APIRoute):
            out.append((prefix + route.path, route))
        elif type(route).__name__ == "_IncludedRouter":
            inner_prefix = getattr(route.include_context, "prefix", "") or ""  # type: ignore[attr-defined]
            out.extend(
                _walk_routes(
                    route.original_router.routes,  # type: ignore[attr-defined]
                    prefix + inner_prefix,
                )
            )
        else:
            # Mounts / sub-apps under /api/v1 would evade the sweep entirely.
            # Judge the SERVED location (prefix + local path -- Codex D2-2
            # re-audit: a Mount nested inside the API router has a local path
            # without the /api/v1 prefix). The one sanctioned plain Route is
            # the OpenAPI document itself.
            served = prefix + str(getattr(route, "path", ""))
            assert (
                not served.startswith("/api/v1") or served == "/api/v1/openapi.json"
            ), (
                f"non-APIRoute {type(route).__name__} served under /api/v1:"
                f" {served} -- extend the sweep before adding mounts"
            )
    return out


def _route_universe() -> list[tuple[str, str]]:
    """Every served (path, METHOD) under /api/v1, from the runtime route tree."""
    universe = []
    for path, route in _walk_routes(list(app.routes)):
        if not path.startswith("/api/v1"):
            continue
        for method in sorted((route.methods or set()) - {"HEAD", "OPTIONS"}):
            universe.append((path, method))
    return sorted(universe)


def test_route_tree_covers_the_openapi_document() -> None:
    """Cross-check: everything OpenAPI advertises is in the swept universe
    (the reverse -- schema-hidden routes -- is exactly what the tree adds)."""
    universe = set(_route_universe())
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith("/api/v1"):
            continue
        for method in operations:
            if method.upper() in {"HEAD", "OPTIONS", "PARAMETERS"}:
                continue
            assert (path, method.upper()) in universe


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
