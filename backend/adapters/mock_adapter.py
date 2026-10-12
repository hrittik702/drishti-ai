"""Assumed-model mock adapter generating deterministic student and computer detections."""

import math
import logging
from typing import List, Dict, Any
import numpy as np

from backend.adapters.base import BaseModelAdapter

logger = logging.getLogger("backend.adapters.mock")


class MockModelAdapter(BaseModelAdapter):
    """Deterministic assumed-model adapter for SIH26190 MVP demonstration.

    Simulates the intended fine-tuned RT-DETRv2-R18 model:
      Class 0: student
      Class 1: computer

    Provides consistent, reproducible detections with realistic classroom layouts
    without requiring heavy neural weights or GPU hardware.
    """

    def __init__(self):
        super().__init__(
            model_id="assumed-rtdetrv2-sih-mock",
            model_mode="mock",
            is_mock=True
        )

    def load_model(self) -> None:
        """Simulate fast initialization."""
        self._is_loaded = True
        logger.info("MockModelAdapter loaded. Active assumed classes: [0: student, 1: computer]")

    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        frame_index: int = 0,
        timestamp_seconds: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Generate realistic student and computer detections for the given frame."""
        if not self._is_loaded:
            self.load_model()

        if frame_bgr is None or frame_bgr.size == 0:
            return []

        h, w = frame_bgr.shape[:2]

        # Check if frame is pure black / blank; if so, return empty detections
        if np.mean(frame_bgr) < 4.0:
            return []

        detections: List[Dict[str, Any]] = []

        # Deterministic pseudo-randomness based on frame_index
        # We simulate a 2-row classroom grid:
        # Row 1: 3 student workstations
        # Row 2: 3 student workstations
        # Total: 5-6 students and 4-6 computers visible with subtle motion jitter
        w_step = w // 4
        h_row1 = int(h * 0.45)
        h_row2 = int(h * 0.72)

        # 1. Trainee/Student detections (Class 0: student)
        student_slots = [
            (w_step * 1, h_row1, 0.94),
            (w_step * 2, h_row1, 0.91),
            (w_step * 3, h_row1, 0.88),
            (w_step * 1, h_row2, 0.93),
            (w_step * 2, h_row2, 0.89),
            (w_step * 3, h_row2, 0.86),
        ]

        for idx, (base_x, base_y, base_conf) in enumerate(student_slots):
            # Deterministic minor oscillation (e.g. breathing/sitting motion)
            jitter_x = int(math.sin(frame_index * 0.15 + idx) * 3)
            jitter_y = int(math.cos(frame_index * 0.12 + idx) * 2)

            box_w = int(w * 0.12)
            box_h = int(h * 0.32)

            x1 = max(0, min(w - 1, base_x - box_w // 2 + jitter_x))
            y1 = max(0, min(h - 1, base_y - box_h // 2 + jitter_y))
            x2 = max(x1 + 10, min(w, x1 + box_w))
            y2 = max(y1 + 10, min(h, y1 + box_h))

            conf = round(min(0.98, max(0.75, base_conf + math.sin(frame_index * 0.05 + idx) * 0.03)), 4)

            detections.append({
                "class_id": 0,
                "class_name": "student",
                "confidence": float(conf),
                "bbox": [x1, y1, x2, y2],
                "frame_index": frame_index,
                "timestamp_seconds": float(round(timestamp_seconds, 3))
            })

        # 2. Computer / Workstation detections (Class 1: computer)
        computer_slots = [
            (w_step * 1 - int(w * 0.03), h_row1 + int(h * 0.06), 0.92),
            (w_step * 2 - int(w * 0.03), h_row1 + int(h * 0.06), 0.95),
            (w_step * 3 - int(w * 0.03), h_row1 + int(h * 0.06), 0.89),
            (w_step * 1 - int(w * 0.03), h_row2 + int(h * 0.08), 0.90),
            (w_step * 2 - int(w * 0.03), h_row2 + int(h * 0.08), 0.93),
        ]

        for idx, (base_x, base_y, base_conf) in enumerate(computer_slots):
            cbox_w = int(w * 0.09)
            cbox_h = int(h * 0.14)

            x1 = max(0, min(w - 1, base_x - cbox_w // 2))
            y1 = max(0, min(h - 1, base_y - cbox_h // 2))
            x2 = max(x1 + 10, min(w, x1 + cbox_w))
            y2 = max(y1 + 10, min(h, y1 + cbox_h))

            conf = round(min(0.99, max(0.70, base_conf + math.cos(frame_index * 0.08 + idx) * 0.02)), 4)

            detections.append({
                "class_id": 1,
                "class_name": "computer",
                "confidence": float(conf),
                "bbox": [x1, y1, x2, y2],
                "frame_index": frame_index,
                "timestamp_seconds": float(round(timestamp_seconds, 3))
            })

        return detections

    def close(self) -> None:
        """Release mock resources."""
        self._is_loaded = False
        logger.info("MockModelAdapter closed.")
