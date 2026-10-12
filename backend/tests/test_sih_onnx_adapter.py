"""Unit tests for the production SIHONNXAdapter with real trained RT-DETRv2 weights."""

import pytest
import numpy as np
import cv2
from pathlib import Path

from backend.adapters.sih_onnx_adapter import SIHONNXAdapter, CLASS_MAP
from backend.config import settings


def test_adapter_initialization_and_weights_exist():
    """Verify that model.onnx exists and adapter initializes cleanly."""
    adapter = SIHONNXAdapter(confidence_threshold=0.35)
    assert adapter.model_id == "RT-DETRv2-R18-SIH"
    assert adapter.model_mode == "sih"
    assert adapter.is_mock is False
    assert adapter.model_path.exists(), f"Model file missing at {adapter.model_path}"

    adapter.load_model()
    assert adapter.is_loaded is True
    adapter.close()
    assert adapter.is_loaded is False


def test_adapter_empty_and_zero_frame_handling():
    """Ensure adapter handles empty, None, and zero-dimensional frames gracefully."""
    adapter = SIHONNXAdapter(confidence_threshold=0.35)
    adapter.load_model()

    assert adapter.predict_frame(None) == []
    assert adapter.predict_frame(np.array([])) == []

    # Blank black frame
    black_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    dets = adapter.predict_frame(black_frame, frame_index=0, timestamp_seconds=0.0)
    assert isinstance(dets, list)

    adapter.close()


def test_adapter_real_cctv_frame_detection_and_classes():
    """Run real inference on CCTV video frame 0 and verify detection output schema."""
    video_path = Path("cctv_v2_annotated.mp4")
    if not video_path.exists():
        pytest.skip("Sample CCTV video not found in root")

    cap = cv2.VideoCapture(str(video_path))
    ret, frame = cap.read()
    cap.release()
    assert ret is True, "Failed to decode CCTV frame 0"

    h, w = frame.shape[:2]
    adapter = SIHONNXAdapter(confidence_threshold=0.35)
    adapter.load_model()

    dets = adapter.predict_frame(frame, frame_index=0, timestamp_seconds=0.0)
    assert len(dets) > 0, "Expected positive detections on real classroom CCTV frame"

    # Verify detection schema and valid pixel coordinate bounds
    for d in dets:
        assert d["class_id"] in (0, 1)
        assert d["class_name"] in ("student", "computer")
        assert 0.0 <= d["confidence"] <= 1.0
        assert d["confidence"] >= 0.35

        x1, y1, x2, y2 = d["bbox"]
        assert 0 <= x1 < x2 <= w
        assert 0 <= y1 < y2 <= h
        assert d["frame_index"] == 0
        assert d["timestamp_seconds"] == 0.0

    adapter.close()


def test_adapter_confidence_threshold_filtering():
    """Verify that raising confidence threshold strictly filters lower-confidence detections."""
    video_path = Path("cctv_v2_annotated.mp4")
    if not video_path.exists():
        pytest.skip("Sample CCTV video not found in root")

    cap = cv2.VideoCapture(str(video_path))
    ret, frame = cap.read()
    cap.release()

    adapter_sensitive = SIHONNXAdapter(confidence_threshold=0.20)
    adapter_strict = SIHONNXAdapter(confidence_threshold=0.80)

    adapter_sensitive.load_model()
    adapter_strict.load_model()

    dets_sensitive = adapter_sensitive.predict_frame(frame)
    dets_strict = adapter_strict.predict_frame(frame)

    assert len(dets_sensitive) >= len(dets_strict)
    for d in dets_strict:
        assert d["confidence"] >= 0.80

    adapter_sensitive.close()
    adapter_strict.close()
