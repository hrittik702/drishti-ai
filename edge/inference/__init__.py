"""Inference and model loading layer for RT-DETRv2-S person detection."""

from edge.inference.model_loader import ModelLoader
from edge.inference.detector import PersonDetector

__all__ = ["ModelLoader", "PersonDetector"]
