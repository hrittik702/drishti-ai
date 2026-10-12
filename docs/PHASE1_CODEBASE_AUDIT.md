# Phase 1: Codebase Audit & AI Inference Analysis Report

**Project Title**: AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance  
**SIH Problem Statement**: SIH26190  
**Phase**: Phase 1 — Codebase Audit, AI Inference Remediation & Integration Readiness  
**Date**: October 2026  
**Auditor**: Antigravity AI Engineering Assistant  

---

## 1. Executive Summary & Audit Context

This document records the exhaustive audit of the Smart India Hackathon (SIH 2026) prototype repository (`hrittik702/Case-Guard`). The project aims to provide automated, privacy-preserving monitoring of training centres under schemes such as PMKVY by detecting trainee presence (for aggregate attendance estimation) and equipment presence (for infrastructure compliance verification) using existing CCTV and camera feeds.

Prior project documentation reported a trained model using:
- **Architecture**: RT-DETRv2-R18
- **Framework**: PaddlePaddle / PaddleDetection 2.9
- **Reported Classes**: `0: student`, `1: computer`
- **Reported Weights**: `PaddleDetection/output/model_final.pdparams`
- **Reported Config**: `PaddleDetection/configs/rtdetrv2/rtdetrv2_r18vd_sih.yml`
- **Reported Training Setup**: NVIDIA RTX 3050 Laptop GPU (6 GB VRAM), Python 3.10, CVAT annotations in COCO JSON format.
- **Reported Evaluation Metrics**: Held-out test mAP@0.50:0.95 = 75.5%, AP@0.50 = 95.9%, AP small = 2.9%, Student AP = 78.3%, Computer AP = 72.6%. The report noted weak domain generalization on real CCTV test footage (requiring low thresholds ~0.02, leading to false positives).

### Primary Audit Finding: Reality vs. Reported Documentation
A physical filesystem and dependency audit reveals that **no PaddleDetection files, `.pdparams` weights, or PaddlePaddle libraries exist in the repository or on the host machine**:
1. **Directory absence**: There is no `PaddleDetection/` folder anywhere in the repository.
2. **Checkpoint absence**: `PaddleDetection/output/model_final.pdparams` does not exist. The root `models/` directory exists but is empty.
3. **Configuration absence**: `rtdetrv2_r18vd_sih.yml` does not exist in the repository, git history, or git reflog.
4. **Targeted local search**: Targeted scans across local directories (`/home/mocha/Desktop/SIH PROTOTYPE`, `REC-Labs`, `models/`, `Downloads`, `Documents`) found zero `.pdparams` weight files.
5. **Environment reality**: The Python virtual environment (`.venv`) runs Python 3.12.3 with PyTorch 2.6.0+cpu and HuggingFace Transformers 5.18.0. Neither `paddle` nor `paddledet` is installed (`ModuleNotFoundError: No module named 'paddle'`).
6. **Hardware reality**: The current host machine is an Intel Core processor with Raptor Lake-P Iris Xe integrated graphics (`00:02.0 Intel Corporation Raptor Lake-P [Iris Xe Graphics]`). No discrete NVIDIA GPU or CUDA runtime (`nvidia-smi`) is present.
7. **Actual AI Implementation**: An Edge AI processing pipeline was implemented under `edge/` using PyTorch and HuggingFace Transformers (`RTDetrV2ForObjectDetection`, `RTDetrImageProcessor`) targeting the official `PekingU/rtdetr_v2_r18vd` checkpoint (cached locally in `~/.cache/huggingface/hub/`).

### Model Selection Decision: Case B (Custom Checkpoint Unavailable)
In strict accordance with the project guidelines:
- We do **not** fabricate weights, download unverified third-party checkpoints, or claim to reproduce the 75.5% mAP benchmark.
- We adopt **`PekingU/rtdetr_v2_r18vd` as the explicitly identified temporary generic COCO baseline**.
- The missing custom model checkpoint remains recorded as an **unresolved external dependency (BLOCKED)**.
- Authentic class vocabularies are preserved: the generic baseline outputs COCO labels (`person`, `laptop`, `tvmonitor`, `chair`). We do **not** silently alias `person` to `student` or combine `laptop`/`tvmonitor` into `computer`.

---

## 2. Verified Repository Structure & File Map

```text
/home/mocha/Desktop/SIH PROTOTYPE/
├── docs/                                  # Phase 1 Deliverables & Technical Specs
│   ├── PHASE1_CODEBASE_AUDIT.md           # This audit document
│   └── INFERENCE_INTEGRATION_SPEC.md      # Backend contract and schema spec
├── edge/                                  # Edge AI Vision Processing Module
│   ├── __init__.py                        # Module definition
│   ├── camera/                            # Camera Capture Abstraction Layer
│   │   ├── __init__.py                    # Camera module exports
│   │   ├── base.py                        # CameraSource abstract base class (read/open/release)
│   │   ├── usb_camera.py                  # Physical USB/V4L2 camera capture with index auto-scan
│   │   └── video_file.py                  # Video file source with auto-loop rewind
│   ├── inference/                         # AI Model Inference Layer
│   │   ├── __init__.py                    # Exports ModelLoader, RTDETRDetector, PersonDetector, load_detector
│   │   ├── model_loader.py                # Hugging Face RT-DETRv2-S loader with diagnostic errors
│   │   └── detector.py                    # Reusable RTDETRDetector & PersonDetector (Standardized Contract)
│   ├── processing/                        # Stream Orchestration & Visual Overlays
│   │   ├── __init__.py                    # Processing module exports
│   │   ├── annotator.py                   # Bounding box rendering & semi-transparent HUD status bar
│   │   └── pipeline.py                    # ProcessingPipeline (capture + detect + annotate + JSON event)
│   ├── tests/                             # Self-Contained Automated Verification
│   │   └── test_edge_pipeline.py          # Standalone assert-based test suite (no external frameworks)
│   ├── config.py                          # EdgeConfig dataclass (source, resolution, FPS, confidence, device)
│   └── main.py                            # CLI entry point for live camera/video streaming
├── Frontend/                              # React + Vite Compliance Dashboard
│   ├── src/                               # UI components, RBAC, Dual-Persistence, OCR, Audit Log
│   ├── tests/                             # 83 passing automated unit and integration tests
│   ├── package.json                       # Frontend dependencies and npm scripts
│   └── vite.config.js                     # Vite build configuration
├── models/                                # Directory reserved for local weights (currently empty)
├── .venv/                                 # Python virtual environment (Python 3.12.3, PyTorch CPU)
├── requirements-edge.txt                  # Python dependencies for edge service
├── README.md                              # Repository overview and execution guide
└── implementation_plan.md                 # Antigravity Phase 1 implementation plan
```

---

## 3. Environment, Dependencies & Hardware Findings

### Operating System & Hardware Telemetry
- **OS**: Linux 7.1.5-76070105-generic (Pop!_OS / Ubuntu 24.04 LTS), x86_64 architecture.
- **CPU**: Intel Core processor (Raptor Lake-P architecture).
- **GPU**: Intel Iris Xe Integrated Graphics (`VGA compatible controller: Intel Corporation Raptor Lake-P`).
- **Discrete GPU**: None. No NVIDIA RTX 3050 Laptop GPU detected; `nvidia-smi` command not found.
- **Video Devices**: System exposes `/dev/video0` and `/dev/video1`.

### Python Environment (`.venv`)
- **Python Version**: 3.12.3
- **PyTorch**: `torch 2.6.0+cpu`, `torchvision 0.21.0+cpu`
- **HuggingFace Transformers**: `transformers 5.18.0`
- **Computer Vision**: `opencv-python 5.0.0.93`, `pillow 12.3.0`
- **Numerical Processing**: `numpy 2.5.3`
- **PaddlePaddle**: Not installed. Neither `paddlepaddle` nor `paddledet` package exists in the environment.

---

## 4. Model Loading & Inference Pipeline Trace

The complete end-to-end path from input frame to prediction output was traced and verified:

```text
[Input Image / Video Frame] (OpenCV BGR uint8, H x W x 3)
           ↓
[Color Space Conversion] cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
           ↓
[Image Preprocessing] processor(images=frame_rgb, return_tensors="pt")
  - Normalized tensor (1, 3, 640, 640)
  - Transferred to target device ('cpu' or 'cuda')
           ↓
[Model Initialization] RTDetrV2ForObjectDetection.from_pretrained(model_path)
  - Loaded once at startup in eval() mode
  - Weights cached at ~/.cache/huggingface/hub/models--PekingU--rtdetr_v2_r18vd
           ↓
[Forward Inference] with torch.no_grad(): outputs = model(**inputs)
  - Produces raw logits and normalized bbox predictions
  - Latency measured with time.perf_counter()
           ↓
[Post-Processing & Coordinate Rescaling]
  - processor.post_process_object_detection(outputs, target_sizes=[(H, W)], threshold=confidence_threshold)
  - Boxes mapped directly back to original frame dimensions (H, W) in absolute pixel space
           ↓
[Coordinate Clamping & Formatting]
  - x1 = max(0, min(int(round(x1)), width - 1))
  - y1 = max(0, min(int(round(y1)), height - 1))
  - x2 = max(x1 + 1, min(int(round(x2)), width))
  - y2 = max(y1 + 1, min(int(round(y2)), height))
           ↓
[Target Class Filtering & Class ID Mapping]
  - Matches integer label against configured target classes from model vocabulary
  - Resolves human-readable label name strictly from model metadata without aliasing
           ↓
[Standardized Prediction Envelope Output]
  {
    "schema_version": "1.0",
    "model_id": "PekingU/rtdetr_v2_r18vd",
    "frame_index": Optional[int],
    "timestamp": Optional[str],
    "inference_latency_ms": float,
    "detections": [{class_id, class_name, class, confidence, bbox}]
  }
```

---

## 5. Existing Video Pipeline Audit

We evaluated `edge/camera/`, `edge/processing/`, and `edge/main.py`:

| Criterion | Evaluation Result | Verified Mechanism |
|---|---|---|
| **Single model initialization** | **PASS** | Model is instantiated once in `main()` prior to the capture loop. Subsequent frames reuse the warm in-memory model. |
| **Correct frame preprocessing** | **PASS** | BGR input is converted to RGB before tensor encoding; original frame dimensions are preserved for post-processing. |
| **Coordinate consistency** | **PASS** | Post-processing scales boxes to original frame dimensions `(height, width)`; coordinates are boundary-clamped integers. |
| **Resource cleanup on exit** | **PASS** | A `finally:` block in `main.py` guarantees `camera.release()`, `video_writer.release()`, and `cv2.destroyAllWindows()`. |
| **Graceful interrupt handling** | **PASS** | POSIX signal handlers (`SIGINT`, `SIGTERM`) toggle a boolean loop flag; OpenCV keypress (`Q` or `ESC`) breaks the loop cleanly. |
| **Video loop & end-of-stream** | **PASS** | `VideoFile` provides optional automatic rewind (`loop=True`); when loop is disabled, end-of-file returns `(False, None)` and stops the pipeline. |
| **Throughput & latency measurement** | **PASS** | Forward pass latency is captured via `time.perf_counter()`; overall pipeline FPS is smoothed using an Exponential Moving Average (EMA, alpha=0.1). |
| **Decoupled prediction output** | **PASS** | `pipeline.process_frame()` returns both the annotated NumPy image and a decoupled, serializable `event_payload` dictionary. |

---

## 6. Remediated Defects & Improvements

1. **Inconsistent Return Contract (Remediated)**:
   - *Previous Defect*: `predict_frame()` returned a tuple `(detections, latency_ms)` while `predict_image()` returned a bare list `detections`.
   - *Fix*: Both methods now return the identical standardized envelope dictionary:
     `{"schema_version": "1.0", "model_id": ..., "frame_index": ..., "timestamp": ..., "inference_latency_ms": ..., "detections": [...]}`.
   - *Backward Compatibility*: `PersonDetector.detect(frame_bgr)` acts as a documented compatibility wrapper returning `(detections, latency_ms)` for `pipeline.py`.
2. **Class Semantics & Silent Aliasing (Remediated)**:
   - *Previous Defect*: A heuristic attempted to remap `student` to class 0 (`person`) when student was requested.
   - *Fix*: Removed silent aliasing. Active models strictly report their authentic vocabulary (`person`, `chair`, `laptop`, `tvmonitor`). If a caller requests a target class not present in the model vocabulary, a warning is logged and no artificial alias is injected.
3. **Input and Configuration Validation (Remediated)**:
   - Added validation for `confidence_threshold` (must be `[0.0, 1.0]`), `device` (must be `'cpu'` or `'cuda'`), and non-empty input frames.
4. **Deterministic Unit Test Suite (Remediated)**:
   - Added mock-based unit tests for all contract edge cases (empty frames, invalid devices, threshold boundaries, missing weights, model reuse, coordinate bounds) distinct from real model evaluation tests.

---

## 7. Current Implementation Status Matrix

| Subsystem / Capability | Reported Status | Verified Implementation Status | Evidence / Notes |
|---|---|---|---|
| **Custom Paddle Weights (`model_final.pdparams`)** | Trained (75.5% mAP) | **UNAVAILABLE / BLOCKED** | Files not present in repo or on host. Paddle runtime not installed. |
| **Generic Baseline (`PekingU/rtdetr_v2_r18vd`)** | Temporary Fallback | **AVAILABLE & ACTIVE** | Locally cached; verified functional on PyTorch CPU runtime. |
| **Trainee / Person Detection** | `student` class | **Operational (`person` / COCO 0)** | Tested: 19 persons detected in sample classroom image with 92.5% confidence. |
| **Infrastructure Detection** | `computer` class | **Operational (`laptop`, `tvmonitor`, `chair`)** | Tested: detected 5 laptops, 4 monitors, 10 chairs in classroom image. |
| **Reusable Inference API** | Inconsistent | **Operational (Standardized Envelope)** | `load_detector()`, `predict_frame()`, `predict_image()`, `close()` return consistent dicts. |
| **Camera Stream Ingestion** | Partial | **Operational (`edge/camera`)** | Tested on video files and USB camera interface. |
| **Multi-Object Tracking** | Not implemented | **Deferred to Phase 2** | Raw detection observations produced; ByteTrack tracking deferred. |
| **Attendance & Compliance Rules** | Not implemented | **Deferred to Phase 2/3 Backend** | Roster comparison and discrepancy engine belong in backend service. |
| **Frontend Dashboard** | Independent prototype | **Operational (83 passing tests)** | React + Vite UI in `Frontend/` preserved with 0 regressions. |

---

## 8. Exact Files Changed in Phase 1

1. **[`edge/inference/detector.py`](file:///home/mocha/Desktop/SIH%20PROTOTYPE/edge/inference/detector.py)**:
   - Standardized `RTDETRDetector.predict_frame()` and `predict_image()` to return consistent envelope dictionaries.
   - Removed artificial class remapping (`student` -> `person`); enforced authentic model vocabularies.
   - Added `model_id` propagation, `schema_version = "1.0"`, and input validation on device/thresholds.
   - Preserved `PersonDetector.detect()` tuple return for backward compatibility.
2. **[`edge/inference/__init__.py`](file:///home/mocha/Desktop/SIH%20PROTOTYPE/edge/inference/__init__.py)**:
   - Exported `load_detector`, `RTDETRDetector`, `PersonDetector`, and `ModelLoader`.
3. **[`edge/tests/test_edge_pipeline.py`](file:///home/mocha/Desktop/SIH%20PROTOTYPE/edge/tests/test_edge_pipeline.py)**:
   - Added unit test suite `test_reusable_inference_interface()` covering schema validation, boundary checks, input errors, missing Paddle runtime diagnostics, and model reuse.
4. **[`docs/PHASE1_CODEBASE_AUDIT.md`](file:///home/mocha/Desktop/SIH%20PROTOTYPE/docs/PHASE1_CODEBASE_AUDIT.md)**:
   - Updated comprehensive codebase audit, model decision log, and defect remediation.
5. **[`docs/INFERENCE_INTEGRATION_SPEC.md`](file:///home/mocha/Desktop/SIH%20PROTOTYPE/docs/INFERENCE_INTEGRATION_SPEC.md)**:
   - Updated formal integration contract and schema definitions for Phase 2.

---

## 9. Tests Performed and Actual Results

| Test Description | Execution Command | Result | Metrics / Observations |
|---|---|---|---|
| **Edge Pipeline Self-Checks (Mock & Unit)** | `.venv/bin/python edge/tests/test_edge_pipeline.py` | **PASSED (Exit 0)** | 5 suites passed: Camera abstraction, annotator HUD, event schema, reusable inference envelope, loader diagnostics. |
| **Real Image Inference (Generic Baseline)** | `load_detector()` on `Annotated Indian Skill Training Classroom.png` | **PASSED (Exit 0)** | Latency: 282.9 ms on Intel CPU. Envelope returned 34 detections (19 persons, 5 laptops, 4 monitors, 10 chairs). |
| **Real Video File Stream Inference** | `.venv/bin/python edge/main.py --source video --path "/home/mocha/2026-09-16 13-59-20.mp4" --no-display --max-frames 5` | **PASSED (Exit 0)** | Processed 5 consecutive frames. Latency: 270–347 ms/frame (~3.5 FPS). Detections: 3 persons/frame. |
| **Frontend Test Suite** | `cd Frontend && npm test` | **PASSED (Exit 0)** | 83 passing tests across RBAC, SHA-256 integrity, OCR, and document persistence. |
