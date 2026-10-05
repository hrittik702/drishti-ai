"""Video file camera source for offline development, benchmarking, and demo testing."""

import os
import sys
import logging
from typing import Tuple, Optional, Dict, Any
import cv2
import numpy as np

from edge.camera.base import CameraSource

logger = logging.getLogger("edge.camera.video")


class VideoFile(CameraSource):
    """Video file playback source implementing the CameraSource interface."""

    def __init__(self, video_path: str, loop: bool = True):
        self.video_path = video_path
        self.loop = loop
        self._cap: Optional[cv2.VideoCapture] = None
        self._total_frames = 0
        self._fps = 30.0

    def open(self) -> bool:
        """Open the video file for reading."""
        if self._cap is not None and self._cap.isOpened():
            return True

        if not os.path.exists(self.video_path):
            err_msg = (
                f"\n{'='*60}\n"
                f"ERROR: Video file not found: {self.video_path}\n"
                f"Please verify the file path.\n"
                f"{'='*60}\n"
            )
            print(err_msg, file=sys.stderr)
            logger.error(err_msg)
            return False

        logger.info(f"Opening video file: {self.video_path}...")
        self._cap = cv2.VideoCapture(self.video_path)

        if not self._cap.isOpened():
            err_msg = (
                f"\n{'='*60}\n"
                f"ERROR: Unable to decode video file: {self.video_path}\n"
                f"{'='*60}\n"
            )
            print(err_msg, file=sys.stderr)
            logger.error(err_msg)
            self._cap = None
            return False

        self._total_frames = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self._fps = self._cap.get(cv2.CAP_PROP_FPS) or 30.0
        logger.info(
            f"Video file opened successfully: "
            f"{int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))} "
            f"({self._total_frames} frames @ {self._fps:.1f} FPS)"
        )
        return True

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Read next frame, automatically looping if enabled."""
        if not self.is_opened():
            if not self.open():
                return False, None

        ret, frame = self._cap.read()
        if not ret or frame is None:
            if self.loop:
                # Rewind to start of video
                self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self._cap.read()
                if ret and frame is not None:
                    return True, frame
            return False, None

        return True, frame

    def release(self) -> None:
        """Release video file reader."""
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def is_opened(self) -> bool:
        """Check if video file capture is open."""
        return self._cap is not None and self._cap.isOpened()

    def get_info(self) -> Dict[str, Any]:
        """Return properties of the loaded video file."""
        if not self.is_opened():
            return {"source": "video", "status": "OFFLINE", "path": self.video_path}
        return {
            "source": "video",
            "status": "ONLINE",
            "path": self.video_path,
            "width": int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": float(self._fps),
            "total_frames": self._total_frames
        }
