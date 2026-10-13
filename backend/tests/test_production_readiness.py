"""Automated test suite validating production readiness, health probes, CORS, and persistent job recovery."""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings
from backend.services.job_manager import JobManager, JobRecord


@pytest.fixture
def client():
    """Test client for FastAPI app with lifespan context."""
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint_status(client):
    """Verify root endpoint returns service info and healthy status."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["project"] == "Drishti AI Video Monitoring"
    assert data["status"] == "running"
    assert "/api/health" in data["health_url"]


def test_liveness_probe(client):
    """Verify /api/health/live returns 200 OK with status ok."""
    res = client.get("/api/health/live")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_readiness_probe(client):
    """Verify /api/health/ready confirms storage and model readiness."""
    res = client.get("/api/health/ready")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["storage_ready"] is True
    assert data["model_ready"] is True


def test_model_status_probe(client):
    """Verify /api/health/model returns active model state without running full inference."""
    res = client.get("/api/health/model")
    assert res.status_code == 200
    data = res.json()
    assert data["is_loaded"] is True
    assert data["model_id"] == "RT-DETRv2-R18-SIH"
    assert data["is_mock"] is False


def test_health_overview_endpoint(client):
    """Verify legacy /api/health backward compatibility."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["model_initialized"] is True
    assert data["active_model_id"] == "RT-DETRv2-R18-SIH"


def test_persistent_job_storage_across_simulated_restart(tmp_path):
    """Verify that completed jobs and their metrics survive service restarts via disk persistence."""
    # Phase 1: Initialize first job manager instance
    jm1 = JobManager(storage_dir=tmp_path)
    job = jm1.create_job(filename="cctv_test.mp4", video_path="/tmp/fake_in.mp4")
    job_id = job.job_id

    # Verify JSON record was written immediately on creation
    json_path = tmp_path / f"{job_id}.json"
    assert json_path.exists(), "Job JSON file should be created immediately on create_job"

    # Complete the job with metrics
    jm1.mark_started(job_id, total_frames=100)
    jm1.mark_completed(
        job_id=job_id,
        output_video_path="/tmp/fake_out.mp4",
        detections=[{"class_id": 0, "class_name": "student", "bbox": [10, 20, 30, 40], "confidence": 0.9, "frame_index": 0, "timestamp_seconds": 0.0}],
        class_counts={"student": 1},
        duration_seconds=5.2,
        model_id="RT-DETRv2-R18-SIH",
        is_mock=False,
        unique_students=1,
        unique_computers=0,
    )

    # Phase 2: Simulate service restart with new JobManager instance pointing to same storage
    jm2 = JobManager(storage_dir=tmp_path)
    # Before initialize, memory is empty
    assert len(jm2._jobs) == 0

    # Initialize from disk
    jm2.initialize()

    recovered_job = jm2.get_job(job_id)
    assert recovered_job is not None, "Job record should be recovered from disk after restart"
    assert recovered_job.status == "completed"
    assert recovered_job.unique_students == 1
    assert recovered_job.unique_computers == 0
    assert recovered_job.output_video_path == "/tmp/fake_out.mp4"
    assert len(recovered_job.detections) == 1


def test_interrupted_job_recovery_on_startup(tmp_path):
    """Verify that any job that was in 'processing' or 'queued' when service stopped is safely failed on restart."""
    # Create an interrupted job file simulating sudden power cut or SIGKILL
    stale_job = {
        "job_id": "job-interrupted-123",
        "filename": "abandoned.mp4",
        "video_path": "/tmp/abandoned.mp4",
        "status": "processing",
        "progress_percent": 45.0,
        "processed_frames": 45,
        "total_frames": 100,
        "created_at": "2026-10-13T00:00:00Z",
    }
    with open(tmp_path / "job-interrupted-123.json", "w", encoding="utf-8") as f:
        json.dump(stale_job, f)

    jm = JobManager(storage_dir=tmp_path)
    jm.initialize()

    job = jm.get_job("job-interrupted-123")
    assert job is not None
    assert job.status == "failed"
    assert "interrupted" in job.error.lower()


def test_onnx_deployment_starts_without_edge_module(monkeypatch):
    """Regression test: verify ONNX runtime adapter imports and loads without requiring edge package."""
    import sys
    from backend.adapters import get_model_adapter

    # Block 'edge' and its submodules from being imported
    for mod in list(sys.modules.keys()):
        if mod == "edge" or mod.startswith("edge."):
            monkeypatch.delitem(sys.modules, mod, raising=False)
    monkeypatch.setitem(sys.modules, "edge", None)

    # get_model_adapter("sih") must succeed without attempting to import edge
    adapter = get_model_adapter("sih")
    adapter.load_model()
    assert adapter.is_loaded is True
    assert adapter.model_id == "RT-DETRv2-R18-SIH"
    assert adapter.model_mode == "sih"


def test_rtdetr_adapter_gracefully_handles_missing_edge(monkeypatch):
    """Verify PyTorch adapter handles missing edge package with informative diagnostic error."""
    import sys
    from backend.adapters.rtdetr_adapter import PyTorchRTDETRAdapter

    # Block 'edge' module
    for mod in list(sys.modules.keys()):
        if mod == "edge" or mod.startswith("edge."):
            monkeypatch.delitem(sys.modules, mod, raising=False)
    monkeypatch.setitem(sys.modules, "edge", None)

    adapter = PyTorchRTDETRAdapter()
    assert adapter.model_mode == "pytorch"

    # Attempting to load_model without edge must raise RuntimeError explaining requirement
    with pytest.raises(RuntimeError) as exc_info:
        adapter.load_model()
    assert "edge" in str(exc_info.value).lower()
    assert "requirements-edge.txt" in str(exc_info.value).lower()

