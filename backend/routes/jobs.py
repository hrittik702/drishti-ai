"""Job orchestration, status polling, and prediction result endpoints."""

from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from fastapi.responses import FileResponse

from backend.schemas import (
    JobStatusResponse,
    JobResultsResponse,
    StartAnalysisRequest,
    StartAnalysisResponse,
    Detection,
)
from backend.services.job_manager import job_manager
from backend.services.video_processor import process_video_job

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@router.post("/{job_id}/analyze", response_model=StartAnalysisResponse)
def start_job_analysis(
    job_id: str,
    background_tasks: BackgroundTasks,
    payload: StartAnalysisRequest = None,
) -> StartAnalysisResponse:
    """Trigger asynchronous background video inference for an uploaded video."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    if job.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job '{job_id}' is already processing."
        )

    if payload:
        if payload.confidence_threshold is not None:
            job.confidence_threshold = payload.confidence_threshold
        if payload.frame_sample_interval is not None:
            job.frame_sample_interval = payload.frame_sample_interval

    # Launch background processing task
    background_tasks.add_task(process_video_job, job_id)

    return StartAnalysisResponse(
        job_id=job_id,
        status="processing",
        message="Background video analysis started."
    )


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str) -> JobStatusResponse:
    """Poll job status and current processing progress."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    return JobStatusResponse(
        job_id=job.job_id,
        filename=job.filename,
        status=job.status,
        progress_percent=job.progress_percent,
        processed_frames=job.processed_frames,
        total_frames=job.total_frames,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        error=job.error,
        current_fps=job.current_fps,
        live_class_counts=job.live_class_counts,
        unique_students=job.unique_students,
        unique_computers=job.unique_computers,
    )


@router.get("/{job_id}/results", response_model=JobResultsResponse)
def get_job_results(job_id: str) -> JobResultsResponse:
    """Fetch complete predictions and summary stats for a finished job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    if job.status not in ("completed", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job '{job_id}' has not completed yet. Current status: '{job.status}'."
        )

    output_video_url = f"/api/jobs/{job_id}/output" if job.output_video_path else None

    # Parse detection dictionaries into Pydantic models
    detections = [Detection(**d) for d in job.detections]

    return JobResultsResponse(
        schema_version="1.0",
        job_id=job.job_id,
        filename=job.filename,
        status=job.status,
        total_frames=job.total_frames,
        processed_frames=job.processed_frames,
        video_duration_seconds=job.video_duration_seconds,
        total_detections=job.total_detections,
        frames_with_detections=job.frames_with_detections,
        throughput_fps=job.throughput_fps,
        confidence_threshold=job.confidence_threshold,
        frame_sample_interval=job.frame_sample_interval,
        class_counts=job.class_counts,
        unique_students=job.unique_students,
        unique_computers=job.unique_computers,
        student_track_count=job.unique_students,
        computer_track_count=job.unique_computers,
        tracking_enabled=job.tracking_enabled,
        tracking_method=job.tracking_method,
        frame_detection_instances=job.frame_detection_instances or job.total_detections,
        tracking_diagnostics=job.tracking_diagnostics,
        processing_duration_seconds=job.processing_duration_seconds,
        detections=detections,
        output_video_url=output_video_url,
        error=job.error,
        model_id=job.model_id,
        is_mock=job.is_mock,
    )


@router.get("/{job_id}/output")
def get_job_output_video(job_id: str):
    """Stream or download the annotated output video."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    if not job.output_video_path or not Path(job.output_video_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotated video for job '{job_id}' does not exist or has not been generated."
        )

    return FileResponse(
        path=job.output_video_path,
        media_type="video/mp4",
        filename=f"{job_id}_annotated.mp4"
    )
