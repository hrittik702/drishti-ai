# SIH26190 — Digital Monitoring & Attendance System

An edge-native, cryptographic digital monitoring prototype for training centres and examination facilities, combining RT-DETRv2-S edge AI vision processing with a tamper-evident compliance audit dashboard.

---

## Architecture Overview

```text
USB Camera / Video File / RTSP Feeds
                ↓
    Camera Input Layer (OpenCV)
                ↓
      Frame Preprocessing
                ↓
          RT-DETRv2-S
                ↓
    Real-Time Person Detection
                ↓
   Annotated Output & Telemetry HUD
                ↓
  Structured AI Events (CAM-01, FPS, latency, detections)
```

---

## Project Structure

```text
.
├── Frontend/                 # Existing React + Vite compliance dashboard
│   ├── src/                  # Components, RBAC, Dual-Persistence, OCR, Audit Log
│   ├── tests/                # 83 automated unit and integration tests
│   └── package.json
│
├── edge/                     # Milestone 1: Edge AI Processing Module
│   ├── camera/
│   │   ├── base.py           # CameraSource abstract interface
│   │   ├── usb_camera.py     # USB / V4L2 camera capture with index auto-detection
│   │   └── video_file.py     # Video file playback source (benchmarking & testing)
│   ├── inference/
│   │   ├── model_loader.py   # RT-DETRv2-S model loader (Hugging Face & local checkpoints)
│   │   └── detector.py       # PersonDetector with bounding boxes & confidence filtering
│   ├── processing/
│   │   ├── annotator.py      # HUD overlay & bounding box visualization
│   │   └── pipeline.py       # End-to-end capture, inference, and event generation
│   ├── tests/
│   │   └── test_edge_pipeline.py  # Standalone runnable self-check suite
│   ├── config.py             # Pipeline configuration dataclass
│   └── main.py               # Edge CLI entry point
│
├── models/                   # Directory for offline model weights / caches
├── requirements-edge.txt     # Python edge service dependencies
└── README.md
```

---

## 1. Edge AI Processing Setup (Milestone 1)

### Prerequisites
- Python 3.10+ (tested on Python 3.12)
- USB Camera (or video file for testing)
- Linux / macOS / Windows

### Installation

#### Using `uv` (Recommended — fast):
```bash
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements-edge.txt
```

#### Using standard `pip`:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-edge.txt
```

---

## 2. Running the Edge Processing Pipeline

### A. Run with USB Camera (Primary Demo Input)
```bash
python edge/main.py --source usb --camera-index 0
```

With custom resolution, target FPS, and confidence threshold:
```bash
python edge/main.py \
    --source usb \
    --camera-index 0 \
    --width 1280 \
    --height 720 \
    --fps 30 \
    --confidence 0.40
```

### B. Run with Video File (Benchmarking & Fallback)
```bash
python edge/main.py --source video --path path/to/sample.mp4
```

### C. Headless / Server Mode (No GUI display)
```bash
python edge/main.py --source usb --camera-index 0 --no-display
```

### D. Save Annotated Video to File
```bash
python edge/main.py --source usb --camera-index 0 --save-output demo_annotated.mp4
```

---

## 3. Interactive Controls

While the live preview window is active:
- Press **`Q`** or **`ESC`**: Exit cleanly and release camera resources.
- In terminal: Press **`Ctrl+C`**: Triggers graceful shutdown.

---

## 4. RT-DETRv2-S Model Configuration

The pipeline defaults to the official **RT-DETRv2-S** model checkpoint:
- **Default Checkpoint**: `PekingU/rtdetr_v2_r18vd` (downloaded automatically from Hugging Face on first run).
- **Custom / Local Weights**: Pass `--model-path` or set the `MODEL_PATH` environment variable:

```bash
export MODEL_PATH="/path/to/custom_rtdetrv2_weights"
python edge/main.py --source usb --camera-index 0
```
or:
```bash
python edge/main.py --source usb --camera-index 0 --model-path ./models/rtdetrv2_s
```

---

## 5. Camera Troubleshooting Guide

### 1. Camera Device Index
If index `0` fails, query available video devices:
```bash
# On Linux:
ls -la /dev/video*
```
Run with index `1` or `2`:
```bash
python edge/main.py --source usb --camera-index 1
```

### 2. Device Permissions
If OpenCV cannot access `/dev/video0`:
```bash
# Ensure current user is in the video group
sudo usermod -aG video $USER
```

### 3. Clear Error Diagnostics
If the specified camera index cannot be opened, the pipeline immediately outputs diagnostic feedback:
```text
ERROR: Unable to open USB camera at index 0.
Available camera indexes should be checked.
Detected system camera index(es): [0, 1]
Camera initialization failed.
Camera index: 0
```

---

## 6. Running Edge Pipeline Self-Checks

Run the standalone verification test suite (no external test framework required):
```bash
python edge/tests/test_edge_pipeline.py
```

This verifies:
1. CameraSource abstraction and USB error handling
2. VideoFile playback and automatic rewind looping
3. Visual annotator and HUD telemetry rendering
4. RT-DETRv2-S detector schema and person filtering
5. Structured AI event dictionary generation (`camera_id`, `detected_persons`, `fps`, `inference_ms`)

---

## 7. Running the Frontend Dashboard

The existing React frontend dashboard runs independently:

```bash
cd Frontend
npm install
npm run dev
```

To run the frontend test suite (83 passing tests):
```bash
cd Frontend
npm test
```
