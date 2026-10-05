"""USB Camera capture implementation using OpenCV."""

import glob
import logging
import sys
from typing import Tuple, Optional, Dict, Any, List
import cv2
import numpy as np

from edge.camera.base import CameraSource

logger = logging.getLogger("edge.camera.usb")


def get_available_camera_indexes() -> List[int]:
    """Scan the system for available video devices (/dev/video* on Linux, or indexes 0-5)."""
    available = []
    # Check Linux /dev/video* devices first
    v4l_devices = sorted(glob.glob("/dev/video*"))
    if v4l_devices:
        for dev in v4l_devices:
            try:
                idx = int(dev.replace("/dev/video", ""))
                # Quick test without locking
                cap = cv2.VideoCapture(idx)
                if cap.isOpened():
                    available.append(idx)
                cap.release()
            except Exception:
                continue
    else:
        # Fallback probe for non-Linux or virtual environments
        for idx in range(4):
            cap = cv2.VideoCapture(idx)
            if cap.isOpened():
                available.append(idx)
            cap.release()
    return available


class USBCamera(CameraSource):
    """USB / V4L2 physical camera input layer."""

    def __init__(
        self,
        camera_index: int = 0,
        width: int = 1280,
        height: int = 720,
        fps: int = 30,
        max_retries: int = 3
    ):
        self.camera_index = camera_index
        self.target_width = width
        self.target_height = height
        self.target_fps = fps
        self.max_retries = max_retries

        self._cap: Optional[cv2.VideoCapture] = None
        self._consecutive_failures = 0

    def open(self) -> bool:
        """Open the USB camera and set hardware capture properties."""
        if self._cap is not None and self._cap.isOpened():
            return True

        logger.info(f"Opening USB camera at index {self.camera_index}...")
        self._cap = cv2.VideoCapture(self.camera_index)

        if not self._cap.isOpened():
            available = get_available_camera_indexes()
            avail_str = ", ".join(str(idx) for idx in available) if available else "None detected"
            err_msg = (
                f"\n{'='*60}\n"
                f"ERROR: Unable to open USB camera at index {self.camera_index}.\n"
                f"Available camera indexes should be checked.\n"
                f"Detected system camera index(es): [{avail_str}]\n"
                f"Camera initialization failed.\n"
                f"Camera index: {self.camera_index}\n"
                f"{'='*60}\n"
            )
            print(err_msg, file=sys.stderr)
            logger.error(err_msg)
            self._cap = None
            return False

        # Configure camera capture properties
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.target_width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.target_height)
        self._cap.set(cv2.CAP_PROP_FPS, self.target_fps)

        # Read back actual configured properties
        actual_w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = self._cap.get(cv2.CAP_PROP_FPS)

        logger.info(
            f"USB camera {self.camera_index} initialized successfully: "
            f"{actual_w}x{actual_h} @ {actual_fps:.1f} FPS"
        )
        self._consecutive_failures = 0
        return True

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Read frame with transient error recovery."""
        if not self.is_opened():
            if not self.open():
                return False, None

        ret, frame = self._cap.read()
        if not ret or frame is None:
            self._consecutive_failures += 1
            logger.warning(
                f"Frame read failure on USB camera {self.camera_index} "
                f"({self._consecutive_failures}/{self.max_retries})"
            )
            if self._consecutive_failures <= self.max_retries:
                # Attempt quick recovery read
                ret, frame = self._cap.read()
                if ret and frame is not None:
                    self._consecutive_failures = 0
                    return True, frame
            return False, None

        self._consecutive_failures = 0
        return True, frame

    def release(self) -> None:
        """Release the camera hardware device cleanly."""
        if self._cap is not None:
            logger.info(f"Releasing USB camera device {self.camera_index}...")
            try:
                self._cap.release()
            except Exception as e:
                logger.warning(f"Error during camera release: {e}")
            self._cap = None

    def is_opened(self) -> bool:
        """Return True if capture is active."""
        return self._cap is not None and self._cap.isOpened()

    def get_info(self) -> Dict[str, Any]:
        """Return diagnostic properties of the active USB camera."""
        if not self.is_opened():
            return {
                "source": "usb",
                "camera_index": self.camera_index,
                "status": "OFFLINE",
                "width": 0,
                "height": 0,
                "fps": 0.0
            }
        return {
            "source": "usb",
            "camera_index": self.camera_index,
            "status": "ONLINE",
            "width": int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": float(self._cap.get(cv2.CAP_PROP_FPS))
        }
