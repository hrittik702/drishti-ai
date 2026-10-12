"""Integration tests for SIH26190 AI Video Monitoring MVP Backend API."""

import io
from pathlib import Path
import pytest
import cv2
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings
from backend.services.job_manager import job_manager
from backend.services.video_processor import process_video_job


@pytest.fixture(scope="session")
def sample_video_path(tmp_path_factory) -> Path:
    """Generate a tiny valid MP4 video (5 frames) using real frames if available."""
    temp_dir = tmp_path_factory.mktemp("test_videos")
    video_path = temp_dir / "test_mini.mp4"
    cctv = Path("cctv_v2_annotated.mp4")

    if cctv.exists():
        cap = cv2.VideoCapture(str(cctv))
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(video_path), fourcc, 10.0, (w, h))
        for _ in range(5):
            ret, frame = cap.read()
            if ret and frame is not None:
                writer.write(frame)
        cap.release()
        writer.release()
    else:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(video_path), fourcc, 10.0, (640, 480))
        for idx in range(5):
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            frame[:] = (50 + idx * 20, 100, 150)
            writer.write(frame)
        writer.release()

    assert video_path.exists()
    return video_path


@pytest.fixture
def client():
    """TestClient fixture with app lifespan context."""
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    """GET / should return project info and docs links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert data["health_url"] == "/api/health"


def test_health_endpoint(client):
    """GET /api/health should verify operational readiness and active model."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_initialized"] is True
    assert data["model_mode"] in ("sih", "mock", "pytorch")
    assert data["active_model_id"]


def test_upload_invalid_extension(client):
    """POST /api/videos should reject files with unsupported extensions."""
    files = {"video": ("document.txt", io.BytesIO(b"dummy text"), "text/plain")}
    response = client.post("/api/videos", files=files)
    assert response.status_code == 400
    assert "Unsupported video format" in response.json()["detail"]


def test_upload_empty_file(client):
    """POST /api/videos should reject 0-byte uploads."""
    files = {"video": ("empty.mp4", io.BytesIO(b""), "video/mp4")}
    response = client.post("/api/videos", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_upload_valid_video(client, sample_video_path):
    """POST /api/videos should successfully register and store a video."""
    with open(sample_video_path, "rb") as f:
        files = {"video": ("test_mini.mp4", f, "video/mp4")}
        response = client.post("/api/videos", files=files)

    assert response.status_code == 201
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert data["filename"] == "test_mini.mp4"
    assert data["file_size_bytes"] > 0


def test_job_not_found(client):
    """GET /api/jobs/{invalid_id} should return 404."""
    response = client.get("/api/jobs/job-nonexistent")
    assert response.status_code == 404


def test_end_to_end_job_lifecycle(client, sample_video_path):
    """Test full upload -> analyze -> poll -> results -> video output lifecycle."""
    # 1. Upload video
    with open(sample_video_path, "rb") as f:
        upload_resp = client.post("/api/videos", files={"video": ("lifecycle.mp4", f, "video/mp4")})
    assert upload_resp.status_code == 201
    job_id = upload_resp.json()["job_id"]

    # 2. Results before completion should return 400
    early_results = client.get(f"/api/jobs/{job_id}/results")
    assert early_results.status_code == 400

    # 3. Directly run video processing logic for synchronous determinism
    process_video_job(job_id)

    # 4. Status should now be completed
    status_resp = client.get(f"/api/jobs/{job_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["status"] == "completed"
    assert status_data["progress_percent"] == 100.0
    assert status_data["processed_frames"] == 5

    # 5. Fetch full results
    results_resp = client.get(f"/api/jobs/{job_id}/results")
    assert results_resp.status_code == 200
    results_data = results_resp.json()
    assert results_data["job_id"] == job_id
    assert results_data["status"] == "completed"
    assert results_data["total_frames"] == 5
    assert results_data["total_detections"] > 0
    assert "student" in results_data["class_counts"]
    assert "computer" in results_data["class_counts"]
    assert isinstance(results_data["is_mock"], bool)
    assert results_data["output_video_url"] == f"/api/jobs/{job_id}/output"

    # 6. Retrieve annotated video
    video_resp = client.get(f"/api/jobs/{job_id}/output")
    assert video_resp.status_code == 200
    assert video_resp.headers["content-type"] == "video/mp4"
    assert len(video_resp.content) > 0
