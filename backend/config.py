"""Configuration settings for Drishti AI Video Monitoring Backend."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment or defaults."""
    PROJECT_NAME: str = "Drishti AI Video Monitoring"
    VERSION: str = "1.0.0"

    # Server configuration
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORT", "8000"))
    ENVIRONMENT: str = os.environ.get("ENVIRONMENT", "development")

    # Security & CORS (comma-separated list of allowed origins, or "*")
    CORS_ORIGINS: str = os.environ.get("CORS_ORIGINS", "*")

    # Storage paths (configurable for Railway persistent volume mount e.g. DATA_DIR=/app/data)
    DATA_DIR: Path = Path(os.environ.get("DATA_DIR", str(PROJECT_ROOT / "data")))

    @property
    def UPLOAD_DIR(self) -> Path:
        return self.DATA_DIR / "uploads"

    @property
    def OUTPUT_DIR(self) -> Path:
        return self.DATA_DIR / "outputs"

    @property
    def JOBS_DIR(self) -> Path:
        return self.DATA_DIR / "jobs"

    # Concurrency control: limit simultaneous video inference jobs on single service
    MAX_CONCURRENT_JOBS: int = int(os.environ.get("MAX_CONCURRENT_JOBS", "1"))

    # File upload validation
    MAX_FILE_SIZE_MB: int = 150
    ALLOWED_EXTENSIONS: list[str] = [".mp4", ".avi", ".mov", ".mkv", ".webm"]

    # Model selection: 'sih' (verified RT-DETRv2 ONNX) | 'mock' (simulated) | 'pytorch' | 'paddle'
    MODEL_MODE: str = os.environ.get("MODEL_MODE", "sih").lower()

    # SIH ONNX Model parameters (when MODEL_MODE='sih')
    SIH_ONNX_MODEL_PATH: Path = PROJECT_ROOT / "SIH_Model_Package" / "model" / "model.onnx"

    # PyTorch Model parameters (when MODEL_MODE='pytorch')
    PYTORCH_MODEL_PATH: str = os.environ.get("MODEL_PATH", "PekingU/rtdetr_v2_r18vd")
    CONFIDENCE_THRESHOLD: float = float(os.environ.get("CONFIDENCE_THRESHOLD", 0.35))
    DEVICE: str = os.environ.get("DEVICE", "cpu")

    # Processing optimization (sample every Nth frame; 1 = every frame)
    FRAME_SAMPLE_INTERVAL: int = int(os.environ.get("FRAME_SAMPLE_INTERVAL", 3))

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

# Ensure storage directories exist at import time
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
settings.JOBS_DIR.mkdir(parents=True, exist_ok=True)
