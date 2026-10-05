"""RT-DETRv2-S model loading and verification."""

import os
import sys
import logging
from typing import Tuple, Any

logger = logging.getLogger("edge.inference.loader")


class ModelLoader:
    """Loads and initializes RT-DETRv2-S model and preprocessor."""

    @staticmethod
    def load_rtdetr_v2(
        model_path: str = "PekingU/rtdetr_v2_r18vd",
        device: str = "cpu"
    ) -> Tuple[Any, Any]:
        """Load RT-DETRv2-S model and processor.
        
        Args:
            model_path: Hugging Face model ID or path to local checkpoint directory.
            device: 'cpu' or 'cuda'.
            
        Returns:
            Tuple[model, processor]
            
        Raises:
            RuntimeError: If model cannot be loaded with clear diagnostic info.
        """
        logger.info(f"Loading RT-DETRv2-S from '{model_path}' on device '{device}'...")

        try:
            import torch
            from transformers import RTDetrV2ForObjectDetection, RTDetrImageProcessor
        except ImportError as e:
            err_msg = (
                f"\n{'='*60}\n"
                f"ERROR: Missing PyTorch or Transformers dependencies.\n"
                f"Please ensure packages from requirements-edge.txt are installed.\n"
                f"Details: {e}\n"
                f"{'='*60}\n"
            )
            print(err_msg, file=sys.stderr)
            raise RuntimeError(err_msg) from e

        # If a local path is specified, check existence
        if os.path.isabs(model_path) or os.path.exists(model_path):
            if not os.path.exists(model_path):
                err_msg = (
                    f"\n{'='*60}\n"
                    f"ERROR: RT-DETRv2-S model could not be loaded.\n"
                    f"Expected model path: {model_path}\n"
                    f"Local weights directory does not exist.\n"
                    f"{'='*60}\n"
                )
                print(err_msg, file=sys.stderr)
                raise RuntimeError(err_msg)

        try:
            processor = RTDetrImageProcessor.from_pretrained(model_path)
            model = RTDetrV2ForObjectDetection.from_pretrained(model_path)
            model.to(device)
            model.eval()
            logger.info("RT-DETRv2-S model loaded successfully.")
            return model, processor
        except Exception as e:
            err_msg = (
                f"\n{'='*60}\n"
                f"ERROR: RT-DETRv2-S model could not be loaded.\n"
                f"Expected model path: {model_path}\n"
                f"Device: {device}\n"
                f"Error details: {str(e)}\n"
                f"{'='*60}\n"
            )
            print(err_msg, file=sys.stderr)
            raise RuntimeError(err_msg) from e
