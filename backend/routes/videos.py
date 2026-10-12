"""Video upload and validation endpoints."""

import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from backend.config import settings
from backend.schemas import VideoUploadResponse
from backend.services.job_manager import job_manager

router = APIRouter(prefix="/api/videos", tags=["Videos"])


@router.post("", response_model=VideoUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(video: UploadFile = File(...)) -> VideoUploadResponse:
    """Accept and store uploaded video file for processing."""
    if not video.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename."
        )

    # Validate file extension
    ext = Path(video.filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported video format '{ext}'. Supported formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    # Sanitize filename
    safe_filename = Path(video.filename).name
    # Generate temporary unique path before job creation
    temp_target = settings.UPLOAD_DIR / f"temp_{os.urandom(6).hex()}_{safe_filename}"

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    total_bytes = 0

    try:
        with open(temp_target, "wb") as f:
            while chunk := await video.read(1024 * 1024):  # 1MB buffer
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB."
                    )
                f.write(chunk)
    except Exception:
        if temp_target.exists():
            temp_target.unlink()
        raise

    if total_bytes == 0:
        if temp_target.exists():
            temp_target.unlink()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    # Register job and rename file with job_id prefix
    job = job_manager.create_job(filename=safe_filename, video_path=str(temp_target))
    final_target = settings.UPLOAD_DIR / f"{job.job_id}_{safe_filename}"
    temp_target.rename(final_target)
    job.video_path = str(final_target)

    return VideoUploadResponse(
        job_id=job.job_id,
        filename=safe_filename,
        file_size_bytes=total_bytes,
        status=job.status,
        message="Video uploaded successfully. Ready for analysis."
    )
