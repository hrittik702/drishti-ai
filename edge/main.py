"""CLI entry point for SIH26190 Edge AI Person Detection."""

import argparse
import logging
import os
import signal
import sys
import cv2

from edge.config import EdgeConfig
from edge.camera.usb_camera import USBCamera
from edge.camera.video_file import VideoFile
from edge.inference.model_loader import ModelLoader
from edge.inference.detector import PersonDetector
from edge.processing.annotator import VisualAnnotator
from edge.processing.pipeline import ProcessingPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("edge.main")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SIH26190 M1: Real Camera Input + RT-DETRv2-S Person Detection Pipeline"
    )
    parser.add_argument(
        "--source",
        choices=["usb", "video"],
        default="usb",
        help="Input camera source type (default: usb)"
    )
    parser.add_argument(
        "--camera-index",
        type=int,
        default=0,
        help="Camera device index for USB camera (default: 0)"
    )
    parser.add_argument(
        "--path", "--video-path",
        dest="video_path",
        type=str,
        default=None,
        help="Path to video file when --source is video"
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1280,
        help="Target frame capture width (default: 1280)"
    )
    parser.add_argument(
        "--height",
        type=int,
        default=720,
        help="Target frame capture height (default: 720)"
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=30,
        help="Target camera FPS (default: 30)"
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=os.environ.get("MODEL_PATH", "PekingU/rtdetr_v2_r18vd"),
        help="Path or HuggingFace ID for RT-DETRv2-S model (default: PekingU/rtdetr_v2_r18vd)"
    )
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.40,
        help="Person detection confidence threshold [0.0 - 1.0] (default: 0.40)"
    )
    parser.add_argument(
        "--device",
        choices=["cpu", "cuda"],
        default="cpu",
        help="Inference compute device (default: cpu)"
    )
    parser.add_argument(
        "--no-display",
        dest="display",
        action="store_false",
        default=True,
        help="Disable live OpenCV preview window (useful for headless / server mode)"
    )
    parser.add_argument(
        "--save-output",
        type=str,
        default=None,
        help="Optional path to save annotated output video (.mp4)"
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help="Maximum frames to process before exiting (useful for automated testing / benchmarks)"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    config = EdgeConfig(
        source=args.source,
        camera_index=args.camera_index,
        video_path=args.video_path,
        width=args.width,
        height=args.height,
        fps=args.fps,
        model_path=args.model_path,
        confidence_threshold=args.confidence,
        device=args.device,
        display=args.display,
        save_output=args.save_output
    )

    print(f"\n{'='*65}")
    print("  SIH26190 — M1: Real Camera Input + Edge AI Processing")
    print(f"  Source: {config.source.upper()} | Model: RT-DETRv2-S ({config.model_path})")
    print(f"  Target Resolution: {config.width}x{config.height} | Device: {config.device}")
    print(f"  Confidence Threshold: {config.confidence_threshold:.2f}")
    print(f"{'='*65}\n")

    # 1. Initialize Camera Source
    if config.source == "usb":
        camera = USBCamera(
            camera_index=config.camera_index,
            width=config.width,
            height=config.height,
            fps=config.fps
        )
    elif config.source == "video":
        if not config.video_path:
            print("ERROR: --path / --video-path is required when --source is 'video'.", file=sys.stderr)
            sys.exit(1)
        camera = VideoFile(video_path=config.video_path, loop=True)
    else:
        print(f"ERROR: Unsupported camera source: {config.source}", file=sys.stderr)
        sys.exit(1)

    if not camera.open():
        print(f"\nCamera initialization failed.\nCamera index: {config.camera_index}", file=sys.stderr)
        sys.exit(1)

    # 2. Load RT-DETRv2-S Model
    try:
        model, processor = ModelLoader.load_rtdetr_v2(
            model_path=config.model_path,
            device=config.device
        )
    except Exception as e:
        print(f"\nRT-DETRv2-S model could not be loaded.\nExpected model path: {config.model_path}", file=sys.stderr)
        camera.release()
        sys.exit(1)

    # 3. Setup Detector and Pipeline
    detector = PersonDetector(
        model=model,
        processor=processor,
        device=config.device,
        confidence_threshold=config.confidence_threshold
    )
    annotator = VisualAnnotator()
    pipeline = ProcessingPipeline(
        camera=camera,
        detector=detector,
        annotator=annotator,
        config=config
    )

    # Setup Video Writer if requested
    video_writer = None
    if config.save_output:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        video_writer = cv2.VideoWriter(
            config.save_output, fourcc, float(config.fps), (config.width, config.height)
        )
        logger.info(f"Saving annotated output to: {config.save_output}")

    # Graceful exit handler
    running = True

    def handle_signal(sig, frame):
        nonlocal running
        print("\nInterrupt received. Stopping processing pipeline...")
        running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    print("Pipeline active. Press 'Q' or 'ESC' in preview window, or Ctrl+C in terminal to stop.")

    frames_processed = 0
    try:
        while running:
            success, annotated_frame, event = pipeline.read_and_process()
            if not success or annotated_frame is None:
                logger.warning("Frame read failure or stream ended.")
                break

            frames_processed += 1

            # Log periodic summary
            if frames_processed % 30 == 0:
                print(
                    f"Frame {frames_processed:05d} | "
                    f"Persons: {event['detected_persons']} | "
                    f"FPS: {event['fps']:.1f} | "
                    f"Inference: {event['inference_ms']:.1f}ms"
                )

            if video_writer is not None:
                video_writer.write(annotated_frame)

            if config.display:
                cv2.imshow(config.window_title, annotated_frame)
                key = cv2.waitKey(1) & 0xFF
                # 'q' or 'Q' or ESC (27)
                if key in (ord('q'), ord('Q'), 27):
                    print("\nExit key pressed by user.")
                    break

            if args.max_frames and frames_processed >= args.max_frames:
                print(f"Reached max frames limit ({args.max_frames}). Stopping.")
                break

    finally:
        # Guarantee resources are cleaned up
        print("\nCleaning up pipeline resources...")
        if video_writer is not None:
            video_writer.release()
        camera.release()
        if config.display:
            cv2.destroyAllWindows()
        print(f"Pipeline closed cleanly. Total frames processed: {frames_processed}")


if __name__ == "__main__":
    main()
