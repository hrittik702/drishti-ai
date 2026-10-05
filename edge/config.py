"""Configuration management for SIH26190 Edge Processing Pipeline."""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class EdgeConfig:
    """Configuration options for edge camera capture, inference, and display."""
    source: str = "usb"                     # "usb" | "video"
    camera_index: int = 0                  # V4L2 / USB device index (e.g., 0 for /dev/video0)
    video_path: Optional[str] = None       # Path to test video if source is "video"
    width: int = 1280                      # Capture frame width
    height: int = 720                      # Capture frame height
    fps: int = 30                          # Target capture FPS
    model_path: str = os.environ.get(
        "MODEL_PATH", "PekingU/rtdetr_v2_r18vd"
    )                                      # Checkpoint name or local weights directory
    confidence_threshold: float = 0.40     # Detection confidence threshold
    device: str = "cpu"                    # "cpu" | "cuda"
    display: bool = True                   # Show OpenCV UI window
    window_title: str = "SIH26190 - Edge AI Person Detection (RT-DETRv2-S)"
    save_output: Optional[str] = None      # Optional MP4 output path
    camera_id: str = "CAM-01"              # Identifier for downstream compliance event stream
