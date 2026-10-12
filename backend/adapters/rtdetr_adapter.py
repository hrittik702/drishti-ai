"""PyTorch RT-DETRv2-S model adapter wrapping edge.inference detector."""

import logging
from typing import List, Dict, Any
import numpy as np

from backend.adapters.base import BaseModelAdapter
from edge.inference.detector import load_detector, RTDETRDetector

logger = logging.getLogger("backend.adapters.rtdetr")


class PyTorchRTDETRAdapter(BaseModelAdapter):
    """Real neural network inference adapter using the locally cached RT-DETRv2-S model."""

    def __init__(
        self,
        model_path: str = "PekingU/rtdetr_v2_r18vd",
        device: str = "cpu",
        confidence_threshold: float = 0.35
    ):
        super().__init__(
            model_id=model_path,
            model_mode="pytorch",
            is_mock=False
        )
        self.model_path = model_path
        self.device = device
        self.confidence_threshold = confidence_threshold
        self._detector: RTDETRDetector = None

    def load_model(self) -> None:
        """Load the PyTorch RT-DETRv2 model onto target device."""
        if self._is_loaded and self._detector is not None:
            return

        logger.info(f"Loading PyTorch RT-DETRv2 model from '{self.model_path}' on device '{self.device}'...")
        self._detector = load_detector(
            config_path_or_model=self.model_path,
            device=self.device,
            confidence_threshold=self.confidence_threshold,
            target_classes=["person", "laptop", "tvmonitor", "chair"]
        )
        self._is_loaded = True
        logger.info("PyTorch RT-DETRv2 model loaded successfully.")

    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        frame_index: int = 0,
        timestamp_seconds: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Run real neural network forward inference on frame."""
        if not self._is_loaded or self._detector is None:
            self.load_model()

        result = self._detector.predict_frame(
            frame_bgr=frame_bgr,
            frame_index=frame_index,
            timestamp=None
        )

        # Standardize detections to include timestamp_seconds
        standardized: List[Dict[str, Any]] = []
        for d in result.get("detections", []):
            standardized.append({
                "class_id": d["class_id"],
                "class_name": d["class_name"],
                "confidence": d["confidence"],
                "bbox": d["bbox"],
                "frame_index": frame_index,
                "timestamp_seconds": float(round(timestamp_seconds, 3))
            })

        return standardized

    def close(self) -> None:
        """Release detector resources."""
        if self._detector is not None:
            self._detector.close()
            self._detector = None
        self._is_loaded = False
        logger.info("PyTorch RT-DETRv2 adapter closed.")
