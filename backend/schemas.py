"""Pydantic data schemas for API requests, responses, and inference contracts."""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class Detection(BaseModel):
    """Individual object detection within a video frame."""
    class_id: int = Field(..., description="Integer class index from the active model vocabulary")
    class_name: str = Field(..., description="Human-readable label name (e.g., student, computer, person)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bbox: List[int] = Field(..., min_length=4, max_length=4, description="Absolute pixel bounding box [x1, y1, x2, y2]")
    frame_index: int = Field(..., ge=0, description="Zero-based sequence index of the frame")
    timestamp_seconds: float = Field(..., ge=0.0, description="Timestamp offset within the video in seconds")
    track_id: Optional[int] = Field(None, description="Persistent unique object track ID")
    display_id: Optional[str] = Field(None, description="Human-facing formatted entity ID (e.g., S01, C01)")
    is_interpolated: bool = Field(False, description="True if box was carried forward between sampled frames")


class JobStatusResponse(BaseModel):
    """Response returned when polling job execution status."""
    job_id: str
    filename: str
    status: str = Field(..., description="Job state: queued | processing | completed | failed")
    progress_percent: float = Field(0.0, ge=0.0, le=100.0)
    processed_frames: int = 0
    total_frames: int = 0
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    current_fps: float = 0.0
    live_class_counts: Dict[str, int] = Field(default_factory=dict)
    unique_students: int = 0
    unique_computers: int = 0


class JobResultsResponse(BaseModel):
    """Full prediction summary and detection records for a completed job."""
    schema_version: str = "1.0"
    job_id: str
    filename: str
    status: str
    total_frames: int
    processed_frames: int
    video_duration_seconds: float = 0.0
    total_detections: int
    frames_with_detections: int
    throughput_fps: float
    confidence_threshold: float
    frame_sample_interval: int
    class_counts: Dict[str, int]
    unique_students: int = 0
    unique_computers: int = 0
    student_track_count: int = 0
    computer_track_count: int = 0
    tracking_enabled: bool = True
    tracking_method: str = "ByteTrack"
    frame_detection_instances: int = 0
    tracking_diagnostics: Optional[Dict[str, Any]] = None
    processing_duration_seconds: float
    detections: List[Detection]
    output_video_url: Optional[str] = None
    error: Optional[str] = None
    model_id: str = "RT-DETRv2-R18-SIH"
    is_mock: bool = False


class VideoUploadResponse(BaseModel):
    """Response returned immediately after successful video upload."""
    job_id: str
    filename: str
    file_size_bytes: int
    status: str = "queued"
    message: str = "Video uploaded successfully. Ready for analysis."


class StartAnalysisRequest(BaseModel):
    """Optional analysis parameters configured from user workbench."""
    confidence_threshold: Optional[float] = Field(None, ge=0.05, le=0.95, description="Confidence threshold override")
    frame_sample_interval: Optional[int] = Field(None, ge=1, le=30, description="Frame sample interval override")


class StartAnalysisResponse(BaseModel):
    """Response returned when initiating background video analysis."""
    job_id: str
    status: str
    message: str


class HealthResponse(BaseModel):
    """System and inference health status."""
    status: str = "healthy"
    version: str
    model_initialized: bool
    model_mode: str
    active_model_id: str
    is_mock: bool


class LivenessResponse(BaseModel):
    """Basic liveness probe response."""
    status: str = "ok"


class ReadinessResponse(BaseModel):
    """Dependency and readiness probe response."""
    status: str = "ready"
    storage_ready: bool
    model_ready: bool


class ModelStatusResponse(BaseModel):
    """Inference model state probe response."""
    model_id: str
    is_loaded: bool
    model_mode: str
    is_mock: bool
