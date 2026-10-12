"""Abstract Base Model Adapter interface isolating inference logic from API routes."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
import numpy as np


class BaseModelAdapter(ABC):
    """Abstract interface for object detection model adapters."""

    def __init__(self, model_id: str, model_mode: str, is_mock: bool = False):
        self.model_id = model_id
        self.model_mode = model_mode
        self.is_mock = is_mock
        self._is_loaded = False

    @abstractmethod
    def load_model(self) -> None:
        """Initialize and warm up model weights."""
        pass

    @abstractmethod
    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        frame_index: int = 0,
        timestamp_seconds: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Run inference on a single BGR video frame.

        Returns list of detection dicts:
        [{
            "class_id": int,
            "class_name": str,
            "confidence": float,
            "bbox": [x1, y1, x2, y2],
            "frame_index": int,
            "timestamp_seconds": float
        }]
        """
        pass

    @abstractmethod
    def close(self) -> None:
        """Release GPU/CPU memory and resources."""
        pass

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded
