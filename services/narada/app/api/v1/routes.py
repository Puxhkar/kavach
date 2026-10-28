from fastapi import APIRouter

from app.api.v1.endpoints import agents, guard, runs

v1_router = APIRouter()
v1_router.include_router(agents.router)
v1_router.include_router(runs.router)
v1_router.include_router(guard.router)
