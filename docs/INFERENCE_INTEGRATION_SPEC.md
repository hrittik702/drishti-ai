# AI Inference Integration Specification & Backend Contract

**Document Version**: 1.1 (Phase 1 Remediation Final)  
**Target Architecture**: FastAPI Microservice / Edge Video Ingestion Pipeline  
**Module Path**: `edge.inference` / [`edge/inference/detector.py`](file:///home/mocha/Desktop/SIH%20PROTOTYPE/edge/inference/detector.py)  

---

## 1. Model Status & Identification

To ensure absolute clarity between reported project claims and verified system realities, the active model status is recorded below:

| Model Component | Status | Identification & Notes |
|---|---|---|
| **Custom Fine-Tuned Model** | **UNAVAILABLE / BLOCKED** | `model_final.pdparams` and `rtdetrv2_r18vd_sih.yml` were not provided in the repository or filesystem. External dependency blocked. |
| **Generic Baseline Model** | **AVAILABLE & ACTIVE** | `PekingU/rtdetr_v2_r18vd` (RT-DETRv2-S, PyTorch/Transformers) cached locally in `~/.cache/huggingface/hub/`. |
| **Benchmark Metrics** | **REPORTED (NOT EVALUATED)** | The 75.5% mAP@0.50:0.95 benchmark belongs to the missing custom model. The active generic baseline is an unverified fallback. |
| **Execution Hardware** | **CPU ONLY** | Intel Core Raptor Lake-P with Iris Xe Graphics. No NVIDIA GPU or CUDA runtime is present. |

---

## 2. Reusable Inference Interface Contract

The inference module provides a standardized contract separating model inference from camera capture, HTTP APIs, and database persistence.

```python
from edge.inference import load_detector

# 1. Initialize detector (singleton lifecycle)
detector = load_detector(
    config_path_or_model="PekingU/rtdetr_v2_r18vd",
    device="cpu",
    confidence_threshold=0.40,
    target_classes=["person", "laptop", "tvmonitor", "chair"]
)

# 2. Frame inference (e.g., from camera feed)
frame_result = detector.predict_frame(
    frame_bgr=frame,
    frame_index=12,
    timestamp="2026-10-12T16:30:00Z"
)

# 3. Image inference (e.g., from disk path or uploaded file)
image_result = detector.predict_image(
    image_input="/path/to/classroom.jpg",
    frame_index=0,
    timestamp="2026-10-12T16:30:00Z"
)

# 4. Cleanup on service shutdown
detector.close()
```

### Core API Specifications

#### `load_detector`
```python
def load_detector(
    config_path_or_model: str = "PekingU/rtdetr_v2_r18vd",
    checkpoint_path: Optional[str] = None,
    device: str = "cpu",
    confidence_threshold: float = 0.40,
    target_classes: Optional[List[str]] = None,
    model_id: Optional[str] = None
) -> RTDETRDetector
```
- **Validation**:
  - `device`: Must be `"cpu"` or `"cuda"`. Raises `ValueError` otherwise.
  - `confidence_threshold`: Must be a float in `[0.0, 1.0]`. Raises `ValueError` otherwise.
  - `checkpoint_path` / `config_path_or_model`: If a `.pdparams` or `.yml` path is supplied and `paddle` is not installed, raises `RuntimeError` stating that the PaddlePaddle runtime is required.

#### `predict_frame` and `predict_image`
Both methods return the **identical structured prediction envelope dictionary**.

---

## 3. Standardized Prediction Envelope Schema

Every call to `predict_frame` or `predict_image` produces a dictionary conforming to the following JSON schema:

```json
{
  "schema_version": "1.0",
  "model_id": "PekingU/rtdetr_v2_r18vd",
  "frame_index": 12,
  "timestamp": "2026-10-12T16:30:00Z",
  "inference_latency_ms": 282.92,
  "detections": [
    {
      "class_id": 0,
      "class_name": "person",
      "class": "person",
      "confidence": 0.9239,
      "bbox": [784, 418, 916, 574]
    },
    {
      "class_id": 63,
      "class_name": "laptop",
      "class": "laptop",
      "confidence": 0.8412,
      "bbox": [520, 610, 680, 730]
    }
  ]
}
```

### Envelope Field Definitions

| Field Name | Type | Format / Constraints | Description |
|---|---|---|---|
| `schema_version` | `str` | Fixed `"1.0"` | Schema contract version for backend serialization. |
| `model_id` | `str` | Non-empty string | Explicit identifier of the active model performing inference. |
| `frame_index` | `Optional[int]` | Integer or `null` | Sequential frame counter supplied by caller. |
| `timestamp` | `Optional[str]` | ISO 8601 string or `null` | Frame capture timestamp supplied by caller. |
| `inference_latency_ms` | `float` | `>= 0.0` | Exact forward inference duration in milliseconds. |
| `detections` | `List[Dict]` | Array of detection dicts | Filtered object predictions (empty list `[]` if none pass). |

### Detection Item Field Definitions

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `class_id` | `int` | `>= 0` | Integer class index from active model vocabulary. |
| `class_name` | `str` | Authentic model label | Label string directly from active model metadata. |
| `class` | `str` | Identical to `class_name` | Backward-compatibility alias. |
| `confidence` | `float` | `0.0 <= confidence <= 1.0` | Detection confidence rounded to 4 decimals. |
| `bbox` | `List[int]` | `[x1, y1, x2, y2]` | Absolute pixel coordinates clamped to frame dimensions. |

---

## 4. Class Mapping Policy & Domain Vocabularies

### Strict Non-Aliasing Policy
- **No Automatic Remapping**: Generic COCO label `person` is **never** silently renamed to `student`. Generic labels `laptop` and `tvmonitor` are **never** combined into `computer` without an explicit fine-tuned model.
- **Authentic Model Vocabulary**: Predictions strictly report the classes configured in the active model's `id2label` metadata.
- **Target Class Filtering**:
  - Filter names are case-insensitive.
  - If a caller specifies `target_classes=["student", "computer"]` against the active generic baseline, neither class exists in the COCO vocabulary. The system logs a warning and returns `[]` detections rather than inventing false matches.

### Active Generic Baseline Vocabulary (COCO 80)
| Domain Purpose | Candidate Object | Active Model Class ID | Active Model Label |
|---|---|---|---|
| Trainee Presence Observation | Physical Person | `0` | `person` |
| Infrastructure Asset | Workstation Computer | `63` | `laptop` |
| Infrastructure Asset | Display Screen / Monitor | `62` | `tvmonitor` |
| Infrastructure Asset | Trainee Seating | `56` | `chair` |

---

## 5. Bounding-Box Coordinate Conventions

- **Convention**: Absolute pixel coordinates `[x1, y1, x2, y2]`.
- **Reference Frame**: Refers directly to the original input image dimensions `(H, W)`.
- **Coordinate Boundaries**:
  - `0 <= x1 < x2 <= W`
  - `0 <= y1 < y2 <= H`
  - Every coordinate is an integer (`int`).
- **Normalized Coordinates**: Not used. Prevents floating-point precision ambiguities across services.

---

## 6. Model Lifecycle & Resource Management

1. **Singleton Ingestion**: The model is instantiated once at worker/service startup.
2. **Reuse**: Subsequent frames reuse the warm in-memory model. No weights are reloaded per frame.
3. **Shutdown**: Calling `detector.close()` cleans up model and processor references and empties GPU caches if applicable.

---

## 7. Performance & Latency Telemetry

Measured on the development host (**Intel Core Raptor Lake-P CPU**, 2.2–3.5 GHz):
- **Model Loading Latency**: ~4.0 seconds (cold start from local HuggingFace cache).
- **Single Image Inference**: ~280–324 ms per frame (1774x887 resolution).
- **Video Stream Inference**: ~270–347 ms per frame (~3.0–3.5 FPS effective CPU throughput).
- **GPU Acceleration**: Unavailable on current host (no discrete NVIDIA GPU).

> [!NOTE]
> **Production Throughput Recommendation**:
> Because full video feeds operate at 25–30 FPS, real-time edge processing on CPU requires temporal sampling (e.g., 1 frame per second) or edge hardware acceleration (OpenVINO / TensorRT) in Phase 2.

---

## 8. Architectural Boundaries for Future Backend

The boundary between Phase 1 AI inference and Phase 2/3 backend services is strictly maintained:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Phase 1: Detection Observation (AI Inference Module)              │
│ - Instantaneous spatial prediction in frame T                    │
│ - Output: [{"class_name": "person", "bbox": [10, 20, 100, 200]}] │
│ - Does NOT identify students, record attendance, or create alerts│
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 2: Tracking Observation (ByteTrack Multi-Object Tracker)   │
│ - Associates detections across consecutive frames                │
│ - Assigns persistent Track ID without biometric identification  │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│ Phase 2/3: Attendance Reconciliation & Compliance Engine         │
│ - Aggregates persistent tracks over time windows (5–15 mins)     │
│ - Reconciles aggregate counts against scheduled batch rosters    │
│ - Emits verified attendance records and compliance alerts        │
└──────────────────────────────────────────────────────────────────┘
```
