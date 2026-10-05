"""Abstract base class for all camera input sources."""

from abc import ABC, abstractmethod
from typing import Tuple, Optional, Dict, Any
import numpy as np


class CameraSource(ABC):
    """Abstract CameraSource interface for USB, Video File, RTSP, and IP camera feeds."""

    @abstractmethod
    def open(self) -> bool:
        """Open the camera capture device or stream."""
        pass

    @abstractmethod
    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Read a single frame from the camera source.
        
        Returns:
            Tuple[bool, Optional[np.ndarray]]: (success, frame_bgr)
        """
        pass

    @abstractmethod
    def release(self) -> None:
        """Release camera hardware resources cleanly."""
        pass

    @abstractmethod
    def is_opened(self) -> bool:
        """Check if the capture stream is open and healthy."""
        pass

    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """Return diagnostic properties of the camera stream."""
        pass

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()
