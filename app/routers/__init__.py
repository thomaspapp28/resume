"""API route handlers."""

from fastapi import APIRouter

from app.routers import analyze as analyze_router
from app.routers import generate as generate_router
from app.routers import health as health_router
from app.routers import options as options_router
from app.routers import profile as profile_router

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router.router)
api_router.include_router(options_router.router)
api_router.include_router(profile_router.router)
api_router.include_router(analyze_router.router)
api_router.include_router(generate_router.router)

__all__ = ["api_router"]
