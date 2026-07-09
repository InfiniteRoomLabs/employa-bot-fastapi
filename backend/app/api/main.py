from fastapi import APIRouter

from app.api.routes import (
    account,
    agents,
    applications,
    archive,
    coach,
    interviews,
    jobs,
    library,
    login,
    match,
    notifications,
    resume_lifecycle,
    resumes,
    searches,
    settings,
    shortlist,
    users,
    utils,
)

api_router = APIRouter()

# DB-backed routes (auth + user management).
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)

# Mock API routes (in-memory MVP backend, frozen mvp-api.yaml contract).
api_router.include_router(searches.router)
api_router.include_router(account.user_router)
api_router.include_router(notifications.router)
api_router.include_router(settings.router)
api_router.include_router(account.account_router)
# resume_lifecycle MUST be included before resumes: its static paths
# (/resumes/uploads, /resumes/templates, /resumes/exports) would otherwise be
# shadowed by resumes' dynamic GET /resumes/{id} (Starlette matches route
# order, not specificity, and would try to parse "uploads" etc. as a UUID).
api_router.include_router(resume_lifecycle.router)
api_router.include_router(resumes.router)
api_router.include_router(shortlist.router)
api_router.include_router(jobs.router)
api_router.include_router(match.router)
api_router.include_router(agents.router)
api_router.include_router(coach.router)
api_router.include_router(library.router)
# applications + its sub-resources. Static/collection routes and the distinct
# ``/applications/{id}/<verb>`` sub-paths do not shadow each other (they differ
# by trailing segment), so registration order among these three is free.
api_router.include_router(applications.router)
api_router.include_router(interviews.router)
api_router.include_router(archive.router)
