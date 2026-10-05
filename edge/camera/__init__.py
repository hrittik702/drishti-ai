"""Camera abstraction layer for SIH26190 Edge Processing."""

from edge.camera.base import CameraSource
from edge.camera.usb_camera import USBCamera
from edge.camera.video_file import VideoFile

__all__ = ["CameraSource", "USBCamera", "VideoFile"]
