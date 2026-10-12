# SIH26190 Redesign Baseline: Current Application State & Reference Architecture

**Date:** 2026-10-13  
**Project:** SIH26190 — AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance  
**Master Design Reference:** REC Labs (`/home/mocha/Desktop/REC-Labs`)

---

## 1. System Inventory

### A. Repositories
- **Target Repository (SIH Prototype):** `/home/mocha/Desktop/SIH PROTOTYPE`
  - Framework: React 19.3.0, Vite 8.3.1, Tailwind CSS (via CDN + `src/index.css`), Python FastAPI backend.
  - Test suites:
    - Frontend: `node --test tests/*.test.mjs` (86 passed).
    - Backend: `pytest backend/tests/test_backend_api.py` (7 passed).
    - Edge Pipeline: `python edge/tests/test_edge_pipeline.py` (all checks passed).
  - Port configurations: Frontend on `http://localhost:5173`, Backend on `http://localhost:8000`.

- **Reference Repository (REC Labs):** `/home/mocha/Desktop/REC-Labs`
  - Framework: React 19, TypeScript, Vite, Tailwind CSS v4, HeroUI, Lucide React.
  - Verified Design Specification: `/home/mocha/Desktop/REC-Labs/docs/DESIGN_SYSTEM_SPEC.md`
  - Typography: `Inter Tight` (Display), `Cormorant Garamond` (Editorial italic), `Inter` (Body), `IBM Plex Mono` (Data HUD).
  - Palette: `#faf9f6` (Canvas), `#ffffff` (Surface), `#18181b` (Ink Primary), `#09090b` (Active Ink), `#e4e4e7` (Border), `#00D6B2` (Neural Green Signal), `#0e1713` (Deep Forest Dark).
  - Geometry: `rounded-sm` (2px, controls/buttons), `rounded` (4px, badges), `rounded-xl` (12px, cards), `rounded-full` (capsule dock).

---

## 2. SIH Application Baseline (Pre-Redesign)

### A. Active Routes & View Navigation
- Pre-redesign `SidebarNav.jsx` and `App.jsx` contained 9 navigational destinations:
  1. `dashboard` (Overview - mixed case/centre stats)
  2. `monitoring` (Video Monitoring MVP added in Phase 2)
  3. `centres` / `cases` (Legacy training centre workspace)
  4. `events` (Compliance events table)
  5. `evidence` / `documents` (Document vault & viewers)
  6. `integrity` / `health` (SHA-256 legal evidence tampering demo)
  7. `audit` (Verification audit log)
  8. `search` (Global document OCR search)
  9. `access` (RBAC user switcher)
- **Problem:** Significant cognitive clutter from legacy legal-case management ("CaseGuard") unrelated to the SIH CCTV monitoring mission.

### B. Working Video-to-Results Pipeline
- **Backend API Endpoints:**
  - `GET /api/health` -> `HealthResponse` (`status`, `model_initialized`, `model_mode`, `active_model_id`, `is_mock`).
  - `POST /api/videos` -> `VideoUploadResponse` (`job_id`, `filename`, `file_size_bytes`, `status`). Validates extension (`.mp4, .avi, .mov, .mkv, .webm`) and file size (`<=150MB`).
  - `POST /api/jobs/{job_id}/analyze` -> `StartAnalysisResponse` (launches background video processor).
  - `GET /api/jobs/{job_id}` -> `JobStatusResponse` (status, frame counts, `progress_percent`).
  - `GET /api/jobs/{job_id}/results` -> `JobResultsResponse` (detections, `class_counts`, duration, `output_video_url`).
  - `GET /api/jobs/{job_id}/output` -> Streams annotated H.264 MP4 (`video/mp4`).
- **Model Adapter Layer:**
  - `MockModelAdapter` (Default assumed model for MVP, simulating RT-DETRv2-R18 with `student` and `computer` classes).
  - `PyTorchRTDETRAdapter` (Real PyTorch CPU neural detector using `PekingU/rtdetr_v2_r18vd`).
  - `PaddleDetectionAdapter` (Future stub for `model_final.pdparams`).

### C. Redesign Target Architecture
Consolidate the application into a lean, 3-screen core:
1. **Screen 1: Overview** (Operational snapshot: health, session history, model provenance, quick analysis CTA).
2. **Screen 2: Video Analysis** (Video ingestion viewport, upload controls, telemetry HUD, frame-by-frame progress).
3. **Screen 3: Results** (Prediction metrics, annotated video playback, high-density detection table, class filtering).
