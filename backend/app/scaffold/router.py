"""Aggregate router for all scaffold resource routers.

``scaffold_router`` is included in ``app.api.main`` so every scaffold route
inherits the ``/api/v1`` prefix (``app.main`` mounts ``api_router`` there).

Phase-2 agents: import your resource router and add one ``include_router``
line below. Keep this file a pure aggregator -- no route logic here.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.scaffold.routes import (
    agents,
    coach,
    jobs,
    match,
    periphery,
    resume_lifecycle,
    resumes,
    searches,
    shortlist,
)

scaffold_router = APIRouter()
scaffold_router.include_router(searches.router)
scaffold_router.include_router(periphery.user_router)
scaffold_router.include_router(periphery.notifications_router)
scaffold_router.include_router(periphery.settings_router)
scaffold_router.include_router(periphery.account_router)
# resume_lifecycle MUST be included before resumes: its static paths
# (/resumes/uploads, /resumes/templates, /resumes/exports) would otherwise be
# shadowed by resumes' dynamic GET /resumes/{id} (Starlette matches route
# order, not specificity, and would try to parse "uploads" etc. as a UUID).
scaffold_router.include_router(resume_lifecycle.router)
scaffold_router.include_router(resumes.router)
scaffold_router.include_router(shortlist.router)
scaffold_router.include_router(jobs.router)
scaffold_router.include_router(match.router)
scaffold_router.include_router(agents.router)
scaffold_router.include_router(coach.router)
