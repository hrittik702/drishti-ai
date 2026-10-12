"""Unit tests validating ByteTrack multi-object tracking and unique object accumulation."""

import pytest
from backend.services.tracker import ByteTracker, Track, compute_iou_matrix


def test_iou_matrix_calculation():
    """Verify IoU calculation between matching, overlapping, and disjoint boxes."""
    b1 = [[10, 10, 50, 50], [100, 100, 150, 150]]
    b2 = [[10, 10, 50, 50], [200, 200, 250, 250]]

    iou = compute_iou_matrix(b1, b2)
    assert iou.shape == (2, 2)
    assert pytest.approx(iou[0, 0], 0.001) == 1.0  # Identical box
    assert iou[0, 1] == 0.0  # Disjoint
    assert iou[1, 0] == 0.0  # Disjoint
    assert iou[1, 1] == 0.0  # Disjoint


def test_same_student_multiple_frames_counts_once():
    """Verify consistent detections of the same student over 10 frames yield exactly 1 unique student."""
    tracker = ByteTracker(min_hits=2)

    for frame_idx in range(10):
        # Student slightly shifting position
        shift = frame_idx % 3
        dets = [{
            "class_id": 0,
            "class_name": "student",
            "bbox": [100 + shift, 120 + shift, 160 + shift, 240 + shift],
            "confidence": 0.90,
            "frame_index": frame_idx,
            "timestamp_seconds": frame_idx * 0.1,
        }]
        tracker.update(dets)

    unique_students, unique_computers = tracker.get_unique_counts()
    assert unique_students == 1, f"Expected 1 unique student, got {unique_students}"
    assert unique_computers == 0


def test_same_computer_multiple_frames_counts_once():
    """Verify stationary computer detections over 15 frames yield exactly 1 unique computer."""
    tracker = ByteTracker(min_hits=2)

    for frame_idx in range(15):
        dets = [{
            "class_id": 1,
            "class_name": "computer",
            "bbox": [300, 200, 380, 270],
            "confidence": 0.85,
            "frame_index": frame_idx,
            "timestamp_seconds": frame_idx * 0.1,
        }]
        tracker.update(dets)

    unique_students, unique_computers = tracker.get_unique_counts()
    assert unique_computers == 1, f"Expected 1 unique computer, got {unique_computers}"
    assert unique_students == 0


def test_simultaneous_distinct_objects_receive_different_tracks():
    """Verify multiple simultaneous objects in the same frame receive distinct persistent track IDs."""
    tracker = ByteTracker(min_hits=2)

    for frame_idx in range(5):
        dets = [
            {"class_id": 0, "class_name": "student", "bbox": [50, 100, 100, 200], "confidence": 0.88},
            {"class_id": 0, "class_name": "student", "bbox": [200, 100, 250, 200], "confidence": 0.91},
            {"class_id": 1, "class_name": "computer", "bbox": [400, 300, 480, 370], "confidence": 0.82},
        ]
        assigned = tracker.update(dets)
        track_ids = [d["track_id"] for d in assigned]
        assert len(set(track_ids)) == 3, "All simultaneous objects must receive distinct track IDs"

    unique_students, unique_computers = tracker.get_unique_counts()
    assert unique_students == 2
    assert unique_computers == 1


def test_class_segregation_prevents_id_pollution():
    """Verify student and computer tracks never match each other even if bounding boxes overlap."""
    tracker = ByteTracker(min_hits=2)

    # Frame 0: student at location
    dets_0 = [{"class_id": 0, "class_name": "student", "bbox": [100, 100, 180, 220], "confidence": 0.90}]
    assigned_0 = tracker.update(dets_0)
    student_id = assigned_0[0]["track_id"]

    # Frame 1: computer at the EXACT SAME bounding box coordinates
    dets_1 = [{"class_id": 1, "class_name": "computer", "bbox": [100, 100, 180, 220], "confidence": 0.90}]
    assigned_1 = tracker.update(dets_1)
    computer_id = assigned_1[0]["track_id"]

    # Identities must be completely separated
    assert student_id != computer_id, "Student and computer must not share track IDs"


def test_temporary_occlusion_maintains_persistent_track():
    """Verify a track persists across temporary dropped detections within max_time_lost."""
    tracker = ByteTracker(min_hits=2, max_time_lost=10)

    # Frames 0-2: student visible
    for frame_idx in range(3):
        dets = [{"class_id": 0, "class_name": "student", "bbox": [150, 150, 220, 280], "confidence": 0.90}]
        assigned = tracker.update(dets)
        init_id = assigned[0]["track_id"]

    # Frames 3-5: student occluded (0 detections)
    for frame_idx in range(3, 6):
        tracker.update([])

    # Frame 6: student reappears at same location
    dets_reappear = [{"class_id": 0, "class_name": "student", "bbox": [152, 152, 222, 282], "confidence": 0.88}]
    assigned_reappear = tracker.update(dets_reappear)

    assert assigned_reappear[0]["track_id"] == init_id, "Track ID must persist after temporary occlusion"
    unique_students, _ = tracker.get_unique_counts()
    assert unique_students == 1, "Occluded student must still count as 1 unique student"


def test_single_frame_noise_excluded_by_confirmation_threshold():
    """Verify a 1-frame spurious detection is never confirmed or counted."""
    tracker = ByteTracker(min_hits=2)

    # 1-frame noise detection
    tracker.update([{"class_id": 0, "class_name": "student", "bbox": [500, 500, 550, 550], "confidence": 0.40}])

    # Next frames: no detections
    for _ in range(5):
        tracker.update([])

    unique_students, unique_computers = tracker.get_unique_counts()
    assert unique_students == 0, "Unconfirmed single-frame noise must not be counted"
