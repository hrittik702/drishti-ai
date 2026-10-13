"""FastAPI application entry point for Drishti AI Video Monitoring."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.adapters import get_model_adapter
from backend.routes import health_router, videos_router, jobs_router
from backend.services.job_manager import job_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event to initialize model adapter and persistent job manager."""
    logger.info(f"Initializing {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]...")
    logger.info(f"Storage paths: data='{settings.DATA_DIR}', uploads='{settings.UPLOAD_DIR}', outputs='{settings.OUTPUT_DIR}'")
    logger.info(f"Configured MODEL_MODE: '{settings.MODEL_MODE}'")

    # Recover persisted jobs from disk
    try:
        job_manager.initialize()
    except Exception as exc:
        logger.error(f"Failed to initialize job manager: {exc}")

    # Warm up model adapter
    try:
        adapter = get_model_adapter()
        adapter.load_model()
        logger.info(f"Active model loaded: {adapter.model_id} (is_mock={adapter.is_mock})")
    except Exception as exc:
        logger.error(f"Failed to pre-load model adapter: {exc}")

    yield

    logger.info("Shutting down application and releasing model resources...")
    try:
        adapter = get_model_adapter()
        adapter.close()
    except Exception as exc:
        logger.warning(f"Error during adapter cleanup: {exc}")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="REST API for Drishti AI Video Monitoring: Video Upload, RT-DETRv2 Inference, Tracking & Results.",
    lifespan=lifespan
)

# Parse CORS origins
raw_origins = settings.CORS_ORIGINS.strip()
if raw_origins == "*":
    origins = ["*"]
    allow_credentials = False
else:
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health_router)
app.include_router(videos_router)
app.include_router(jobs_router)


@app.get("/")
def root():
    """Root service information endpoint."""
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=False)
