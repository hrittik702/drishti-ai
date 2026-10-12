"""Background video processing service for RT-DETR object detection and visual annotation."""

import subprocess
import time
import logging
from pathlib import Path
from typing import Dict, List, Any
import cv2
import numpy as np

from backend.config import settings
from backend.services.job_manager import job_manager
from backend.adapters import get_model_adapter
from backend.services.tracker import ByteTracker

logger = logging.getLogger("backend.services.video_processor")

# Colors in BGR format:
# Student: Emerald Green #00D6B2 -> RGB(0, 214, 178) -> BGR(178, 214, 0)
# Computer: Vivid Sky Cyan #38BDF8 -> RGB(56, 189, 248) -> BGR(248, 189, 56)
CLASS_COLORS: Dict[str, tuple[int, int, int]] = {
    "student": (178, 214, 0),
    "computer": (248, 189, 56),
    "person": (178, 214, 0),
}
DEFAULT_COLOR: tuple[int, int, int] = (241, 196, 15)  # Amber


def draw_annotations(
    frame: np.ndarray,
    detections: List[Dict[str, Any]],
    model_id: str,
    frame_idx: int,
    total_frames: int,
    live_students: int = 0,
    live_computers: int = 0,
    unique_students: int = 0,
    unique_computers: int = 0,
) -> np.ndarray:
    """Render high-contrast bounding boxes, track badges, and HUD telemetry on frame."""
    output = frame.copy()
    height, width = output.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX

    # 1. Draw detected objects with independent class-scoped display IDs (S01, S02... / C01, C02...)
    for det in detections:
        bbox = det.get("bbox", [0, 0, 0, 0])
        x1, y1, x2, y2 = bbox
        conf = det.get("confidence", 0.0)
        cname = det.get("class_name", "object")
        color = CLASS_COLORS.get(cname.lower(), DEFAULT_COLOR)

        # Bounding box border
        cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)

        # High-contrast label badge with separate ID namespaces
        display_id = det.get("display_id")
        if not display_id:
            tid = det.get("track_id")
            if tid is not None:
                if cname.lower() in ("student", "person"):
                    display_id = f"S{tid:02d}"
                elif cname.lower() == "computer":
                    display_id = f"C{tid:02d}"
                else:
                    display_id = f"#{tid}"

        conf_pct = int(round(conf * 100))
        if display_id:
            label = f"{cname.upper()} {display_id} · {conf_pct}%"
        else:
            label = f"{cname.upper()} · {conf_pct}%"

        (tw, th), _ = cv2.getTextSize(label, font, 0.42, 1)
        badge_x1 = max(0, min(width - tw - 10, x1))
        badge_x2 = min(width, badge_x1 + tw + 10)

        # If box is near top border, place badge inside box to avoid overflow
        if y1 < th + 10:
            badge_y1 = y1
            badge_y2 = min(height, y1 + th + 8)
            text_y = badge_y2 - 4
        else:
            badge_y1 = max(0, y1 - th - 8)
            badge_y2 = y1
            text_y = y1 - 4

        cv2.rectangle(output, (badge_x1, badge_y1), (badge_x2, badge_y2), color, -1)
        text_color = (15, 23, 42) if cname.lower() in ("student", "computer", "person") else (255, 255, 255)
        cv2.putText(output, label, (badge_x1 + 5, text_y), font, 0.42, text_color, 1, cv2.LINE_AA)

    # 2. Semi-transparent telemetry HUD footer
    hud_h = 36
    hud_y = height - hud_h
    overlay = output.copy()
    cv2.rectangle(overlay, (0, hud_y), (width, height), (15, 23, 42), -1)
    cv2.addWeighted(overlay, 0.85, output, 0.15, 0, output)
    cv2.line(output, (0, hud_y), (width, hud_y), (51, 65, 85), 1)

    clean_model_id = model_id.replace("-SIH", "")
    hud_text = (
        f"Frame {frame_idx + 1}/{total_frames} | {clean_model_id} | "
        f"Est. Students: {unique_students} | Est. PCs: {unique_computers}"
    )
    cv2.putText(output, hud_text, (12, height - 12), font, 0.40, (241, 245, 249), 1, cv2.LINE_AA)

    return output


def process_video_job(job_id: str) -> None:
    """Execute complete video inference and visual annotation pipeline for a job."""
    job = job_manager.get_job(job_id)
    if not job:
        logger.error(f"Job {job_id} not found in job store")
        return

    video_path = Path(job.video_path)
    if not video_path.exists():
        job_manager.mark_failed(job_id, f"Video file not found at {video_path}")
        return

    logger.info(f"Starting video processing for job {job_id} ({video_path.name})")
    start_time = time.time()

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        job_manager.mark_failed(job_id, f"Failed to open video file {video_path.name}")
        return

    writer = None
    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            total_frames = 1
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0 or np.isnan(fps):
            fps = 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        job_manager.mark_started(job_id, total_frames=total_frames)

        adapter = get_model_adapter()
        # Set job-specific confidence threshold if adapter supports it
        if hasattr(adapter, "confidence_threshold") and job.confidence_threshold:
            adapter.confidence_threshold = float(job.confidence_threshold)

        if not adapter.is_loaded:
            adapter.load_model()

        temp_output_path = settings.OUTPUT_DIR / f"{job_id}_raw_annotated.mp4"
        final_output_path = settings.OUTPUT_DIR / f"{job_id}_annotated.mp4"

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        all_detections: List[Dict[str, Any]] = []
        frame_detections_history: List[List[Dict[str, Any]]] = []
        class_counts: Dict[str, int] = {}
        processed_frames = 0
        frames_with_detections = 0
        sample_interval = max(1, job.frame_sample_interval or settings.FRAME_SAMPLE_INTERVAL)
        last_frame_detections: List[Dict[str, Any]] = []

        # Initialize ByteTrack multi-object tracker
        tracker = ByteTracker(
            high_thresh=max(0.20, float(job.confidence_threshold or 0.35)),
            low_thresh=0.15,
            match_thresh=0.20,
            max_time_lost=90,
            min_hits=3,
            fps=fps,
            sample_interval=sample_interval,
        )

        # ----------------------------------------------------------------------
        # Pass 1: Neural Inference & Multi-Object Tracking
        # ----------------------------------------------------------------------
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            timestamp_seconds = round(processed_frames / fps, 3)

            # Predict on sample interval or reuse for visualization
            if processed_frames % sample_interval == 0:
                raw_dets = adapter.predict_frame(
                    frame_bgr=frame,
                    frame_index=processed_frames,
                    timestamp_seconds=timestamp_seconds,
                )
                # Assign persistent track IDs and display IDs across frames
                frame_dets = tracker.update(raw_dets, frame_idx=processed_frames)
                last_frame_detections = frame_dets
                # Count real neural inference detections
                for d in frame_dets:
                    all_detections.append({**d, "is_interpolated": False})
                    cname = d.get("class_name", "object").lower()
                    class_counts[cname] = class_counts.get(cname, 0) + 1
            else:
                # Reused for visual video annotation persistence
                frame_dets = [
                    {**d, "frame_index": processed_frames, "timestamp_seconds": timestamp_seconds, "is_interpolated": True}
                    for d in last_frame_detections
                ]

            if len(frame_dets) > 0:
                frames_with_detections += 1

            frame_detections_history.append(frame_dets)

            live_students = sum(1 for d in frame_dets if d.get("class_name", "").lower() in ("student", "person"))
            live_computers = sum(1 for d in frame_dets if d.get("class_name", "").lower() == "computer")
            unique_students, unique_computers = tracker.get_unique_counts()

            processed_frames += 1
            if processed_frames % 5 == 0 or processed_frames == total_frames:
                elapsed = max(0.001, time.time() - start_time)
                current_fps = processed_frames / elapsed
                job_manager.update_progress(
                    job_id=job_id,
                    processed_frames=processed_frames,
                    total_frames=total_frames,
                    live_class_counts={"student": live_students, "computer": live_computers},
                    current_fps=current_fps,
                    unique_students=unique_students,
                    unique_computers=unique_computers,
                )

        cap.release()

        # ----------------------------------------------------------------------
        # Resolve Canonical Display IDs across all tracklets before video rendering
        # ----------------------------------------------------------------------
        final_unique_students, final_unique_computers = tracker.get_unique_counts()
        canonical_map = tracker.build_canonical_display_id_map()

        # Update all frame detection records and full detection log with canonical IDs
        for f_dets in frame_detections_history:
            for d in f_dets:
                tid = d.get("track_id")
                if tid is not None and tid in canonical_map:
                    d["display_id"] = canonical_map[tid]
                elif tid is not None and "display_id" not in d:
                    d["display_id"] = tracker.get_display_id(tid, d.get("class_id", 0), d.get("class_name", "object"))

        for d in all_detections:
            tid = d.get("track_id")
            if tid is not None and tid in canonical_map:
                d["display_id"] = canonical_map[tid]
            elif tid is not None and "display_id" not in d:
                d["display_id"] = tracker.get_display_id(tid, d.get("class_id", 0), d.get("class_name", "object"))

        # ----------------------------------------------------------------------
        # Pass 2: High-Speed Visual Video Annotation with Canonical IDs
        # ----------------------------------------------------------------------
        cap_render = cv2.VideoCapture(str(video_path))
        writer = cv2.VideoWriter(str(temp_output_path), fourcc, fps, (width, height))

        for render_idx, f_dets in enumerate(frame_detections_history):
            ret, frame = cap_render.read()
            if not ret or frame is None:
                break

            live_students = sum(1 for d in f_dets if d.get("class_name", "").lower() in ("student", "person"))
            live_computers = sum(1 for d in f_dets if d.get("class_name", "").lower() == "computer")

            annotated = draw_annotations(
                frame=frame,
                detections=f_dets,
                model_id=adapter.model_id,
                frame_idx=render_idx,
                total_frames=total_frames,
                live_students=live_students,
                live_computers=live_computers,
                unique_students=final_unique_students,
                unique_computers=final_unique_computers,
            )
            writer.write(annotated)

        cap_render.release()
        if writer is not None:
            writer.release()
            writer = None

        # Convert to web-compatible H.264 mp4 using ffmpeg if available
        encoded_output_path = temp_output_path
        try:
            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                str(temp_output_path),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "ultrafast",
                "-movflags",
                "+faststart",
                str(final_output_path),
            ]
            result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
            if result.returncode == 0 and final_output_path.exists() and final_output_path.stat().st_size > 0:
                encoded_output_path = final_output_path
                temp_output_path.unlink(missing_ok=True)
            else:
                encoded_output_path = temp_output_path
        except Exception as e:
            logger.warning(f"ffmpeg conversion fallback to raw mp4v: {e}")
            encoded_output_path = temp_output_path

        duration = max(0.001, time.time() - start_time)
        throughput_fps = processed_frames / duration
        final_unique_students, final_unique_computers = tracker.get_unique_counts()
        diagnostics = tracker.get_diagnostics()
        video_duration_seconds = total_frames / fps if fps > 0 else 0.0

        job_manager.mark_completed(
            job_id=job_id,
            output_video_path=str(encoded_output_path),
            detections=all_detections,
            class_counts=class_counts,
            duration_seconds=duration,
            model_id=adapter.model_id,
            is_mock=adapter.is_mock,
            frames_with_detections=frames_with_detections,
            throughput_fps=throughput_fps,
            unique_students=final_unique_students,
            unique_computers=final_unique_computers,
            video_duration_seconds=video_duration_seconds,
            tracking_enabled=True,
            tracking_method="ByteTrack",
            frame_detection_instances=diagnostics.get("raw_detection_instances", len(all_detections)),
            tracking_diagnostics=diagnostics,
        )
        logger.info(
            f"Job {job_id} completed successfully in {duration:.2f}s "
            f"({throughput_fps:.1f} FPS) with {len(all_detections)} detections"
        )

    except Exception as exc:
        logger.exception(f"Error processing video job {job_id}: {exc}")
        if cap.isOpened():
            cap.release()
        if writer is not None:
            writer.release()
        job_manager.mark_failed(job_id, f"Processing error: {str(exc)}")
