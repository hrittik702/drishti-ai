"""Person detector implementation using RT-DETRv2-S."""

import time
import logging
from typing import List, Dict, Any, Tuple
import cv2
import numpy as np

logger = logging.getLogger("edge.inference.detector")


class PersonDetector:
    """Detects persons in video frames using RT-DETRv2-S."""

    def __init__(
        self,
        model: Any,
        processor: Any,
        device: str = "cpu",
        confidence_threshold: float = 0.40,
        person_label: str = "person"
    ):
        self.model = model
        self.processor = processor
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.person_label = person_label.lower()

        # Resolve person class index from model id2label
        self.person_class_ids = set()
        if hasattr(model, "config") and hasattr(model.config, "id2label"):
            for class_id, label_name in model.config.id2label.items():
                if label_name.lower() == self.person_label:
                    self.person_class_ids.add(int(class_id))

        # Fallback to COCO standard class 0 if not discovered
        if not self.person_class_ids:
            self.person_class_ids.add(0)

    def detect(self, frame_bgr: np.ndarray) -> Tuple[List[Dict[str, Any]], float]:
        """Perform person detection on a single frame.
        
        Args:
            frame_bgr: OpenCV BGR uint8 image array (H, W, 3).
            
        Returns:
            Tuple[List[Dict[str, Any]], float]:
                - List of detection dictionaries:
                  [{"class": "person", "confidence": 0.94, "bbox": [x1, y1, x2, y2]}]
                - Exact inference latency in milliseconds.
        """
        import torch

        height, width = frame_bgr.shape[:2]

        # Convert BGR to RGB for transformer processor
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        # Preprocess frame
        inputs = self.processor(images=frame_rgb, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Measure exact inference duration
        t_start = time.perf_counter()
        with torch.no_grad():
            outputs = self.model(**inputs)
        t_end = time.perf_counter()
        inference_ms = (t_end - t_start) * 1000.0

        # Post-process detections to original image dimensions
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
            # Strict filtering: only detect persons
            if int(label_id) not in self.person_class_ids:
                continue

            x1, y1, x2, y2 = box.tolist()

            # Clamp coordinates to frame boundaries
            x1 = max(0, min(int(round(x1)), width - 1))
            y1 = max(0, min(int(round(y1)), height - 1))
            x2 = max(x1 + 1, min(int(round(x2)), width))
            y2 = max(y1 + 1, min(int(round(y2)), height))

            detections.append({
                "class": "person",
                "confidence": float(round(score, 4)),
                "bbox": [x1, y1, x2, y2]
            })

        return detections, inference_ms
