"""Health check endpoints for API liveness, readiness, and model status."""

import os
from fastapi import APIRouter, Response, status
from backend.config import settings
from backend.schemas import (
    HealthResponse,
    LivenessResponse,
    ReadinessResponse,
    ModelStatusResponse,
)
from backend.adapters import get_model_adapter

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Check backend operational health and model readiness."""
    adapter = get_model_adapter()
    is_ready = adapter.is_loaded
    return HealthResponse(
        status="healthy" if is_ready else "degraded",
        version=settings.VERSION,
        model_initialized=is_ready,
        model_mode=adapter.model_mode,
        active_model_id=adapter.model_id,
        is_mock=adapter.is_mock
    )


@router.get("/live", response_model=LivenessResponse)
def get_liveness() -> LivenessResponse:
    """Liveness probe: verifies that the server process is responsive."""
    return LivenessResponse(status="ok")


@router.get("/ready", response_model=ReadinessResponse)
def get_readiness(response: Response) -> ReadinessResponse:
    """Readiness probe: verifies essential dependencies (storage and model)."""
    adapter = get_model_adapter()
    model_ready = bool(adapter and adapter.is_loaded)

    # Verify storage directories are writable
    storage_ready = False
    try:
        settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
        settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        settings.JOBS_DIR.mkdir(parents=True, exist_ok=True)

        test_file = settings.JOBS_DIR / ".probe_check"
        test_file.touch()
        test_file.unlink(missing_ok=True)
        storage_ready = True
    except Exception:
        storage_ready = False

    is_ready = model_ready and storage_ready
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="not_ready",
            storage_ready=storage_ready,
            model_ready=model_ready,
        )

    return ReadinessResponse(
        status="ready",
        storage_ready=storage_ready,
        model_ready=model_ready,
    )


@router.get("/model", response_model=ModelStatusResponse)
def get_model_status(response: Response) -> ModelStatusResponse:
    """Model status probe: reports inference engine status without executing heavy inference."""
    adapter = get_model_adapter()
    if not adapter or not adapter.is_loaded:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ModelStatusResponse(
        model_id=adapter.model_id if adapter else "unloaded",
        is_loaded=bool(adapter and adapter.is_loaded),
        model_mode=adapter.model_mode if adapter else "unknown",
        is_mock=bool(adapter and adapter.is_mock),
    )
