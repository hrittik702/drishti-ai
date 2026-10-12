"""Model Adapter factory for selecting and managing detection backends."""

from typing import Optional
from backend.config import settings
from backend.adapters.base import BaseModelAdapter
from backend.adapters.mock_adapter import MockModelAdapter
from backend.adapters.rtdetr_adapter import PyTorchRTDETRAdapter
from backend.adapters.paddle_adapter import PaddleDetectionAdapter
from backend.adapters.sih_onnx_adapter import SIHONNXAdapter


_active_adapter: Optional[BaseModelAdapter] = None


def get_model_adapter(mode: Optional[str] = None) -> BaseModelAdapter:
    """Return the singleton model adapter based on configuration or explicit mode parameter."""
    global _active_adapter

    requested_mode = (mode or settings.MODEL_MODE).lower()

    if _active_adapter is not None and _active_adapter.model_mode == requested_mode:
        return _active_adapter

    # Close previous adapter if switching modes
    if _active_adapter is not None:
        _active_adapter.close()
        _active_adapter = None

    if requested_mode in ("sih", "onnx", "rtdetr"):
        _active_adapter = SIHONNXAdapter(
            model_path=str(settings.SIH_ONNX_MODEL_PATH),
            confidence_threshold=settings.CONFIDENCE_THRESHOLD,
        )
    elif requested_mode == "mock":
        _active_adapter = MockModelAdapter()
    elif requested_mode == "pytorch":
        _active_adapter = PyTorchRTDETRAdapter(
            model_path=settings.PYTORCH_MODEL_PATH,
            device=settings.DEVICE,
            confidence_threshold=settings.CONFIDENCE_THRESHOLD
        )
    elif requested_mode == "paddle":
        _active_adapter = PaddleDetectionAdapter()
    else:
        raise ValueError(f"Unknown MODEL_MODE '{requested_mode}'. Supported modes: 'sih', 'mock', 'pytorch', 'paddle'.")

    return _active_adapter
