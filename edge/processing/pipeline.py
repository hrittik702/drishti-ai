"""End-to-end processing pipeline orchestrating capture, inference, and annotation."""

import time
from datetime import datetime, timezone
from typing import Tuple, Optional, Dict, Any, List
import numpy as np

from edge.camera.base import CameraSource
from edge.inference.detector import PersonDetector
from edge.processing.annotator import VisualAnnotator
from edge.config import EdgeConfig


class ProcessingPipeline:
    """Orchestrates video frame capture, RT-DETRv2-S person detection, and HUD annotation."""

    def __init__(
        self,
        camera: CameraSource,
        detector: PersonDetector,
        annotator: Optional[VisualAnnotator] = None,
        config: Optional[EdgeConfig] = None
    ):
        self.camera = camera
        self.detector = detector
        self.annotator = annotator or VisualAnnotator()
        self.config = config or EdgeConfig()

        # Telemetry state
        self._last_time = time.perf_counter()
        self._fps = 0.0
        self._frame_count = 0
        self._alpha = 0.1  # EMA smoothing factor for FPS calculation

    def process_frame(
        self, frame_bgr: np.ndarray, camera_label: Optional[str] = None
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Process a single frame through detector and annotator.
        
        Args:
            frame_bgr: Input BGR image array.
            camera_label: Optional display label for HUD.
            
        Returns:
            Tuple[np.ndarray, Dict[str, Any]]:
                - Annotated output frame with bounding boxes and HUD
                - Structured AI event dictionary ready for backend transmission
        """
        now = time.perf_counter()
        dt = now - self._last_time
        self._last_time = now

        # Update smoothed FPS
        if dt > 0:
            instant_fps = 1.0 / dt
            if self._fps == 0.0:
                self._fps = instant_fps
            else:
                self._fps = (1.0 - self._alpha) * self._fps + self._alpha * instant_fps

        self._frame_count += 1

        # Run RT-DETRv2-S person detection
        detections, inference_ms = self.detector.detect(frame_bgr)

        # Generate camera label for HUD if not supplied
        if camera_label is None:
            if self.config.source == "usb":
                camera_label = f"USB {self.config.camera_index}"
            else:
                camera_label = "VIDEO FILE"

        # Render annotations & HUD
        annotated_frame = self.annotator.annotate(
            frame_bgr=frame_bgr,
            detections=detections,
            fps=self._fps,
            inference_ms=inference_ms,
            camera_info=camera_label,
            model_name="RT-DETRv2-S",
            status="PROCESSING"
        )

        # Build structured event payload
        event_payload = {
            "camera_id": self.config.camera_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "detected_persons": len(detections),
            "detections": detections,
            "fps": float(round(self._fps, 1)),
            "inference_ms": float(round(inference_ms, 1)),
            "frame_number": self._frame_count
        }

        return annotated_frame, event_payload

    def read_and_process(
        self, camera_label: Optional[str] = None
    ) -> Tuple[bool, Optional[np.ndarray], Optional[Dict[str, Any]]]:
        """Capture next frame from camera and process through the pipeline."""
        success, frame = self.camera.read()
        if not success or frame is None:
            return False, None, None

        annotated_frame, event = self.process_frame(frame, camera_label=camera_label)
        return True, annotated_frame, event
