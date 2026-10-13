"""Persistent Job State Management Service with JSON storage and restart resilience."""

import json
import logging
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, List, Any

from backend.config import settings

logger = logging.getLogger("backend.services.job_manager")


@dataclass
class JobRecord:
    """Internal record tracking execution state and results of a video analysis job."""
    job_id: str
    filename: str
    video_path: str
    output_video_path: Optional[str] = None
    status: str = "queued"  # "queued" | "processing" | "completed" | "failed"
    progress_percent: float = 0.0
    processed_frames: int = 0
    total_frames: int = 0
    total_detections: int = 0
    class_counts: Dict[str, int] = field(default_factory=dict)
    live_class_counts: Dict[str, int] = field(default_factory=dict)
    current_fps: float = 0.0
    throughput_fps: float = 0.0
    frames_with_detections: int = 0
    confidence_threshold: float = 0.35
    frame_sample_interval: int = 3
    processing_duration_seconds: float = 0.0
    video_duration_seconds: float = 0.0
    unique_students: int = 0
    unique_computers: int = 0
    tracking_enabled: bool = True
    tracking_method: str = "ByteTrack"
    frame_detection_instances: int = 0
    tracking_diagnostics: Optional[Dict[str, Any]] = None
    detections: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    model_id: str = "unknown"
    is_mock: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert record to dictionary for JSON persistence."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "JobRecord":
        """Instantiate record from loaded JSON data."""
        valid_keys = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered)


class JobManager:
    """Thread-safe file-backed persistent store for video processing jobs."""

    def __init__(self, storage_dir: Optional[Path] = None):
        self._jobs: Dict[str, JobRecord] = {}
        self._last_saved_time: Dict[str, float] = {}
        self.storage_dir = storage_dir or settings.JOBS_DIR
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def initialize(self) -> None:
        """Load persisted jobs from storage directory and recover interrupted jobs."""
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        loaded_count = 0
        interrupted_count = 0

        for path in self.storage_dir.glob("*.json"):
            if path.name.endswith(".tmp"):
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                job = JobRecord.from_dict(data)

                # Recover interrupted jobs that were active when service restarted
                if job.status in ("processing", "queued"):
                    job.status = "failed"
                    job.completed_at = datetime.now(timezone.utc).isoformat()
                    job.error = "Job interrupted by service restart. Please re-run analysis."
                    self._persist_job(job)
                    interrupted_count += 1

                self._jobs[job.job_id] = job
                loaded_count += 1
            except Exception as e:
                logger.warning(f"Failed to load job from {path.name}: {e}")

        logger.info(f"Loaded {loaded_count} persisted jobs from {self.storage_dir} ({interrupted_count} interrupted).")

    def _persist_job(self, job: JobRecord) -> None:
        """Atomically persist job state to JSON file."""
        try:
            self.storage_dir.mkdir(parents=True, exist_ok=True)
            target = self.storage_dir / f"{job.job_id}.json"
            temp_target = self.storage_dir / f"{job.job_id}.json.tmp"

            with open(temp_target, "w", encoding="utf-8") as f:
                json.dump(job.to_dict(), f, indent=2)

            temp_target.replace(target)
            self._last_saved_time[job.job_id] = time.time()
        except Exception as e:
            logger.error(f"Failed to persist job {job.job_id}: {e}")

    def create_job(
        self,
        filename: str,
        video_path: str,
        confidence_threshold: Optional[float] = None,
        frame_sample_interval: Optional[int] = None,
    ) -> JobRecord:
        """Create and register a new queued job, persisting initial state to disk."""
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        job = JobRecord(
            job_id=job_id,
            filename=filename,
            video_path=video_path,
            status="queued",
            confidence_threshold=confidence_threshold if confidence_threshold is not None else 0.35,
            frame_sample_interval=frame_sample_interval if frame_sample_interval is not None else 3,
        )
        self._jobs[job_id] = job
        self._persist_job(job)
        return job

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        """Retrieve job record by ID from memory, falling back to disk if not yet loaded."""
        if job_id in self._jobs:
            return self._jobs[job_id]

        # Disk fallback
        job_path = self.storage_dir / f"{job_id}.json"
        if job_path.exists():
            try:
                with open(job_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                job = JobRecord.from_dict(data)
                self._jobs[job_id] = job
                return job
            except Exception as e:
                logger.error(f"Failed to read persisted job {job_id}: {e}")

        return None

    def mark_started(self, job_id: str, total_frames: int = 0) -> None:
        """Mark job as actively processing and persist state."""
        job = self.get_job(job_id)
        if job:
            job.status = "processing"
            job.started_at = datetime.now(timezone.utc).isoformat()
            job.total_frames = total_frames
            job.progress_percent = 0.0
            self._persist_job(job)

    def update_progress(
        self,
        job_id: str,
        processed_frames: int,
        total_frames: int,
        live_class_counts: Optional[Dict[str, int]] = None,
        current_fps: float = 0.0,
        unique_students: int = 0,
        unique_computers: int = 0,
    ) -> None:
        """Update job frame progress counter, percent, live telemetry, and unique track counts."""
        job = self.get_job(job_id)
        if job:
            job.processed_frames = processed_frames
            job.total_frames = total_frames
            if live_class_counts is not None:
                job.live_class_counts = live_class_counts
            job.current_fps = round(current_fps, 1)
            job.unique_students = unique_students
            job.unique_computers = unique_computers
            if total_frames > 0:
                job.progress_percent = round((processed_frames / total_frames) * 100.0, 1)

            # Throttle disk persistence during frame loops to at most once every 2 seconds
            now = time.time()
            if now - self._last_saved_time.get(job_id, 0.0) >= 2.0:
                self._persist_job(job)

    def mark_completed(
        self,
        job_id: str,
        output_video_path: str,
        detections: List[Dict[str, Any]],
        class_counts: Dict[str, int],
        duration_seconds: float,
        model_id: str,
        is_mock: bool,
        frames_with_detections: int = 0,
        throughput_fps: float = 0.0,
        unique_students: int = 0,
        unique_computers: int = 0,
        video_duration_seconds: float = 0.0,
        tracking_enabled: bool = True,
        tracking_method: str = "ByteTrack",
        frame_detection_instances: int = 0,
        tracking_diagnostics: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Mark job as successfully finished and persist complete results to disk."""
        job = self.get_job(job_id)
        if job:
            job.status = "completed"
            job.completed_at = datetime.now(timezone.utc).isoformat()
            job.progress_percent = 100.0
            job.output_video_path = output_video_path
            job.detections = detections
            job.total_detections = len(detections)
            job.class_counts = class_counts
            job.processing_duration_seconds = round(duration_seconds, 2)
            job.model_id = model_id
            job.is_mock = is_mock
            job.frames_with_detections = frames_with_detections
            job.throughput_fps = round(throughput_fps, 1)
            job.unique_students = unique_students
            job.unique_computers = unique_computers
            job.video_duration_seconds = round(video_duration_seconds, 2)
            job.tracking_enabled = tracking_enabled
            job.tracking_method = tracking_method
            job.frame_detection_instances = frame_detection_instances
            job.tracking_diagnostics = tracking_diagnostics
            self._persist_job(job)

    def mark_failed(self, job_id: str, error_message: str) -> None:
        """Mark job as failed with diagnostic error details and persist state."""
        job = self.get_job(job_id)
        if job:
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc).isoformat()
            job.error = error_message
            self._persist_job(job)


job_manager = JobManager()
