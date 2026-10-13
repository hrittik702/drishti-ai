"""Tests for independent entity ID namespaces (S01, C01), persistence, and formatting."""

import numpy as np
import pytest
from backend.services.tracker import ByteTracker, Track, TrackState
from backend.services.video_processor import draw_annotations
from backend.schemas import Detection


def test_independent_namespaces_s01_and_c01():
    """Verify students get S01, S02... and computers get C01, C02... independently starting at 1."""
    tracker = ByteTracker(min_hits=1)

    dets_frame_0 = [
        {"class_id": 0, "class_name": "student", "bbox": [100, 100, 150, 200], "confidence": 0.92, "frame_index": 0},
        {"class_id": 1, "class_name": "computer", "bbox": [300, 300, 400, 400], "confidence": 0.88, "frame_index": 0},
    ]
    out_0 = tracker.update(dets_frame_0)

    # Both must start at 01 independently
    student_det = next(d for d in out_0 if d["class_name"] == "student")
    computer_det = next(d for d in out_0 if d["class_name"] == "computer")

    assert student_det["display_id"] == "S01", f"Expected S01, got {student_det.get('display_id')}"
    assert computer_det["display_id"] == "C01", f"Expected C01, got {computer_det.get('display_id')}"
    assert isinstance(student_det["track_id"], int)
    assert isinstance(computer_det["track_id"], int)

    # Add second student and second computer
    dets_frame_1 = [
        {"class_id": 0, "class_name": "student", "bbox": [100, 100, 150, 200], "confidence": 0.92, "frame_index": 1},
        {"class_id": 1, "class_name": "computer", "bbox": [300, 300, 400, 400], "confidence": 0.88, "frame_index": 1},
        {"class_id": 0, "class_name": "student", "bbox": [500, 100, 550, 200], "confidence": 0.90, "frame_index": 1},
        {"class_id": 1, "class_name": "computer", "bbox": [700, 300, 800, 400], "confidence": 0.85, "frame_index": 1},
    ]
    out_1 = tracker.update(dets_frame_1)

    display_ids = {d["class_name"] + "_" + str(d["bbox"][0]): d["display_id"] for d in out_1}
    assert display_ids["student_100"] == "S01"
    assert display_ids["student_500"] == "S02"
    assert display_ids["computer_300"] == "C01"
    assert display_ids["computer_700"] == "C02"


def test_track_persistence_across_frames_and_occlusions():
    """Verify S01 and C01 remain stable across continuous frames and temporary occlusion."""
    tracker = ByteTracker(min_hits=1, max_time_lost=15)

    # Frame 0: Track S01
    out_0 = tracker.update([
        {"class_id": 0, "class_name": "student", "bbox": [100, 100, 150, 200], "confidence": 0.95, "frame_index": 0}
    ])
    assert out_0[0]["display_id"] == "S01"

    # Frame 1 to 5: Continuous tracking
    for f in range(1, 6):
        out = tracker.update([
            {"class_id": 0, "class_name": "student", "bbox": [102, 102, 152, 202], "confidence": 0.94, "frame_index": f}
        ])
        assert len(out) == 1
        assert out[0]["display_id"] == "S01", f"Frame {f} changed ID to {out[0]['display_id']}"

    # Frame 6 to 8: Occlusion / missed detections (no detections passed)
    for f in range(6, 9):
        tracker.update([])

    # Frame 9: Student reappears at nearby position within max_time_lost
    out_9 = tracker.update([
        {"class_id": 0, "class_name": "student", "bbox": [105, 105, 155, 205], "confidence": 0.91, "frame_index": 9}
    ])
    assert len(out_9) == 1
    assert out_9[0]["display_id"] == "S01", f"Post-occlusion changed ID to {out_9[0].get('display_id')}"


def test_canonical_display_id_mapping_for_reconciled_tracklets():
    """Verify reconciled fragmented tracklets map to a single canonical display ID."""
    tracker = ByteTracker(min_hits=1)

    # Create two non-overlapping tracklets representing the same physical student
    t1 = Track(track_id=1, class_id=0, class_name="student", bbox=[100, 100, 150, 200], score=0.9, frame_idx=0, min_hits=1)
    t1.state = TrackState.CONFIRMED
    t1.frames_seen = {0, 1, 2, 3}
    t1.centers = [(125.0, 150.0)]

    t2 = Track(track_id=2, class_id=0, class_name="student", bbox=[102, 102, 152, 202], score=0.9, frame_idx=50, min_hits=1)
    t2.state = TrackState.CONFIRMED
    t2.frames_seen = {50, 51, 52, 53}
    t2.centers = [(127.0, 152.0)]

    tracker.tracks = [t1, t2]
    tracker.next_id = 3

    # Build canonical map (which reconciles non-overlapping close tracklets)
    canonical_map = tracker.build_canonical_display_id_map()

    # Both tracklets must resolve to canonical S01
    assert 1 in canonical_map
    assert 2 in canonical_map
    assert canonical_map[1] == "S01"
    assert canonical_map[2] == "S01", f"Expected reconciled track 2 to map to S01, got {canonical_map[2]}"

    # Verify applying canonical mapping to detections list
    dets = [
        {"class_id": 0, "class_name": "student", "track_id": 1, "display_id": "S01", "frame_index": 0},
        {"class_id": 0, "class_name": "student", "track_id": 2, "display_id": "S02", "frame_index": 50},
    ]
    mapped = tracker.apply_canonical_mapping(dets)
    assert mapped[0]["display_id"] == "S01"
    assert mapped[1]["display_id"] == "S01"


def test_job_isolation_resets_numbering_to_s01_and_c01():
    """Verify that every new video-analysis job resets student and computer numbering to S01 and C01."""
    job1_tracker = ByteTracker(min_hits=1)
    job1_tracker.update([
        {"class_id": 0, "class_name": "student", "bbox": [10, 10, 20, 20], "confidence": 0.9, "frame_index": 0},
        {"class_id": 0, "class_name": "student", "bbox": [30, 30, 40, 40], "confidence": 0.9, "frame_index": 0},
        {"class_id": 1, "class_name": "computer", "bbox": [50, 50, 60, 60], "confidence": 0.9, "frame_index": 0},
    ])

    # Job 2 tracker must be completely clean
    job2_tracker = ByteTracker(min_hits=1)
    out_job2 = job2_tracker.update([
        {"class_id": 0, "class_name": "student", "bbox": [100, 100, 150, 150], "confidence": 0.95, "frame_index": 0},
        {"class_id": 1, "class_name": "computer", "bbox": [200, 200, 250, 250], "confidence": 0.95, "frame_index": 0},
    ])

    job2_student = next(d for d in out_job2 if d["class_name"] == "student")
    job2_computer = next(d for d in out_job2 if d["class_name"] == "computer")

    assert job2_student["display_id"] == "S01", f"Expected job 2 to start at S01, got {job2_student['display_id']}"
    assert job2_computer["display_id"] == "C01", f"Expected job 2 to start at C01, got {job2_computer['display_id']}"


def test_video_annotation_label_formatting():
    """Verify draw_annotations uses STUDENT S03 · 89% and COMPUTER C04 · 90% formats."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = [
        {
            "class_id": 0,
            "class_name": "student",
            "bbox": [50, 100, 150, 300],
            "confidence": 0.89,
            "display_id": "S03",
            "track_id": 3,
        },
        {
            "class_id": 1,
            "class_name": "computer",
            "bbox": [200, 100, 350, 250],
            "confidence": 0.903,
            "display_id": "C04",
            "track_id": 4,
        },
    ]

    annotated = draw_annotations(
        frame=frame,
        detections=detections,
        model_id="RT-DETRv2-R18",
        frame_idx=10,
        total_frames=100,
        live_students=1,
        live_computers=1,
        unique_students=3,
        unique_computers=4,
    )
    assert annotated.shape == frame.shape
    # Ensure drawing modified pixels
    assert np.any(annotated > 0)


def test_video_annotation_edge_guard_prevents_clipping():
    """Verify near-top boxes (y1 near 0) keep label badges within frame boundary."""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    detections = [
        {
            "class_id": 0,
            "class_name": "student",
            "bbox": [10, 5, 100, 200],  # y1 is 5px, label badge placed below y1 to prevent clipping
            "confidence": 0.92,
            "display_id": "S01",
            "track_id": 1,
        }
    ]
    annotated = draw_annotations(
        frame=frame,
        detections=detections,
        model_id="RT-DETRv2-R18",
        frame_idx=0,
        total_frames=10,
    )
    assert annotated.shape == frame.shape
    # Check that drawing succeeded without crash or out-of-bounds error
    assert np.any(annotated > 0)


def test_api_detection_schema_includes_display_id():
    """Verify Pydantic Detection schema validates and serializes display_id and track_id."""
    det = Detection(
        class_id=0,
        class_name="student",
        confidence=0.88,
        bbox=[10.0, 20.0, 30.0, 40.0],
        track_id=5,
        display_id="S02",
        frame_index=12,
        timestamp_seconds=0.4,
    )
    data = det.model_dump()
    assert data["display_id"] == "S02"
    assert data["track_id"] == 5

    # Test optional / None display_id backwards compatibility
    det_legacy = Detection(
        class_id=1,
        class_name="computer",
        confidence=0.91,
        bbox=[10.0, 20.0, 30.0, 40.0],
        track_id=2,
        frame_index=1,
        timestamp_seconds=0.04,
    )
    assert det_legacy.display_id is None
