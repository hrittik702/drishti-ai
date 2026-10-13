# Multi-platform production container for Drishti AI Backend & Inference
FROM python:3.12-slim-bookworm

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0 \
    MODEL_MODE=sih \
    DATA_DIR=/app/data \
    PYTHONPATH=/app

# Install essential system dependencies:
# - ffmpeg: Universal H.264 video transcoding for web browser playback
# - libgl1 & libglib2.0-0: OpenCV dependencies for video decoding
RUN (sed -i 's|http://|https://|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || sed -i 's|http://|https://|g' /etc/apt/sources.list 2>/dev/null) \
    && apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python backend dependencies first for layer caching
COPY requirements-backend.txt .
RUN pip install --no-cache-dir --default-timeout=100 numpy
RUN pip install --no-cache-dir --default-timeout=100 onnxruntime
RUN pip install --no-cache-dir --default-timeout=100 opencv-python-headless
RUN pip install --default-timeout=100 --retries=5 -r requirements-backend.txt

# Copy backend source code, edge module, and RT-DETRv2 model package
COPY backend/ ./backend/
COPY edge/ ./edge/
COPY SIH_Model_Package/ ./SIH_Model_Package/

# Initialize runtime persistent data directories
RUN mkdir -p /app/data/uploads /app/data/outputs /app/data/jobs

EXPOSE 8000

# Docker native healthcheck using readiness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health/ready || exit 1

# Start Uvicorn ASGI server reading dynamically assigned PORT from Railway
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
