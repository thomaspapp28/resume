"""API route handlers."""

from fastapi import APIRouter

import app.routers.analyze as analyze_router
import app.routers.answer_questions as answer_questions_router
import app.routers.generate as generate_router
import app.routers.jobs as jobs_router
import app.routers.options as options_router
import app.routers.profile as profile_router
import app.routers.template_preview as template_preview_router

api_router = APIRouter(prefix="/api")
api_router.include_router(options_router.router)
api_router.include_router(profile_router.router)
api_router.include_router(analyze_router.router)
api_router.include_router(generate_router.router)
api_router.include_router(answer_questions_router.router)
api_router.include_router(jobs_router.router)
api_router.include_router(template_preview_router.router)

__all__ = ["api_router"]
