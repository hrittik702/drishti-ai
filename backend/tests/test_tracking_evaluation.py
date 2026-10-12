"""Comprehensive evaluation test suite for multi-object tracking.

Tests all 8 mandated tracking scenarios:
1. The same student appears in consecutive frames.
2. A student is briefly occluded.
3. Two students cross paths.
4. A student leaves and re-enters the scene.
5. The same computer appears throughout the video.
6. Multiple computers are visible simultaneously.
7. Frame sampling is changed (1x, 3x, 5x).
8. A new video job starts after a previous job finishes.
"""

import pytest
from backend.services.tracker import ByteTracker, TrackState, suppress_duplicate_detections


def test_scenario_1_same_student_consecutive_frames():
    """Scenario 1: Same student in consecutive frames maintains 1 stable ID and count = 1."""
    tracker = ByteTracker(fps=25.0, sample_interval=1, min_hits=2)
    assigned_ids = set()

    for frame_idx in range(30):
        dets = [{
            "class_id": 0,
            "class_name": "student",
            "bbox": [150 + (frame_idx % 2), 120, 210 + (frame_idx % 2), 260],
            "confidence": 0.92,
            "frame_index": frame_idx,
        }]
        assigned = tracker.update(dets, frame_idx=frame_idx)
        assert len(assigned) == 1
        assigned_ids.add(assigned[0]["track_id"])

    assert len(assigned_ids) == 1, f"Expected 1 persistent track ID, got {assigned_ids}"
    u_s, u_c = tracker.get_unique_counts()
    assert u_s == 1, f"Expected 1 unique student, got {u_s}"
    assert u_c == 0


def test_scenario_2_student_briefly_occluded():
    """Scenario 2: Student occluded for several frames reconnects to original ID without duplicate counting."""
    tracker = ByteTracker(fps=25.0, sample_interval=1, min_hits=2, max_time_lost=20)
    initial_id = None

    # Visible frames 0..5
    for frame_idx in range(6):
        dets = [{
            "class_id": 0,
            "class_name": "student",
            "bbox": [200, 150, 270, 290],
            "confidence": 0.90,
            "frame_index": frame_idx,
        }]
        assigned = tracker.update(dets, frame_idx=frame_idx)
        initial_id = assigned[0]["track_id"]

    # Occluded frames 6..10 (0 detections)
    for frame_idx in range(6, 11):
        tracker.update([], frame_idx=frame_idx)

    # Reappears at frame 11
    reappear_dets = [{
        "class_id": 0,
        "class_name": "student",
        "bbox": [202, 153, 272, 292],
        "confidence": 0.88,
        "frame_index": 11,
    }]
    assigned_reappear = tracker.update(reappear_dets, frame_idx=11)

    assert assigned_reappear[0]["track_id"] == initial_id, "Track must reconnect to original ID"
    u_s, _ = tracker.get_unique_counts()
    assert u_s == 1, "Occluded student must remain counted as exactly 1"


def test_scenario_3_two_students_cross_paths():
    """Scenario 3: Two students crossing paths in hallway maintain distinct identities without merging."""
    tracker = ByteTracker(fps=25.0, sample_interval=1, min_hits=2)

    # Student A walks along front path (y=180, x from 100 to 300)
    # Student B walks along back path (y=120, x from 300 to 100)
    # They pass each other at midpoint (x=200) around frame 10
    id_a, id_b = None, None

    for frame_idx in range(21):
        xa = 100 + frame_idx * 10
        xb = 300 - frame_idx * 10

        dets = [
            {"class_id": 0, "class_name": "student", "bbox": [xa, 180, xa + 60, 310], "confidence": 0.91},
            {"class_id": 0, "class_name": "student", "bbox": [xb, 120, xb + 55, 240], "confidence": 0.89},
        ]
        assigned = tracker.update(dets, frame_idx=frame_idx)
        assert len(assigned) == 2

        if frame_idx == 0:
            id_a = assigned[0]["track_id"]
            id_b = assigned[1]["track_id"]
            assert id_a != id_b

        current_ids = {d["track_id"] for d in assigned}
        assert len(current_ids) == 2, f"Frame {frame_idx} must have 2 distinct IDs"

    u_s, u_c = tracker.get_unique_counts()
    assert u_s == 2, f"Expected 2 unique students after crossing, got {u_s}"
    assert u_c == 0


def test_scenario_4_student_leaves_and_reenters():
    """Scenario 4: Student tracklet reconciliation merges disjoint tracklets at same workstation."""
    tracker = ByteTracker(fps=25.0, sample_interval=1, min_hits=2, max_time_lost=15)

    # First session: frames 0..6
    for frame_idx in range(7):
        dets = [{"class_id": 0, "class_name": "student", "bbox": [120, 200, 180, 310], "confidence": 0.88}]
        tracker.update(dets, frame_idx=frame_idx)

    # Student leaves: frames 7..30 (exceeds max_time_lost=15, old track expires)
    for frame_idx in range(7, 31):
        tracker.update([], frame_idx=frame_idx)

    # Re-enters at frame 31..38 at the same seat
    for frame_idx in range(31, 39):
        dets = [{"class_id": 0, "class_name": "student", "bbox": [123, 202, 182, 312], "confidence": 0.89}]
        tracker.update(dets, frame_idx=frame_idx)

    u_s, u_c = tracker.get_unique_counts()
    assert u_s == 1, f"Expected 1 unique student after tracklet reconciliation, got {u_s}"


def test_scenario_5_same_computer_throughout_video():
    """Scenario 5: Stationary computer with bounding box jitter maintains 1 identity throughout."""
    tracker = ByteTracker(fps=25.0, sample_interval=1, min_hits=2)
    track_ids = set()

    for frame_idx in range(50):
        jitter_x = (frame_idx * 3) % 7
        jitter_y = (frame_idx * 2) % 5
        dets = [{
            "class_id": 1,
            "class_name": "computer",
            "bbox": [320 + jitter_x, 180 + jitter_y, 395 + jitter_x, 245 + jitter_y],
            "confidence": 0.84,
            "frame_index": frame_idx,
        }]
        assigned = tracker.update(dets, frame_idx=frame_idx)
        track_ids.add(assigned[0]["track_id"])

    assert len(track_ids) == 1, f"Expected 1 stable computer ID across jitter, got {track_ids}"
    _, u_c = tracker.get_unique_counts()
    assert u_c == 1, f"Expected 1 unique computer, got {u_c}"


def test_scenario_6_multiple_computers_visible_simultaneously():
    """Scenario 6: Multiple computers visible side-by-side are tracked with distinct persistent IDs."""
    tracker = ByteTracker(fps=25.0, sample_interval=1, min_hits=2)

    for frame_idx in range(10):
        dets = [
            {"class_id": 1, "class_name": "computer", "bbox": [50, 150, 110, 210], "confidence": 0.88},
            {"class_id": 1, "class_name": "computer", "bbox": [180, 150, 240, 210], "confidence": 0.85},
            {"class_id": 1, "class_name": "computer", "bbox": [310, 150, 370, 210], "confidence": 0.90},
        ]
        assigned = tracker.update(dets, frame_idx=frame_idx)
        current_ids = {d["track_id"] for d in assigned}
        assert len(current_ids) == 3, f"Expected 3 distinct IDs in frame {frame_idx}"

    u_s, u_c = tracker.get_unique_counts()
    assert u_s == 0
    assert u_c == 3, f"Expected 3 unique computers, got {u_c}"


def test_scenario_7_frame_sampling_resilience():
    """Scenario 7: Tracking is resilient across sampling rates (1x, 3x, 5x) without count inflation."""
    for sample_interval in [1, 3, 5]:
        tracker = ByteTracker(fps=25.0, sample_interval=sample_interval, min_hits=2)

        for frame_idx in range(0, 60, sample_interval):
            dets = [
                {"class_id": 0, "class_name": "student", "bbox": [100, 100, 160, 220], "confidence": 0.90},
                {"class_id": 1, "class_name": "computer", "bbox": [250, 200, 310, 260], "confidence": 0.85},
            ]
            tracker.update(dets, frame_idx=frame_idx)

        u_s, u_c = tracker.get_unique_counts()
        assert u_s == 1, f"At sample_interval={sample_interval}, expected 1 student, got {u_s}"
        assert u_c == 1, f"At sample_interval={sample_interval}, expected 1 computer, got {u_c}"


def test_scenario_8_job_isolation_state_reset():
    """Scenario 8: Fresh video job starts with isolated clean state and zero leakage from prior jobs."""
    # Job A
    tracker_a = ByteTracker(min_hits=2)
    for frame_idx in range(5):
        tracker_a.update([
            {"class_id": 0, "class_name": "student", "bbox": [50, 50, 100, 150], "confidence": 0.90},
            {"class_id": 0, "class_name": "student", "bbox": [200, 50, 250, 150], "confidence": 0.90},
            {"class_id": 1, "class_name": "computer", "bbox": [350, 50, 400, 100], "confidence": 0.90},
        ], frame_idx=frame_idx)

    u_sa, u_ca = tracker_a.get_unique_counts()
    assert u_sa == 2
    assert u_ca == 1

    # Job B (brand new instance)
    tracker_b = ByteTracker(min_hits=2)
    assert len(tracker_b.tracks) == 0
    assert tracker_b.next_id == 1
    assert len(tracker_b.computer_anchors) == 0

    for frame_idx in range(5):
        tracker_b.update([
            {"class_id": 0, "class_name": "student", "bbox": [500, 500, 550, 600], "confidence": 0.90},
        ], frame_idx=frame_idx)

    u_sb, u_cb = tracker_b.get_unique_counts()
    assert u_sb == 1
    assert u_cb == 0


def test_intra_frame_duplicate_suppression():
    """Verify that multiple detector queries for the same object in a single frame are suppressed."""
    dets = [
        {"class_id": 0, "class_name": "student", "bbox": [100, 100, 200, 300], "confidence": 0.90},
        # Duplicate query slightly shifted (IoU > 0.85)
        {"class_id": 0, "class_name": "student", "bbox": [102, 101, 201, 299], "confidence": 0.65},
        # Distinct student elsewhere
        {"class_id": 0, "class_name": "student", "bbox": [400, 100, 500, 300], "confidence": 0.88},
    ]
    suppressed = suppress_duplicate_detections(dets)
    assert len(suppressed) == 2, f"Expected 2 detections after NMS suppression, got {len(suppressed)}"
    assert suppressed[0]["confidence"] == 0.90
