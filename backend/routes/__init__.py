"""API routers for SIH26190 AI Video Monitoring MVP."""

from backend.routes.health import router as health_router
from backend.routes.videos import router as videos_router
from backend.routes.jobs import router as jobs_router

__all__ = ["health_router", "videos_router", "jobs_router"]
