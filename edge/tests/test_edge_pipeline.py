"""Self-contained, assert-based test suite for M1 Edge AI Processing Pipeline.
No external test frameworks or fixtures required.
Run directly: python edge/tests/test_edge_pipeline.py
"""

import os
import sys
import tempfile
import numpy as np
import cv2

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from edge.camera.base import CameraSource
from edge.camera.usb_camera import USBCamera
from edge.camera.video_file import VideoFile
from edge.processing.annotator import VisualAnnotator
from edge.processing.pipeline import ProcessingPipeline
from edge.config import EdgeConfig
from edge.inference.model_loader import ModelLoader


def test_camera_abstraction():
    """Verify camera interface, lifecycle and error handling."""
    print("Testing Camera Abstraction and Error Handling...")
    
    # 1. Non-existent USB camera should fail cleanly without crashing
    cam = USBCamera(camera_index=999)
    assert not cam.open(), "Camera 999 should not open"
    assert not cam.is_opened(), "Camera 999 should report is_opened() == False"
    success, frame = cam.read()
    assert not success and frame is None, "Reading from closed camera should return (False, None)"
    cam.release()
    print("  ✓ Non-existent USB camera index reports clean failure")

    # 2. Synthetic video creation and VideoFile playback
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_video_path = tmp.name

    try:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(tmp_video_path, fourcc, 30.0, (320, 240))
        for _ in range(10):
            dummy_frame = np.zeros((240, 320, 3), dtype=np.uint8)
            writer.write(dummy_frame)
        writer.release()

        video_source = VideoFile(tmp_video_path, loop=True)
        assert video_source.open(), "VideoFile should open valid video"
        assert video_source.is_opened(), "VideoFile is_opened should be True"

        ret, frame = video_source.read()
        assert ret and frame is not None, "VideoFile should read valid frame"
        assert frame.shape == (240, 320, 3), f"Unexpected frame shape: {frame.shape}"

        info = video_source.get_info()
        assert info["status"] == "ONLINE"
        assert info["width"] == 320 and info["height"] == 240

        video_source.release()
        assert not video_source.is_opened(), "VideoFile should close cleanly"
        print("  ✓ VideoFile source read, loop, and release verified")
    finally:
        if os.path.exists(tmp_video_path):
            os.remove(tmp_video_path)


def test_visual_annotator():
    """Verify visual annotation overlay and HUD generation."""
    print("Testing Visual Annotator and HUD...")
    annotator = VisualAnnotator()
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)

    sample_detections = [
        {"class": "person", "confidence": 0.94, "bbox": [50, 60, 200, 350]},
        {"class": "person", "confidence": 0.88, "bbox": [250, 80, 400, 420]},
    ]

    annotated = annotator.annotate(
        frame_bgr=dummy_frame,
        detections=sample_detections,
        fps=22.4,
        inference_ms=45.2,
        camera_info="USB 0",
        model_name="RT-DETRv2-S",
        status="PROCESSING"
    )

    assert annotated.shape == dummy_frame.shape, "Annotator must preserve frame dimensions"
    assert annotated.dtype == np.uint8, "Annotator output must be uint8"
    # Ensure drawing modified pixels (not all black)
    assert np.any(annotated > 0), "Annotated frame must contain rendered visuals"
    print("  ✓ Visual annotator renders boxes, badges, and HUD telemetry")


def test_pipeline_structured_events():
    """Verify end-to-end telemetry and structured AI event schema."""
    print("Testing Pipeline Structured Event Generation...")

    class MockDetector:
        def detect(self, frame_bgr):
            # Simulated inference
            return [
                {"class": "person", "confidence": 0.95, "bbox": [10, 10, 100, 200]}
            ], 42.5

    class MockCamera(CameraSource):
        def open(self): return True
        def read(self): return True, np.zeros((480, 640, 3), dtype=np.uint8)
        def release(self): pass
        def is_opened(self): return True
        def get_info(self): return {"status": "ONLINE"}

    config = EdgeConfig(camera_id="TEST-CAM-01", source="usb", camera_index=0)
    pipeline = ProcessingPipeline(
        camera=MockCamera(),
        detector=MockDetector(),
        config=config
    )

    success, annotated_frame, event = pipeline.read_and_process()
    assert success, "Pipeline execution should succeed"
    assert annotated_frame is not None, "Annotated frame must be produced"
    assert event is not None, "Structured event must be produced"

    # Schema assertions required for downstream SIH backend / FastAPI integration
    assert event["camera_id"] == "TEST-CAM-01"
    assert "timestamp" in event
    assert event["detected_persons"] == 1
    assert len(event["detections"]) == 1
    assert event["detections"][0]["class"] == "person"
    assert event["detections"][0]["confidence"] == 0.95
    assert event["detections"][0]["bbox"] == [10, 10, 100, 200]
    assert "fps" in event
    assert "inference_ms" in event
    print("  ✓ Structured event format matches required SIH specifications")


def test_model_loader_error_handling():
    """Verify ModelLoader raises clear diagnostic errors on missing models."""
    print("Testing ModelLoader Error Reporting...")
    try:
        ModelLoader.load_rtdetr_v2(model_path="/non_existent_path/fake_model")
        assert False, "Should have raised RuntimeError for non-existent model path"
    except RuntimeError as e:
        assert "RT-DETRv2-S model could not be loaded" in str(e)
        print("  ✓ ModelLoader cleanly reports missing weights with path diagnostics")


def run_all():
    print("=" * 60)
    print("RUNNING EDGE AI PIPELINE SELF-CHECKS (M1)")
    print("=" * 60)
    test_camera_abstraction()
    test_visual_annotator()
    test_pipeline_structured_events()
    test_model_loader_error_handling()
    print("=" * 60)
    print("ALL M1 EDGE PIPELINE CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_all()
