from fastapi import APIRouter

from app.api.routes import login, users, utils
from app.scaffold.router import scaffold_router

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)

# Scaffold routes (in-memory MVP backend). Inherits the /api/v1 prefix that
# app.main mounts api_router under. No auth deps on scaffold routes.
api_router.include_router(scaffold_router)
