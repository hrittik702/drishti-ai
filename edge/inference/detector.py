"""RT-DETRv2 detector implementation and reusable inference interface."""

import os
import time
import logging
from typing import List, Dict, Any, Tuple, Optional, Union
import cv2
import numpy as np

from edge.inference.model_loader import ModelLoader

logger = logging.getLogger("edge.inference.detector")

# Schema version for structured inference results
SCHEMA_VERSION = "1.0"
DEFAULT_MODEL_ID = "PekingU/rtdetr_v2_r18vd"



class RTDETRDetector:
    """Reusable detection interface for RT-DETRv2 models."""

    def __init__(
        self,
        model: Any,
        processor: Any,
        device: str = "cpu",
        confidence_threshold: float = 0.40,
        target_classes: Optional[List[str]] = None,
        model_id: str = DEFAULT_MODEL_ID
    ):
        self.model = model
        self.processor = processor
        self.device = device
        self.confidence_threshold = float(confidence_threshold)
        self.model_id = str(model_id)

        # Build class ID to class name mapping strictly from model configuration
        self.id_to_name: Dict[int, str] = {}
        self.target_class_ids: Optional[set] = None

        if hasattr(model, "config") and hasattr(model.config, "id2label"):
            raw_id2label = model.config.id2label
            self.id_to_name = {int(k): str(v) for k, v in raw_id2label.items()}
        else:
            # Fallback default mapping for unconfigured models
            self.id_to_name = {0: "person"}

        # Configure target class filtering against authentic model vocabulary
        if target_classes is not None:
            norm_targets = {c.strip().lower() for c in target_classes}
            vocab_lower = {cid: cname.lower() for cid, cname in self.id_to_name.items()}

            self.target_class_ids = {
                cid for cid, cname_l in vocab_lower.items()
                if cname_l in norm_targets
            }

            # Warn if any requested target classes are absent from model vocabulary
            available_classes = set(vocab_lower.values())
            missing_classes = norm_targets - available_classes
            if missing_classes:
                logger.warning(
                    "Requested target class(es) %s not present in model '%s' vocabulary. "
                    "No automatic alias or remapping applied.",
                    sorted(missing_classes), self.model_id
                )

    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        frame_index: Optional[int] = None,
        timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """Perform object detection on a single BGR video frame.

        Args:
            frame_bgr: OpenCV BGR uint8 image array (H, W, 3).
            frame_index: Optional sequence index of the frame.
            timestamp: Optional ISO 8601 capture timestamp.

        Returns:
            Dict[str, Any]: Standardized prediction result dictionary:
                {
                    "schema_version": "1.0",
                    "model_id": str,
                    "frame_index": Optional[int],
                    "timestamp": Optional[str],
                    "inference_latency_ms": float,
                    "detections": [
                        {
                            "class_id": int,
                            "class_name": str,
                            "class": str,  # backward compatibility alias
                            "confidence": float,
                            "bbox": [x1, y1, x2, y2]  # absolute pixel integers
                        }
                    ]
                }
        """
        if self.model is None or self.processor is None:
            raise RuntimeError("Detector has been closed or was not properly initialized.")

        # Handle empty or invalid frames cleanly
        if frame_bgr is None or frame_bgr.size == 0:
            return {
                "schema_version": SCHEMA_VERSION,
                "model_id": self.model_id,
                "frame_index": frame_index,
                "timestamp": timestamp,
                "inference_latency_ms": 0.0,
                "detections": []
            }

        import torch

        height, width = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        # Preprocess frame using model image processor
        inputs = self.processor(images=frame_rgb, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Measure exact forward inference latency
        # ponytail: synchronous PyTorch CPU forward pass; upgrade path to TensorRT/ONNX or async worker in Phase 2
        t_start = time.perf_counter()
        with torch.no_grad():
            outputs = self.model(**inputs)
        t_end = time.perf_counter()
        inference_ms = (t_end - t_start) * 1000.0

        # Post-process detections scaled back to original image dimensions
        target_sizes = torch.tensor([(height, width)], device=self.device)
        results = self.processor.post_process_object_detection(
            outputs,
            target_sizes=target_sizes,
            threshold=self.confidence_threshold
        )[0]

        scores = results["scores"].detach().cpu().numpy()
        labels = results["labels"].detach().cpu().numpy()
        boxes = results["boxes"].detach().cpu().numpy()

        detections: List[Dict[str, Any]] = []

        for score, label_id, box in zip(scores, labels, boxes):
            cid = int(label_id)
            if self.target_class_ids is not None and cid not in self.target_class_ids:
                continue

            cname = self.id_to_name.get(cid, f"class_{cid}")
            x1, y1, x2, y2 = box.tolist()

            # Clamp coordinates to frame boundaries as absolute pixel integers
            x1 = max(0, min(int(round(x1)), width - 1))
            y1 = max(0, min(int(round(y1)), height - 1))
            x2 = max(x1 + 1, min(int(round(x2)), width))
            y2 = max(y1 + 1, min(int(round(y2)), height))

            detections.append({
                "class_id": cid,
                "class_name": cname,
                "class": cname,  # backward compatibility alias
                "confidence": float(round(float(score), 4)),
                "bbox": [x1, y1, x2, y2]
            })

        return {
            "schema_version": SCHEMA_VERSION,
            "model_id": self.model_id,
            "frame_index": frame_index,
            "timestamp": timestamp,
            "inference_latency_ms": float(round(inference_ms, 2)),
            "detections": detections
        }

    def predict_image(
        self,
        image_input: Union[str, np.ndarray],
        frame_index: Optional[int] = None,
        timestamp: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run inference on a single static image path or NumPy BGR array.

        Returns the same structured prediction dictionary format as predict_frame.
        """
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                raise FileNotFoundError(f"Image not found at path: {image_input}")
            img_bgr = cv2.imread(image_input)
            if img_bgr is None:
                raise ValueError(f"Failed to decode image from path: {image_input}")
        elif isinstance(image_input, np.ndarray):
            img_bgr = image_input
        else:
            raise TypeError("image_input must be a file path string or numpy ndarray")

        return self.predict_frame(img_bgr, frame_index=frame_index, timestamp=timestamp)

    def close(self) -> None:
        """Release detector resources."""
        self.model = None
        self.processor = None
        if self.device == "cuda":
            try:
                import torch
                torch.cuda.empty_cache()
            except Exception:
                pass
        logger.info("Detector resources released.")


class PersonDetector(RTDETRDetector):
    """Detects persons in video frames using RT-DETRv2 (backward compatible)."""

    def __init__(
        self,
        model: Any,
        processor: Any,
        device: str = "cpu",
        confidence_threshold: float = 0.40,
        person_label: str = "person",
        model_id: str = DEFAULT_MODEL_ID
    ):
        super().__init__(
            model=model,
            processor=processor,
            device=device,
            confidence_threshold=confidence_threshold,
            target_classes=[person_label],
            model_id=model_id
        )
        self.person_label = person_label.lower()
        self.person_class_ids = self.target_class_ids or {0}

    def detect(self, frame_bgr: np.ndarray) -> Tuple[List[Dict[str, Any]], float]:
        """Backward-compatible detection method returning (detections, latency_ms) tuple."""
        result = self.predict_frame(frame_bgr)
        return result["detections"], result["inference_latency_ms"]


def load_detector(
    config_path_or_model: str = DEFAULT_MODEL_ID,
    checkpoint_path: Optional[str] = None,
    device: str = "cpu",
    confidence_threshold: float = 0.40,
    target_classes: Optional[List[str]] = None,
    model_id: Optional[str] = None
) -> RTDETRDetector:
    """Load detector for downstream backend or script consumption.

    Args:
        config_path_or_model: HuggingFace model ID, local model directory, or config path.
        checkpoint_path: Optional path to weights (for future Paddle or custom checkpoints).
        device: 'cpu' or 'cuda'.
        confidence_threshold: Confidence filtering cutoff [0.0 - 1.0].
        target_classes: Optional list of class names to retain (e.g. ['person', 'laptop']).
        model_id: Optional human-readable model identifier.

    Returns:
        RTDETRDetector instance ready for predict_frame / predict_image calls.
    """
    if device not in ("cpu", "cuda"):
        raise ValueError(f"Invalid device: '{device}'. Expected 'cpu' or 'cuda'.")

    if not (0.0 <= confidence_threshold <= 1.0):
        raise ValueError(
            f"Invalid confidence_threshold: {confidence_threshold}. Expected value between 0.0 and 1.0."
        )

    # ponytail: PaddlePaddle runtime fallback stub for future .pdparams deployment
    target_path = checkpoint_path or config_path_or_model
    if target_path and (target_path.endswith(".pdparams") or target_path.endswith(".yml")):
        try:
            import paddle  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                f"PaddlePaddle checkpoint or config specified ('{target_path}'), "
                f"but PaddlePaddle runtime is not installed. To run Paddle models, install paddlepaddle "
                f"and paddledet. The supported generic PyTorch baseline is '{DEFAULT_MODEL_ID}'."
            ) from e

    resolved_model_id = model_id or config_path_or_model
    model, processor = ModelLoader.load_rtdetr_v2(model_path=config_path_or_model, device=device)
    return RTDETRDetector(
        model=model,
        processor=processor,
        device=device,
        confidence_threshold=confidence_threshold,
        target_classes=target_classes,
        model_id=resolved_model_id
    )


