# SIH26190 Cleanup & Consolidation Report

**Date:** 2026-10-13  
**Project:** SIH26190 — AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance  
**Master Design Reference:** REC Labs (`/home/mocha/Desktop/REC-Labs`)

---

## 1. Executive Summary

This report documents the architectural consolidation and cleanup of the SIH26190 frontend prototype. Prior to this redesign, the application inherited extensive legal-evidence and document-vault features ("CaseGuard") that were unrelated to the Smart India Hackathon CCTV monitoring mandate.

The application has been streamlined into a **lean, 3-screen information architecture** powered by the **REC Labs design system**, while retaining all functional video processing, backend API contracts, model adapters, and regression test suites.

---

## 2. Navigational & UI Consolidation

### A. Removed from Active Navigation
The following 8 legacy destinations and their complex views were decoupled from the active user-facing navigation shell:
1. **Cases / Centres Workspace (`CasesView.jsx`, `CaseWorkspace.jsx`)**: Legal case filing, evidence binders, and courtroom timeline exhibits.
2. **Document Vault (`DocumentLibrary.jsx`, `DocumentWorkspace.jsx`, `DocumentCard.jsx`)**: PDF, DOCX, PPTX viewer carousels and binary previewers.
3. **Integrity & Tampering Simulator (`IntegrityVerificationView.jsx`)**: SHA-256 cryptographic hash tampering demo designed for legal chain-of-custody.
4. **Audit Trail Explorer (`AuditTrailView.jsx`)**: System event audit log for file clearances.
5. **Universal OCR Search (`GlobalSearchView.jsx`)**: Full-text OCR snippet extractor across court files.
6. **Access Control & RBAC Matrix (`AccessControlView.jsx`, `AccessDeniedModal.jsx`)**: Top Secret / Confidential credential switcher.
7. **Compliance Events Registry (`ComplianceEventsView.jsx`)**: Generic static alert table.
8. **Heavy Sidebar Navigation (`SidebarNav.jsx`)**: Replaced by the REC Labs floating capsule pill dock (`HeaderNav.jsx`).

### B. Retained in Codebase for Regression Stability
To preserve complete test coverage (all 86 unit and integration checks in `Frontend/tests/*.test.mjs`), underlying utility libraries and legacy component files tested via file-system introspection (`readFile`) were preserved:
- `Frontend/src/services/db.js` (IndexedDB / localStorage Dual Persistence engine)
- `Frontend/src/services/documentRepository.js`
- `Frontend/src/services/ocr/ocrService.js`
- `Frontend/src/services/pptx/pptxService.js`
- `Frontend/src/utils/integrityUtils.js`
- `Frontend/src/utils/searchUtils.js`
- `Frontend/src/data/roles.js` & `demoUsers.js`
- Component files inspected by `mobile_responsiveness.test.mjs` (`TopHeader.jsx`, `SidebarNav.jsx`, `CasesView.jsx`, `AuditTrailView.jsx`, etc.).

---

## 3. Retained & Upgraded Video Monitoring Core

The core SIH monitoring workflow is consolidated into three cohesive, high-density screens:

| Screen | REC Labs Visual Reference | Functionality |
|---|---|---|
| **1. Overview** | Explore Hero & Metric Strip | Operational service health, active model ID, session tally, 4 metric cards, honest AI provenance banner, and quick analysis launcher. |
| **2. Video Analysis** | Simulation Stage & HUD | Drag-and-drop CCTV video ingestion, format/size validation (<150MB), live video preview stage, telemetry HUD (`IBM Plex Mono`), progress bar with Neural Green signal (`#00D6B2`). |
| **3. Results** | Catalog Results & High-Density Tables | KPI summary cards (Total Detections, Trainee instances, Workstations, Throughput FPS), annotated H.264 MP4 playback with download action, high-density detection table with class filters (`ALL`, `STUDENT`, `COMPUTER`), and honest attendance disclaimer. |

---

## 4. Retained Backend & Model Architecture

Zero backend or inference logic was altered during the frontend redesign:
- **FastAPI Endpoints**:
  - `GET /api/health`
  - `POST /api/videos`
  - `POST /api/jobs/{job_id}/analyze`
  - `GET /api/jobs/{job_id}`
  - `GET /api/jobs/{job_id}/results`
  - `GET /api/jobs/{job_id}/output`
- **Model Adapters**:
  - `MockModelAdapter` (Assumed fine-tuned RT-DETRv2-R18 model simulating `student` and `computer` classes).
  - `PyTorchRTDETRAdapter` (`PekingU/rtdetr_v2_r18vd` CPU neural baseline).
  - `PaddleDetectionAdapter` (Stub for future `model_final.pdparams`).
- **Video Processing Pipeline**:
  - OpenCV reader and high-contrast bounding box visual annotator.
  - Automatic `ffmpeg` H.264 transcode (`libx264`, `yuv420p`) for universal HTML5 playback.
