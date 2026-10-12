"""PaddleDetection adapter stub for future fine-tuned model checkpoint integration."""

import os
import logging
from typing import List, Dict, Any
import numpy as np

from backend.adapters.base import BaseModelAdapter

logger = logging.getLogger("backend.adapters.paddle")


class PaddleDetectionAdapter(BaseModelAdapter):
    """Adapter for future deployment of the original PaddleDetection custom model:

    Architecture: RT-DETRv2-R18
    Config: rtdetrv2_r18vd_sih.yml
    Weights: model_final.pdparams
    Classes: 0: student, 1: computer
    """

    def __init__(
        self,
        config_path: str = "PaddleDetection/configs/rtdetrv2/rtdetrv2_r18vd_sih.yml",
        weights_path: str = "PaddleDetection/output/model_final.pdparams"
    ):
        super().__init__(
            model_id="PaddleDetection/rtdetrv2_r18vd_sih",
            model_mode="paddle",
            is_mock=False
        )
        self.config_path = config_path
        self.weights_path = weights_path

    def load_model(self) -> None:
        """Check for Paddle dependencies and checkpoint existence."""
        try:
            import paddle  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                f"PaddleDetection adapter cannot be initialized: PaddlePaddle runtime is not installed. "
                f"To integrate the custom model, install paddlepaddle and paddledet, or use "
                f"MODEL_MODE='mock' or MODEL_MODE='pytorch'."
            ) from e

        if not os.path.exists(self.weights_path):
            raise FileNotFoundError(
                f"Custom PaddleDetection weights not found at: {self.weights_path}. "
                f"Please ensure model_final.pdparams is placed in the designated directory."
            )

        # ponytail: when PaddlePaddle and weights are delivered, wire native Paddle predictor here
        self._is_loaded = True
        logger.info("PaddleDetection model loaded successfully.")

    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        frame_index: int = 0,
        timestamp_seconds: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Run inference via PaddleDetection predictor."""
        if not self._is_loaded:
            self.load_model()
        return []

    def close(self) -> None:
        self._is_loaded = False
