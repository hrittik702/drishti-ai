"""Production-grade multi-object tracking (ByteTrack) with persistent identities.

Features:
- Intra-frame duplicate suppression (NMS) to eliminate multi-query detector artifacts.
- 4-state track lifecycle: TENTATIVE, CONFIRMED, LOST, DELETED.
- Hybrid affinity metric: IoU, overlap coefficient (IoMin), and normalized center distance.
- Multi-stage association: Active matching, Lost-track reactivation, Low-confidence recovery.
- Stationary workstation anchors for computers to prevent workstation duplication.
- Conservative tracklet reconciliation for seated students with zero temporal overlap.
- Strict class segregation: student and computer tracking spaces never mix.
"""

from enum import Enum
from typing import List, Dict, Any, Tuple, Set, Optional
import numpy as np


class TrackState(str, Enum):
    """Lifecycle state of a tracked object."""
    TENTATIVE = "tentative"
    CONFIRMED = "confirmed"
    LOST = "lost"
    DELETED = "deleted"


def compute_iou_matrix(boxes_a: List[List[int]], boxes_b: List[List[int]]) -> np.ndarray:
    """Compute pairwise Intersection-over-Union (IoU) matrix between two sets of boxes."""
    if len(boxes_a) == 0 or len(boxes_b) == 0:
        return np.empty((len(boxes_a), len(boxes_b)), dtype=np.float32)

    a = np.array(boxes_a, dtype=np.float32)
    b = np.array(boxes_b, dtype=np.float32)

    x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    y2 = np.minimum(a[:, None, 3], b[None, :, 3])

    w = np.maximum(0.0, x2 - x1)
    h = np.maximum(0.0, y2 - y1)
    inter = w * h

    area_a = np.maximum(0.0, a[:, 2] - a[:, 0]) * np.maximum(0.0, a[:, 3] - a[:, 1])
    area_b = np.maximum(0.0, b[:, 2] - b[:, 0]) * np.maximum(0.0, b[:, 3] - b[:, 1])
    union = area_a[:, None] + area_b[None, :] - inter

    return np.where(union > 0, inter / union, 0.0)


def box_center(box: List[int]) -> Tuple[float, float]:
    """Calculate center coordinates (cx, cy) of a bounding box."""
    return (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0


def box_diagonal(box: List[int]) -> float:
    """Calculate diagonal length of a bounding box."""
    w = max(1.0, float(box[2] - box[0]))
    h = max(1.0, float(box[3] - box[1]))
    return float(np.sqrt(w * w + h * h))


def compute_affinity(box_a: List[int], box_b: List[int], is_computer: bool = False) -> float:
    """Compute comprehensive spatial affinity between two bounding boxes in [0.0, 1.0]."""
    w_a = max(0, box_a[2] - box_a[0])
    h_a = max(0, box_a[3] - box_a[1])
    area_a = w_a * h_a

    w_b = max(0, box_b[2] - box_b[0])
    h_b = max(0, box_b[3] - box_b[1])
    area_b = w_b * h_b

    if area_a <= 0 or area_b <= 0:
        return 0.0

    iw = max(0, min(box_a[2], box_b[2]) - max(box_a[0], box_b[0]))
    ih = max(0, min(box_a[3], box_b[3]) - max(box_a[1], box_b[1]))
    inter = iw * ih

    iou = inter / (area_a + area_b - inter) if (area_a + area_b - inter) > 0 else 0.0
    iomin = inter / min(area_a, area_b) if min(area_a, area_b) > 0 else 0.0

    cx_a, cy_a = box_center(box_a)
    cx_b, cy_b = box_center(box_b)
    dist = float(np.hypot(cx_a - cx_b, cy_a - cy_b))
    diag = max(1.0, (box_diagonal(box_a) + box_diagonal(box_b)) / 2.0)

    if is_computer:
        if dist < 40.0:
            return max(iou, 0.70, iomin * 0.85)
        if dist < 60.0 and iomin > 0.35:
            return max(iou, 0.50, iomin * 0.75)
    else:
        if dist < 35.0 and iomin > 0.35:
            return max(iou, 0.55, iomin * 0.75)

    if dist < diag * 0.70:
        return max(iou, iomin * 0.80)

    return float(iou)


def suppress_duplicate_detections(
    detections: List[Dict[str, Any]],
    iou_thresh: float = 0.55,
    iomin_thresh: float = 0.65,
) -> List[Dict[str, Any]]:
    """Suppresses intra-frame duplicate candidate boxes within the same class."""
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



class Track:
    """State and trajectory of an individual tracked object."""

    def __init__(
        self,
        track_id: int,
        class_id: int,
        class_name: str,
        bbox: List[int],
        score: float,
        frame_idx: int = 0,
        min_hits: int = 3,
        display_id: Optional[str] = None,
    ):
        self.track_id = track_id
        self.class_id = class_id
        self.class_name = class_name
        self.display_id = display_id
        self.bbox = [int(v) for v in bbox]
        self.score = float(score)
        self.hits = 1
        self.consecutive_hits = 1
        self.time_since_update = 0
        self.start_frame = frame_idx
        self.last_frame = frame_idx
        self.min_hits = min_hits
        self.state = TrackState.TENTATIVE
        self.is_computer = (class_name.lower() == "computer")
        self.frames_seen: Set[int] = {frame_idx}
        self.centers: List[Tuple[float, float]] = [box_center(self.bbox)]

        if self.hits >= self.min_hits:
            self.state = TrackState.CONFIRMED

    @property
    def is_confirmed(self) -> bool:
        """Returns True if the track has satisfied minimum hit requirements."""
        return self.state == TrackState.CONFIRMED or self.hits >= self.min_hits

    def update(self, bbox: List[int], score: float, frame_idx: int = 0) -> None:
        """Update track state with a matched detection using exponential smoothing."""
        alpha = 0.80 if self.is_computer else 0.70
        self.bbox = [
            int(round(alpha * bbox[i] + (1.0 - alpha) * self.bbox[i]))
            for i in range(4)
        ]
        self.score = float(score)
        self.hits += 1
        self.consecutive_hits += 1
        self.time_since_update = 0
        self.last_frame = frame_idx
        self.frames_seen.add(frame_idx)
        self.centers.append(box_center(self.bbox))
        if len(self.centers) > 60:
            self.centers.pop(0)

        if self.hits >= self.min_hits or (self.is_computer and self.hits >= 2):
            self.state = TrackState.CONFIRMED
        elif self.state == TrackState.LOST:
            self.state = TrackState.CONFIRMED

    def mark_missed(self) -> None:
        """Update state when track is not detected in the current processed frame."""
        self.time_since_update += 1
        self.consecutive_hits = 0
        if self.state == TrackState.CONFIRMED:
            self.state = TrackState.LOST

    def mean_center(self) -> Tuple[float, float]:
        """Compute the average centroid over recent detections."""
        if not self.centers:
            return box_center(self.bbox)
        return float(np.mean([p[0] for p in self.centers])), float(np.mean([p[1] for p in self.centers]))


class ByteTracker:
    """Advanced ByteTrack multi-object tracker with class segregation and tracklet reconciliation."""

    def __init__(
        self,
        high_thresh: float = 0.35,
        low_thresh: float = 0.15,
        match_thresh: float = 0.20,
        max_time_lost: int = 90,
        min_hits: int = 3,
        fps: float = 25.0,
        sample_interval: int = 3,
    ):
        self.high_thresh = float(high_thresh)
        self.low_thresh = float(low_thresh)
        self.match_thresh = float(match_thresh)
        self.min_hits = int(min_hits)
        self.fps = max(1.0, float(fps))
        self.sample_interval = max(1, int(sample_interval))

        effective_lost = int(round((5.0 * self.fps) / self.sample_interval))
        self.max_time_lost = max(max_time_lost, effective_lost)

        self.next_id = 1
        self.tracks: List[Track] = []
        self.computer_anchors: List[Tuple[int, Tuple[float, float], List[int]]] = []
        self.raw_detection_instances: int = 0

        # Independent human-facing display ID namespaces (S01, S02... and C01, C02...)
        self._student_display_map: Dict[int, str] = {}
        self._computer_display_map: Dict[int, str] = {}
        self._next_student_num = 1
        self._next_computer_num = 1

    def get_display_id(
        self,
        track_id: Optional[int],
        class_id: int = 0,
        class_name: str = "student",
    ) -> Optional[str]:
        """Map internal track ID to human-facing display ID (S01, S02... for students, C01, C02... for computers)."""
        if track_id is None:
            return None

        cname_lower = class_name.lower()
        is_computer = (class_id == 1 or cname_lower == "computer")

        if is_computer:
            if track_id not in self._computer_display_map:
                self._computer_display_map[track_id] = f"C{self._next_computer_num:02d}"
                self._next_computer_num += 1
            return self._computer_display_map[track_id]
        else:
            if track_id not in self._student_display_map:
                self._student_display_map[track_id] = f"S{self._next_student_num:02d}"
                self._next_student_num += 1
            return self._student_display_map[track_id]

    def update(self, detections: List[Dict[str, Any]], frame_idx: int = 0) -> List[Dict[str, Any]]:
        """Update tracker with frame detections. Returns detections with assigned track_id."""
        clean_dets = suppress_duplicate_detections(detections)
        self.raw_detection_instances += len(clean_dets)

        if not clean_dets and not self.tracks:
            return []

        all_classes = set(d.get("class_id", 0) for d in clean_dets) | set(
            t.class_id for t in self.tracks if t.state != TrackState.DELETED
        )

        for cid in all_classes:
            is_comp = (cid == 1)
            c_dets = [d for d in clean_dets if d.get("class_id", 0) == cid]

            active_tracks = [
                t for t in self.tracks
                if t.class_id == cid
                and t.state in (TrackState.CONFIRMED, TrackState.TENTATIVE)
                and t.time_since_update == 0
            ]
            lost_tracks = [
                t for t in self.tracks
                if t.class_id == cid
                and t.state == TrackState.LOST
                and t.time_since_update <= self.max_time_lost
            ]

            high_dets = [d for d in c_dets if d.get("confidence", 0.0) >= self.high_thresh]
            low_dets = [
                d for d in c_dets
                if self.low_thresh <= d.get("confidence", 0.0) < self.high_thresh
            ]

            matched_active: Set[int] = set()
            matched_high_dets: Set[int] = set()

            # ------------------------------------------------------------------
            # Stage 1: Match Active Tracks with High-Confidence Detections
            # ------------------------------------------------------------------
            pairs_1 = []
            for t_idx, t in enumerate(active_tracks):
                for d_idx, d in enumerate(high_dets):
                    aff = compute_affinity(t.bbox, d["bbox"], is_comp)
                    if aff >= self.match_thresh:
                        pairs_1.append((aff, t_idx, d_idx))
            pairs_1.sort(key=lambda x: x[0], reverse=True)

            for aff, t_idx, d_idx in pairs_1:
                if t_idx in matched_active or d_idx in matched_high_dets:
                    continue
                matched_active.add(t_idx)
                matched_high_dets.add(d_idx)
                active_tracks[t_idx].update(high_dets[d_idx]["bbox"], high_dets[d_idx]["confidence"], frame_idx)
                high_dets[d_idx]["track_id"] = active_tracks[t_idx].track_id

            # ------------------------------------------------------------------
            # Stage 2: Match LOST Tracks with Remaining High Detections (Reactivation)
            # ------------------------------------------------------------------
            rem_high_indices = [i for i in range(len(high_dets)) if i not in matched_high_dets]
            matched_lost: Set[int] = set()
            pairs_lost = []
            for t_idx, t in enumerate(lost_tracks):
                for d_idx in rem_high_indices:
                    aff = compute_affinity(t.bbox, high_dets[d_idx]["bbox"], is_comp)
                    thresh = self.match_thresh if is_comp else max(self.match_thresh, 0.25)
                    if aff >= thresh:
                        pairs_lost.append((aff, t_idx, d_idx))
            pairs_lost.sort(key=lambda x: x[0], reverse=True)

            for aff, t_idx, d_idx in pairs_lost:
                if t_idx in matched_lost or d_idx in matched_high_dets:
                    continue
                matched_lost.add(t_idx)
                matched_high_dets.add(d_idx)
                lost_tracks[t_idx].update(high_dets[d_idx]["bbox"], high_dets[d_idx]["confidence"], frame_idx)
                lost_tracks[t_idx].state = TrackState.CONFIRMED
                high_dets[d_idx]["track_id"] = lost_tracks[t_idx].track_id

            # ------------------------------------------------------------------
            # Stage 3: Match Remaining Active Tracks with Low-Confidence Detections
            # ------------------------------------------------------------------
            rem_active = [
                t for i, t in enumerate(active_tracks)
                if i not in matched_active and t.state == TrackState.CONFIRMED
            ]
            matched_low_dets: Set[int] = set()
            pairs_low = []
            for t_idx, t in enumerate(rem_active):
                for d_idx, d in enumerate(low_dets):
                    aff = compute_affinity(t.bbox, d["bbox"], is_comp)
                    if aff >= self.match_thresh:
                        pairs_low.append((aff, t_idx, d_idx))
            pairs_low.sort(key=lambda x: x[0], reverse=True)

            for aff, t_idx, d_idx in pairs_low:
                if t_idx in matched_active or d_idx in matched_low_dets:
                    continue
                matched_low_dets.add(d_idx)
                rem_active[t_idx].update(low_dets[d_idx]["bbox"], low_dets[d_idx]["confidence"], frame_idx)
                low_dets[d_idx]["track_id"] = rem_active[t_idx].track_id

            # ------------------------------------------------------------------
            # Stage 4: Stationary Workstation Matching for Computers
            # ------------------------------------------------------------------
            unassigned_high = [high_dets[i] for i in range(len(high_dets)) if i not in matched_high_dets]
            if is_comp:
                for d in unassigned_high:
                    cx, cy = box_center(d["bbox"])
                    for aid, acenter, _ in self.computer_anchors:
                        dist = float(np.hypot(cx - acenter[0], cy - acenter[1]))
                        if dist < 42.0:
                            anchor_track = next((t for t in self.tracks if t.track_id == aid), None)
                            if anchor_track and anchor_track.time_since_update > 0:
                                anchor_track.update(d["bbox"], d["confidence"], frame_idx)
                                anchor_track.state = TrackState.CONFIRMED
                                d["track_id"] = aid
                                break

            # ------------------------------------------------------------------
            # Stage 5: Create New Tentative Tracks for truly unassigned high detections
            # ------------------------------------------------------------------
            for d in unassigned_high:
                if "track_id" not in d:
                    display_id = self.get_display_id(self.next_id, cid, d.get("class_name", "object"))
                    new_track = Track(
                        track_id=self.next_id,
                        class_id=cid,
                        class_name=d.get("class_name", "object"),
                        bbox=d["bbox"],
                        score=d["confidence"],
                        frame_idx=frame_idx,
                        min_hits=self.min_hits,
                        display_id=display_id,
                    )
                    self.next_id += 1
                    d["track_id"] = new_track.track_id
                    d["display_id"] = display_id
                    self.tracks.append(new_track)

            # Update missing track states
            for t in active_tracks:
                if t not in [active_tracks[i] for i in matched_active] and t not in rem_active:
                    t.mark_missed()
                    if t.state == TrackState.TENTATIVE:
                        t.state = TrackState.DELETED

            for t in lost_tracks:
                if t not in [lost_tracks[i] for i in matched_lost]:
                    t.mark_missed()
                    if t.time_since_update > self.max_time_lost:
                        t.state = TrackState.DELETED

            # Register confirmed computer anchors
            if is_comp:
                for t in self.tracks:
                    if t.class_id == 1 and t.is_confirmed and t.hits >= 4:
                        tc = t.mean_center()
                        if not any(np.hypot(tc[0] - a[1][0], tc[1] - a[1][1]) < 35.0 for a in self.computer_anchors):
                            self.computer_anchors.append((t.track_id, tc, t.bbox))

        # Cleanup fully expired tracks
        self.tracks = [t for t in self.tracks if t.state != TrackState.DELETED]

        # Ensure all returned detections have assigned display_id
        for d in clean_dets:
            tid = d.get("track_id")
            if tid is not None and "display_id" not in d:
                d["display_id"] = self.get_display_id(tid, d.get("class_id", 0), d.get("class_name", "object"))

        return clean_dets

    def reconcile_tracklets(self) -> Tuple[int, int, List[List[int]], List[List[int]]]:
        """Reconciles non-overlapping tracklets belonging to the same physical object.

        Returns:
            (reconciled_students_count, reconciled_computers_count, student_groups, computer_groups)
        """
        confirmed_s = [t for t in self.tracks if t.class_id == 0 and t.is_confirmed]
        confirmed_c = [t for t in self.tracks if t.class_id == 1 and t.is_confirmed]

        # Reconcile students: must have ZERO temporal overlap and close spatial centroid
        s_groups: List[List[Track]] = []
        for t in confirmed_s:
            merged = False
            for grp in s_groups:
                overlap = any(bool(t.frames_seen & other.frames_seen) for other in grp)
                if not overlap:
                    tc = t.mean_center()
                    close = any(np.hypot(tc[0] - other.mean_center()[0], tc[1] - other.mean_center()[1]) < 45.0 for other in grp)
                    if close:
                        grp.append(t)
                        merged = True
                        break
            if not merged:
                s_groups.append([t])

        # Reconcile computers: stationary workstations with zero temporal overlap
        c_groups: List[List[Track]] = []
        for t in confirmed_c:
            merged = False
            for grp in c_groups:
                overlap = any(bool(t.frames_seen & other.frames_seen) for other in grp)
                if not overlap:
                    tc = t.mean_center()
                    close = any(np.hypot(tc[0] - other.mean_center()[0], tc[1] - other.mean_center()[1]) < 45.0 for other in grp)
                    if close:
                        grp.append(t)
                        merged = True
                        break
            if not merged:
                c_groups.append([t])

        s_id_groups = [[t.track_id for t in grp] for grp in s_groups]
        c_id_groups = [[t.track_id for t in grp] for grp in c_groups]

        return len(s_groups), len(c_groups), s_id_groups, c_id_groups

    def build_canonical_display_id_map(self) -> Dict[int, str]:
        """Resolve final canonical display IDs for all reconciled tracklets across the entire video.

        Ensures merged tracklets map to the same canonical display ID (S01, S02... / C01, C02...).
        Entities are ordered chronologically by their earliest appearance frame.
        """
        _, _, s_groups, c_groups = self.reconcile_tracklets()
        canonical_map: Dict[int, str] = {}
        all_tracks_by_id = {t.track_id: t for t in self.tracks}

        def group_start_frame(grp_ids: List[int]) -> int:
            return min((all_tracks_by_id[tid].start_frame for tid in grp_ids if tid in all_tracks_by_id), default=0)

        # Sort student groups by earliest appearance
        s_groups_sorted = sorted(s_groups, key=group_start_frame)
        for idx, grp in enumerate(s_groups_sorted):
            cid = f"S{idx + 1:02d}"
            for tid in grp:
                canonical_map[tid] = cid
                self._student_display_map[tid] = cid

        # Sort computer groups by earliest appearance
        c_groups_sorted = sorted(c_groups, key=group_start_frame)
        for idx, grp in enumerate(c_groups_sorted):
            cid = f"C{idx + 1:02d}"
            for tid in grp:
                canonical_map[tid] = cid
                self._computer_display_map[tid] = cid

        # Fallback for any active tracks not grouped
        for t in self.tracks:
            if t.track_id not in canonical_map:
                canonical_map[t.track_id] = self.get_display_id(t.track_id, t.class_id, t.class_name)

        return canonical_map

    def apply_canonical_mapping(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Applies canonical reconciled display IDs to a list of detection dictionaries."""
        canonical_map = self.build_canonical_display_id_map()
        for d in detections:
            tid = d.get("track_id")
            if tid is not None and tid in canonical_map:
                d["display_id"] = canonical_map[tid]
            elif tid is not None:
                d["display_id"] = self.get_display_id(tid, d.get("class_id", 0), d.get("class_name", "object"))
        return detections

    def get_unique_counts(self) -> Tuple[int, int]:
        """Return (estimated_unique_students, estimated_unique_computers) across the video."""
        u_s, u_c, _, _ = self.reconcile_tracklets()
        return u_s, u_c

    def get_diagnostics(self) -> Dict[str, Any]:
        """Return diagnostic metrics on tracking lifecycle and deduplication efficiency."""
        u_s, u_c, s_grps, c_grps = self.reconcile_tracklets()
        canonical_map = self.build_canonical_display_id_map()
        confirmed_s = [t for t in self.tracks if t.class_id == 0 and t.is_confirmed]
        confirmed_c = [t for t in self.tracks if t.class_id == 1 and t.is_confirmed]

        student_ids = sorted(list(set(canonical_map[tid] for grp in s_grps for tid in grp if tid in canonical_map)))
        computer_ids = sorted(list(set(canonical_map[tid] for grp in c_grps for tid in grp if tid in canonical_map)))

        return {
            "total_tracker_ids_created": self.next_id - 1,
            "raw_detection_instances": self.raw_detection_instances,
            "confirmed_student_tracklets": len(confirmed_s),
            "confirmed_computer_tracklets": len(confirmed_c),
            "estimated_unique_students": u_s,
            "estimated_unique_computers": u_c,
            "student_tracklet_groups": s_grps,
            "computer_tracklet_groups": c_grps,
            "canonical_display_ids": canonical_map,
            "student_display_ids": student_ids,
            "computer_display_ids": computer_ids,
            "active_computer_anchors": len(self.computer_anchors),
            "tracking_method": "ByteTrack (Multi-Stage + Workstation Anchored)",
        }

