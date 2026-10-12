"""End-to-end integration test validating the full video analysis lifecycle with the real RT-DETR model."""

import time
import subprocess
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.job_manager import job_manager


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_reports_real_sih_model(client):
    """Verify /api/health reports the real RT-DETRv2-R18-SIH model and is_mock=False."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_mode"] == "sih"
    assert data["active_model_id"] == "RT-DETRv2-R18-SIH"
    assert data["is_mock"] is False
    assert data["model_initialized"] is True


def test_end_to_end_real_video_pipeline(client):
    """Execute complete workflow: upload -> analyze -> poll -> results -> output video verification."""
    # Find a valid test video
    test_video_path = Path("test_clip.mp4")
    if not test_video_path.exists():
        test_video_path = Path("cctv_v2_annotated.mp4")
    if not test_video_path.exists():
        pytest.skip("Test video not found")

    # 1. Upload video
    with open(test_video_path, "rb") as f:
        upload_resp = client.post(
            "/api/videos",
            files={"video": ("test_classroom.mp4", f, "video/mp4")}
        )
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    job_id = upload_data["job_id"]
    assert job_id.startswith("job-")
    assert upload_data["status"] == "queued"

    # 2. Trigger real inference with configured parameters
    analyze_resp = client.post(
        f"/api/jobs/{job_id}/analyze",
        json={"confidence_threshold": 0.35, "frame_sample_interval": 5}
    )
    assert analyze_resp.status_code == 200
    assert analyze_resp.json()["status"] == "processing"

    # 3. Poll until completed or timeout
    max_wait = 60
    start = time.time()
    job_completed = False

    while time.time() - start < max_wait:
        poll_resp = client.get(f"/api/jobs/{job_id}")
        assert poll_resp.status_code == 200
        status_data = poll_resp.json()
        if status_data["status"] == "completed":
            job_completed = True
            break
        elif status_data["status"] == "failed":
            pytest.fail(f"Job failed with error: {status_data.get('error')}")
        time.sleep(1.0)

    assert job_completed is True, f"Job did not complete within {max_wait}s"

    # 4. Fetch results
    results_resp = client.get(f"/api/jobs/{job_id}/results")
    assert results_resp.status_code == 200
    results = results_resp.json()

    assert results["job_id"] == job_id
    assert results["status"] == "completed"
    assert results["model_id"] == "RT-DETRv2-R18-SIH"
    assert results["is_mock"] is False
    assert results["total_frames"] > 0
    assert results["processed_frames"] == results["total_frames"]
    assert results["total_detections"] > 0
    assert results["throughput_fps"] > 0.0

    # Ensure detections match trained classes and tracking fields
    assert "student" in results["class_counts"] or "computer" in results["class_counts"]
    assert results["tracking_enabled"] is True
    assert results["tracking_method"] == "ByteTrack"
    assert "unique_students" in results
    assert "unique_computers" in results
    assert results["unique_students"] >= 0
    assert results["unique_computers"] >= 0
    for det in results["detections"][:20]:
        assert det["class_name"] in ("student", "computer")
        assert det["confidence"] >= 0.35

    # 5. Verify output video endpoint
    output_resp = client.get(f"/api/jobs/{job_id}/output")
    assert output_resp.status_code in (200, 206)
    assert len(output_resp.content) > 1000, "Annotated video output is empty"

    # 6. Verify H.264 codec using ffprobe if available
    job = job_manager.get_job(job_id)
    assert job is not None
    output_path = Path(job.output_video_path)
    assert output_path.exists()

    ffprobe_cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=codec_name,pix_fmt",
        "-of", "csv=p=0", str(output_path)
    ]
    probe = subprocess.run(ffprobe_cmd, capture_output=True, text=True)
    if probe.returncode == 0:
        output_info = probe.stdout.strip()
        print(f"Verified output stream: {output_info}")
        assert "h264" in output_info or "mp4v" in output_info
