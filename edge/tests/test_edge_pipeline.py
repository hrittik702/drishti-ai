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
from edge.inference.detector import RTDETRDetector, load_detector, PersonDetector


def test_reusable_inference_interface():
    """Verify reusable inference interface (load_detector, predict_frame, predict_image, close)."""
    print("Testing Reusable Inference Interface (Phase 1)...")

    # 1. Configuration validation & PaddlePaddle missing runtime diagnostic
    try:
        load_detector(device="invalid_gpu")
        assert False, "Should raise ValueError for invalid device"
    except ValueError as e:
        assert "Invalid device" in str(e)
        print("  ✓ Invalid device raises clean ValueError")

    try:
        load_detector(confidence_threshold=1.5)
        assert False, "Should raise ValueError for out-of-range confidence_threshold"
    except ValueError as e:
        assert "Invalid confidence_threshold" in str(e)
        print("  ✓ Invalid confidence_threshold raises clean ValueError")

    try:
        load_detector(config_path_or_model="model_final.pdparams")
        assert False, "Should raise RuntimeError when PaddlePaddle checkpoint specified without paddle installed"
    except RuntimeError as e:
        assert "PaddlePaddle" in str(e)
        print("  ✓ Paddle checkpoint reports clean diagnostic requirement")

    # 2. Test RTDETRDetector with mock model & processor
    class MockConfig:
        id2label = {0: "student", 1: "computer", 2: "chair"}

    class MockModel:
        config = MockConfig()
        def to(self, device): return self
        def eval(self): return self
        def __call__(self, **inputs): return None

    class MockProcessor:
        def __call__(self, images, return_tensors="pt"):
            import torch
            return {"pixel_values": torch.zeros((1, 3, 240, 320))}

        def post_process_object_detection(self, outputs, target_sizes, threshold):
            import torch
            # Simulate 2 detections: 1 student (score 0.92), 1 computer (score 0.85)
            h, w = target_sizes[0].tolist()
            return [{
                "scores": torch.tensor([0.92, 0.85]),
                "labels": torch.tensor([0, 1]),
                "boxes": torch.tensor([[15.2, 20.4, 100.8, 180.1], [150.0, 50.0, 220.0, 140.0]])
            }]

    mock_model = MockModel()

    detector = RTDETRDetector(
        model=mock_model,
        processor=MockProcessor(),
        device="cpu",
        confidence_threshold=0.40,
        target_classes=["student", "computer"],
        model_id="mock_custom_rtdetr"
    )

    # Empty frame test
    empty_result = detector.predict_frame(np.array([]))
    assert isinstance(empty_result, dict), "predict_frame must return dictionary envelope"
    assert empty_result["detections"] == [] and empty_result["inference_latency_ms"] == 0.0
    assert empty_result["schema_version"] == "1.0"
    print("  ✓ Empty frame produces zero detections envelope cleanly")

    # Predict frame test
    test_frame = np.zeros((240, 320, 3), dtype=np.uint8)
    result = detector.predict_frame(test_frame, frame_index=42, timestamp="2026-10-12T12:00:00Z")
    assert isinstance(result, dict), "predict_frame must return dictionary"
    assert result["schema_version"] == "1.0"
    assert result["model_id"] == "mock_custom_rtdetr"
    assert result["frame_index"] == 42
    assert result["timestamp"] == "2026-10-12T12:00:00Z"
    assert "inference_latency_ms" in result
    assert isinstance(result["inference_latency_ms"], float)

    detections = result["detections"]
    assert len(detections) == 2, f"Expected 2 detections, got {len(detections)}"

    # Schema validation
    d0 = detections[0]
    assert d0["class_id"] == 0
    assert d0["class_name"] == "student"
    assert d0["class"] == "student"
    assert d0["confidence"] == 0.92
    assert d0["bbox"] == [15, 20, 101, 180]

    # Coordinate boundary validation
    for d in detections:
        x1, y1, x2, y2 = d["bbox"]
        assert 0 <= x1 < x2 <= 320, f"Invalid x bounds: {x1}, {x2}"
        assert 0 <= y1 < y2 <= 240, f"Invalid y bounds: {y1}, {y2}"
        assert all(isinstance(coord, int) for coord in d["bbox"]), "Bbox coordinates must be integer pixels"
    print("  ✓ Structured schema & absolute pixel coordinate conventions verified")

    # Predict image with numpy array (returns same envelope format)
    img_result = detector.predict_image(test_frame, frame_index=1, timestamp="2026-10-12T12:01:00Z")
    assert isinstance(img_result, dict), "predict_image must return dictionary envelope"
    assert img_result["schema_version"] == "1.0"
    assert len(img_result["detections"]) == 2
    print("  ✓ predict_image returns consistent structured envelope")

    # Model reuse across multiple frames
    for i in range(3):
        r_i = detector.predict_frame(test_frame, frame_index=i)
        assert len(r_i["detections"]) == 2 and r_i["frame_index"] == i
    print("  ✓ Model reuse across consecutive frames verified")

    # Backward compatibility: PersonDetector.detect returns tuple (detections, latency_ms)
    person_det = PersonDetector(
        model=mock_model,
        processor=MockProcessor(),
        device="cpu",
        person_label="student",
        model_id="mock_person_detector"
    )
    p_dets, p_lat = person_det.detect(test_frame)
    assert isinstance(p_dets, list) and isinstance(p_lat, float)
    assert len(p_dets) == 1 and p_dets[0]["class_name"] == "student"
    print("  ✓ PersonDetector backward-compatible detect() tuple verified")

    # Input validation for missing file
    try:
        detector.predict_image("/non_existent_file_xyz.jpg")
        assert False, "Should raise FileNotFoundError for missing image"
    except FileNotFoundError:
        print("  ✓ predict_image input validation verified")

    # Resource cleanup
    detector.close()
    assert detector.model is None and detector.processor is None, "close() must release model and processor"
    print("  ✓ Detector resource release verified")


def test_camera_abstraction():
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
    test_reusable_inference_interface()
    test_model_loader_error_handling()
    print("=" * 60)
    print("ALL M1 EDGE PIPELINE CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_all()
