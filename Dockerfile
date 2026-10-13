# Multi-platform production container for Drishti AI Backend & Inference
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    MODEL_MODE=sih \
    DATA_DIR=/app/data

# Install essential system dependencies:
# - ffmpeg: Universal H.264 video transcoding for web browser playback
# - libgl1 & libglib2.0-0: OpenCV dependencies for video decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python backend dependencies first for layer caching
COPY requirements-backend.txt .
RUN pip install --no-cache-dir -r requirements-backend.txt

# Copy backend source code and RT-DETRv2 model package
COPY backend/ ./backend/
COPY SIH_Model_Package/ ./SIH_Model_Package/

# Initialize runtime persistent data directories
RUN mkdir -p /app/data/uploads /app/data/outputs /app/data/jobs

EXPOSE 8000

# Docker native healthcheck using readiness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health/ready || exit 1

# Start Uvicorn ASGI server reading dynamically assigned PORT from Railway
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
