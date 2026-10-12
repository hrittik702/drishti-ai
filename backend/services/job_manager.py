"""In-memory Job State Management Service."""

import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field


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


class JobManager:
    """Thread-safe in-memory store for processing jobs."""

    def __init__(self):
        self._jobs: Dict[str, JobRecord] = {}

    def create_job(
        self,
        filename: str,
        video_path: str,
        confidence_threshold: Optional[float] = None,
        frame_sample_interval: Optional[int] = None,
    ) -> JobRecord:
        """Create and register a new queued job."""
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
        return job

    def get_job(self, job_id: str) -> Optional[JobRecord]:
        """Retrieve job record by ID."""
        return self._jobs.get(job_id)

    def mark_started(self, job_id: str, total_frames: int = 0) -> None:
        """Mark job as actively processing."""
        job = self.get_job(job_id)
        if job:
            job.status = "processing"
            job.started_at = datetime.now(timezone.utc).isoformat()
            job.total_frames = total_frames
            job.progress_percent = 0.0

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
        """Mark job as successfully finished and attach prediction and tracking results."""
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

    def mark_failed(self, job_id: str, error_message: str) -> None:
        """Mark job as failed with diagnostic error details."""
        job = self.get_job(job_id)
        if job:
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc).isoformat()
            job.error = error_message


job_manager = JobManager()
