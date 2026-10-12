"""FastAPI application entry point for SIH26190 AI Video Monitoring MVP."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.adapters import get_model_adapter
from backend.routes import health_router, videos_router, jobs_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event to initialize model adapter on startup and release on shutdown."""
    logger.info(f"Initializing {settings.PROJECT_NAME} v{settings.VERSION}...")
    logger.info(f"Storage paths: uploads='{settings.UPLOAD_DIR}', outputs='{settings.OUTPUT_DIR}'")
    logger.info(f"Configured MODEL_MODE: '{settings.MODEL_MODE}'")

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
    description="REST API for AI Video Upload, Object Detection Inference, and Results Dashboard.",
    lifespan=lifespan
)

# CORS middleware to allow requests from Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health_router)
app.include_router(videos_router)
app.include_router(jobs_router)


@app.get("/")
def root():
    """Root info endpoint."""
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_url": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
