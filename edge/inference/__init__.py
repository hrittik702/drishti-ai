"""Inference and model loading layer for RT-DETRv2-S detection."""

from edge.inference.model_loader import ModelLoader
from edge.inference.detector import PersonDetector, RTDETRDetector, load_detector

__all__ = ["ModelLoader", "PersonDetector", "RTDETRDetector", "load_detector"]

