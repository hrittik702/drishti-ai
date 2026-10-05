"""Visual annotation and HUD telemetry overlay for SIH26190."""

from typing import List, Dict, Any, Optional
import cv2
import numpy as np


class VisualAnnotator:
    """Renders person detection bounding boxes, badges, and runtime HUD telemetry."""

    # Color palette (BGR)
    BOX_COLOR = (46, 204, 113)        # Emerald green
    BADGE_BG_COLOR = (39, 174, 96)    # Darker emerald
    HUD_BG_COLOR = (24, 28, 36)       # Slate navy
    HUD_BORDER_COLOR = (52, 73, 94)   # Subtle slate border
    TEXT_COLOR = (255, 255, 255)      # White
    ACCENT_COLOR = (52, 152, 219)     # Soft blue
    ALERT_COLOR = (231, 76, 60)       # Red for offline / warnings

    def __init__(self, font_scale: float = 0.55, thickness: int = 2):
        self.font = cv2.FONT_HERSHEY_SIMPLEX
        self.font_scale = font_scale
        self.thickness = thickness

    def annotate(
        self,
        frame_bgr: np.ndarray,
        detections: List[Dict[str, Any]],
        fps: float,
        inference_ms: float,
        camera_info: str = "USB 0",
        model_name: str = "RT-DETRv2-S",
        status: str = "PROCESSING"
    ) -> np.ndarray:
        """Annotate frame with person bounding boxes and HUD bar.
        
        Args:
            frame_bgr: Raw input frame.
            detections: List of detection dicts with 'class', 'confidence', 'bbox'.
            fps: Current measured processing FPS.
            inference_ms: Inference duration in milliseconds.
            camera_info: Description of camera source (e.g., 'USB 0').
            model_name: Model identifier (default 'RT-DETRv2-S').
            status: Operating state ('PROCESSING', 'STANDBY', etc.).
            
        Returns:
            np.ndarray: Annotated output frame.
        """
        output = frame_bgr.copy()
        height, width = output.shape[:2]

        # 1. Draw person bounding boxes and badges
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            conf = det["confidence"]
            label_text = f"PERSON {conf:.2f}"

            # Draw outer bounding box
            cv2.rectangle(output, (x1, y1), (x2, y2), self.BOX_COLOR, self.thickness)

            # Draw corner accents for high-tech HUD aesthetic
            corner_len = min(20, max(8, int((x2 - x1) * 0.2)))
            # Top-left
            cv2.line(output, (x1, y1), (x1 + corner_len, y1), self.ACCENT_COLOR, self.thickness + 1)
            cv2.line(output, (x1, y1), (x1, y1 + corner_len), self.ACCENT_COLOR, self.thickness + 1)
            # Top-right
            cv2.line(output, (x2, y1), (x2 - corner_len, y1), self.ACCENT_COLOR, self.thickness + 1)
            cv2.line(output, (x2, y1), (x2, y1 + corner_len), self.ACCENT_COLOR, self.thickness + 1)
            # Bottom-left
            cv2.line(output, (x1, y2), (x1 + corner_len, y2), self.ACCENT_COLOR, self.thickness + 1)
            cv2.line(output, (x1, y2), (x1, y2 - corner_len), self.ACCENT_COLOR, self.thickness + 1)
            # Bottom-right
            cv2.line(output, (x2, y2), (x2 - corner_len, y2), self.ACCENT_COLOR, self.thickness + 1)
            cv2.line(output, (x2, y2), (x2, y2 - corner_len), self.ACCENT_COLOR, self.thickness + 1)

            # Label badge
            (t_w, t_h), baseline = cv2.getTextSize(label_text, self.font, self.font_scale, 1)
            badge_y1 = max(0, y1 - t_h - 10)
            badge_y2 = y1
            badge_x2 = min(width, x1 + t_w + 12)

            cv2.rectangle(output, (x1, badge_y1), (badge_x2, badge_y2), self.BADGE_BG_COLOR, -1)
            cv2.putText(
                output,
                label_text,
                (x1 + 6, y1 - 5),
                self.font,
                self.font_scale,
                self.TEXT_COLOR,
                1,
                cv2.LINE_AA
            )

        # 2. Render bottom HUD status bar
        hud_height = 42
        hud_y1 = height - hud_height
        hud_overlay = output.copy()
        cv2.rectangle(hud_overlay, (0, hud_y1), (width, height), self.HUD_BG_COLOR, -1)
        # 85% alpha blending for professional semi-transparency
        cv2.addWeighted(hud_overlay, 0.88, output, 0.12, 0, output)
        cv2.line(output, (0, hud_y1), (width, hud_y1), self.HUD_BORDER_COLOR, 1)

        # Format telemetry metrics
        person_count = len(detections)
        metrics = [
            f"FPS: {fps:4.1f}",
            f"Persons: {person_count}",
            f"Inference: {inference_ms:4.1f} ms",
            f"Camera: {camera_info}",
            f"Model: {model_name}",
            f"Status: {status}"
        ]

        # Draw metrics spaced across HUD bar
        text_y = height - 14
        step = max(110, width // (len(metrics) + 1))
        for idx, text in enumerate(metrics):
            pos_x = 15 + idx * step
            # Color status green if active
            color = self.BOX_COLOR if "PROCESSING" in text else self.TEXT_COLOR
            cv2.putText(
                output,
                text,
                (pos_x, text_y),
                self.font,
                0.46,
                color,
                1,
                cv2.LINE_AA
            )

        return output
