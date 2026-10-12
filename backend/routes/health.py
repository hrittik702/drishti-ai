"""Health check endpoint for API and inference status."""

from fastapi import APIRouter
from backend.config import settings
from backend.schemas import HealthResponse
from backend.adapters import get_model_adapter

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Check backend operational health and model readiness."""
    adapter = get_model_adapter()
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        model_initialized=adapter.is_loaded,
        model_mode=adapter.model_mode,
        active_model_id=adapter.model_id,
        is_mock=adapter.is_mock
    )
