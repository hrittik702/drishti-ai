"""Production ONNX Runtime adapter executing the verified RT-DETRv2-R18 model."""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import cv2
import numpy as np

from backend.adapters.base import BaseModelAdapter

logger = logging.getLogger("backend.adapters.sih_onnx")

# Verified class mapping:
# 0: student
# 1: computer
CLASS_MAP: Dict[int, str] = {
    0: "student",
    1: "computer",
}


class SIHONNXAdapter(BaseModelAdapter):
    """Production inference adapter for the fine-tuned RT-DETRv2-R18 model.

    Executes the converted ONNX static graph with ONNX Runtime on CPU,
    preserving exact mathematical parity with the original PaddleDetection export.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = 0.35,
    ):
        super().__init__(
            model_id="RT-DETRv2-R18-SIH",
            model_mode="sih",
            is_mock=False,
        )
        if model_path is None:
            project_root = Path(__file__).resolve().parent.parent.parent
            self.model_path = project_root / "SIH_Model_Package" / "model" / "model.onnx"
        else:
            self.model_path = Path(model_path)

        self.confidence_threshold = float(confidence_threshold)
        self._session = None

    def load_model(self) -> None:
        """Initialize and warm up the ONNX Runtime inference session."""
        if self._is_loaded and self._session is not None:
            return

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Trained ONNX model weights not found at: {self.model_path}. "
                "Ensure model.onnx has been generated in SIH_Model_Package/model/."
            )

        try:
            import onnxruntime as ort
        except ImportError as e:
            raise RuntimeError(
                "onnxruntime is not installed. Please install onnxruntime to run SIHONNXAdapter."
            ) from e

        logger.info(f"Loading RT-DETRv2 ONNX model from '{self.model_path}'...")
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_options.intra_op_num_threads = 4

        self._session = ort.InferenceSession(
            str(self.model_path),
            sess_options=sess_options,
            providers=["CPUExecutionProvider"],
        )

        # Warm up with zero tensor
        dummy_img = np.zeros((1, 3, 640, 640), dtype=np.float32)
        dummy_im_shape = np.array([[640.0, 640.0]], dtype=np.float32)
        dummy_scale = np.array([[1.0, 1.0]], dtype=np.float32)
        self._session.run(
            None,
            {
                "image": dummy_img,
                "im_shape": dummy_im_shape,
                "scale_factor": dummy_scale,
            },
        )

        self._is_loaded = True
        logger.info("RT-DETRv2 ONNX model loaded and warmed up successfully.")

    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        frame_index: int = 0,
        timestamp_seconds: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """Run real forward neural network inference on a single BGR video frame."""
        if not self._is_loaded or self._session is None:
            self.load_model()

        if frame_bgr is None or frame_bgr.size == 0:
            return []

        orig_h, orig_w = frame_bgr.shape[:2]
        if orig_h <= 0 or orig_w <= 0:
            return []

        # 1. Resize to target dimension 640x640 (bilinear)
        resized = cv2.resize(frame_bgr, (640, 640), interpolation=cv2.INTER_LINEAR)

        # 2. Convert BGR to RGB
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

        # 3. Normalize Image: scale pixels to [0.0, 1.0]
        norm = rgb.astype(np.float32) / 255.0

        # 4. Transpose HWC -> CHW: (3, 640, 640)
        chw = np.transpose(norm, (2, 0, 1))

        # 5. Add batch dimension: (1, 3, 640, 640)
        input_tensor = np.expand_dims(chw, axis=0)

        # 6. Construct im_shape and scale_factor tensors expected by RT-DETR graph
        im_shape = np.array([[640.0, 640.0]], dtype=np.float32)
        scale_factor = np.array([[640.0 / float(orig_h), 640.0 / float(orig_w)]], dtype=np.float32)

        # 7. Execute ONNX Runtime session
        try:
            outputs = self._session.run(
                None,
                {
                    "image": input_tensor,
                    "im_shape": im_shape,
                    "scale_factor": scale_factor,
                },
            )
        except Exception as e:
            logger.error(f"Inference session failure at frame {frame_index}: {e}")
            raise

        if not outputs or len(outputs) == 0:
            return []

        # Output 0 is candidate matrix: shape [300, 6] -> [class_id, score, x1, y1, x2, y2]
        boxes = outputs[0]
        detections: List[Dict[str, Any]] = []

        for det in boxes:
            if len(det) < 6:
                continue

            cls_id_raw, score, x1, y1, x2, y2 = det[:6]
            score_val = float(score)

            if score_val < self.confidence_threshold:
                continue

            cls_id = int(round(float(cls_id_raw)))
            class_name = CLASS_MAP.get(cls_id, f"class_{cls_id}")

            # Clamp coordinates to original image bounds
            clamped_x1 = int(max(0, min(orig_w - 1, round(float(x1)))))
            clamped_y1 = int(max(0, min(orig_h - 1, round(float(y1)))))
            clamped_x2 = int(max(clamped_x1 + 1, min(orig_w, round(float(x2)))))
            clamped_y2 = int(max(clamped_y1 + 1, min(orig_h, round(float(y2)))))

            detections.append(
                {
                    "class_id": cls_id,
                    "class_name": class_name,
                    "confidence": round(score_val, 4),
                    "bbox": [clamped_x1, clamped_y1, clamped_x2, clamped_y2],
                    "frame_index": frame_index,
                    "timestamp_seconds": float(round(timestamp_seconds, 3)),
                }
            )

        return apply_nms(detections)


    def close(self) -> None:
        """Release ONNX Runtime session."""
        if self._session is not None:
            self._session = None
        self._is_loaded = False
        logger.info("RT-DETRv2 ONNX adapter closed.")


def apply_nms(
    detections: List[Dict[str, Any]],
    iou_thresh: float = 0.55,
    iomin_thresh: float = 0.65,
) -> List[Dict[str, Any]]:
    """Suppresses duplicate candidate boxes from transformer multi-query outputs."""
    if len(detections) <= 1:
        return detections

    res: List[Dict[str, Any]] = []
    classes = set(d.get("class_id", 0) for d in detections)
    for cid in classes:
        c_dets = [d for d in detections if d.get("class_id", 0) == cid]
        c_dets.sort(key=lambda x: x.get("confidence", 0.0), reverse=True)
        keep: List[Dict[str, Any]] = []
        is_computer = (cid == 1)
        for d in c_dets:
            b1 = d["bbox"]
            a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
            suppressed = False
            for k in keep:
                b2 = k["bbox"]
                a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
                iw = max(0, min(b1[2], b2[2]) - max(b1[0], b2[0]))
                ih = max(0, min(b1[3], b2[3]) - max(b1[1], b2[1]))
                inter = iw * ih
                if inter > 0 and a1 > 0 and a2 > 0:
                    iou = inter / (a1 + a2 - inter)
                    iomin = inter / min(a1, a2)
                    if is_computer:
                        if iou >= 0.60 or iomin >= 0.75:
                            suppressed = True
                            break
                    else:
                        if iou >= 0.65:
                            suppressed = True
                            break
            if not suppressed:
                keep.append(d)
        res.extend(keep)
    return res

