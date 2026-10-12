"""Configuration settings for the AI Video Monitoring Backend."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment or defaults."""
    PROJECT_NAME: str = "SIH26190 AI Video Monitoring MVP"
    VERSION: str = "1.0.0"

    # Storage paths
    DATA_DIR: Path = PROJECT_ROOT / "data"
    UPLOAD_DIR: Path = PROJECT_ROOT / "data" / "uploads"
    OUTPUT_DIR: Path = PROJECT_ROOT / "data" / "outputs"

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
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
