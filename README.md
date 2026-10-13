# Drishti AI — CCTV Video Analysis & Multi-Object Monitoring

Drishti AI is an AI-powered CCTV video analysis and multi-object tracking system designed for examination and training monitoring. It features real RT-DETRv2 neural inference, class-segregated ByteTrack tracking with independent entity namespaces (`S01`, `S02` for students and `C01`, `C02` for computers), web-native H.264 video rendering, and a React monitoring dashboard.

---

## 1. System Architecture

```text
┌─────────────────────────────────────────┐
│           Vercel (Frontend)             │
│   React 19 + Vite 8 SPA Dashboard       │
│   Centralized API Client (api.js)       │
└────────────────────┬────────────────────┘
                     │ HTTPS / REST (CORS)
                     ▼
┌─────────────────────────────────────────┐
│           Railway (Backend API)         │
│   FastAPI + Uvicorn (0.0.0.0:$PORT)     │
│   Health Probes: /live, /ready, /model  │
│   Atomic JSON Job Persistence           │
│   Bounded Concurrency Semaphore         │
├────────────────────┬────────────────────┤
│   Inference Engine │ Tracking Engine    │
│   RT-DETRv2 ONNX   │ ByteTrack (Sxx/Cxx)│
└────────────────────┴────────────────────┘
                     │ Volume Mount (/app/data)
                     ▼
┌─────────────────────────────────────────┐
│       Railway Persistent Volume         │
│   /app/data/uploads  (Raw CCTV MP4)     │
│   /app/data/outputs  (Annotated MP4)    │
│   /app/data/jobs     (Job JSON records) │
└─────────────────────────────────────────┘
```

---

## 2. Prerequisites & Supported Runtimes

- **Backend Runtime**: Python 3.12 (Debian/Linux x86_64 or ARM64)
- **Frontend Runtime**: Node.js 20+ or 22+ (tested up to Node 26)
- **System Utilities**: `ffmpeg` (required for web-compatible H.264 video transcoding), `libgl1`, `libglib2.0-0` (for OpenCV)
- **Inference Runtime**: ONNX Runtime (CPUExecutionProvider), optimized with graph fusion and multi-threading.

---

## 3. Local Development Setup

### A. Backend Setup
```bash
# 1. Clone repository
git clone https://github.com/your-username/drishti-ai.git
cd drishti-ai

# 2. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install backend dependencies
pip install -r requirements-backend.txt

# 4. Start FastAPI development server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at `http://localhost:8000/docs`.

### B. Frontend Setup
```bash
cd Frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
The dashboard will run at `http://localhost:5173`. In local development, requests to `/api/*` are automatically proxied to `http://localhost:8000`.

---

## 4. Model Artifacts & Weights

The production inference model is located in:
`SIH_Model_Package/model/model.onnx` (80.3 MB)

- **Class Map**: `0`: `student`, `1`: `computer`
- **Resolution**: 640 × 640 input resolution with RGB normalization
- **Parity**: Matches trained PaddleDetection RT-DETRv2-R18 weights

The model file is tracked directly in source control (within GitHub's 100 MB single-file limit).

---

## 5. Environment Variables

### Backend Configuration (Railway)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port automatically assigned by Railway. |
| `HOST` | `0.0.0.0` | Server bind interface. |
| `ENVIRONMENT` | `production` | Deployment mode. |
| `CORS_ORIGINS` | `*` | Comma-separated list of allowed frontend domains (e.g. `https://your-frontend.vercel.app`). |
| `DATA_DIR` | `/app/data` | Root directory for uploads, outputs, and jobs. Point this to your Railway volume. |
| `MODEL_MODE` | `sih` | `sih` loads RT-DETRv2-R18 ONNX model. |
| `CONFIDENCE_THRESHOLD` | `0.35` | Minimum confidence score for candidate detections. |
| `FRAME_SAMPLE_INTERVAL` | `3` | Sample every Nth frame (3 = 1 inference per 3 frames). |
| `MAX_CONCURRENT_JOBS` | `1` | Concurrency limit on simultaneous video inference jobs. |

### Frontend Configuration (Vercel)

| Variable | Description |
| :--- | :--- |
| `VITE_API_BASE_URL` | Public HTTPS domain of the deployed Railway backend (e.g. `https://drishti-backend.up.railway.app`). Leave empty for local Vite proxy. |

---

## 6. GitHub Preparation

Before pushing to GitHub:

```bash
# Verify no secrets or build artifacts are staged
git status

# Ensure large local videos are ignored
git check-ignore test_clip.mp4
```

Required repository files for deployment:
- `Dockerfile` & `.dockerignore`
- `railway.json`
- `Frontend/vercel.json`
- `requirements-backend.txt`
- `SIH_Model_Package/model/model.onnx`

---

## 7. Railway Backend Deployment

1. **Create New Project**: Log into [Railway.app](https://railway.app) and select **New Project** → **Deploy from GitHub repo**.
2. **Select Repository**: Pick your `drishti-ai` repository.
3. **Configure Build**:
   - Railway will detect `railway.json` and use the root `Dockerfile`.
   - Healthcheck path is automatically set to `/api/health/ready`.
4. **Attach Persistent Volume (Recommended)**:
   - In the Railway dashboard for the service, go to **Settings** → **Volumes** → **Add Volume**.
   - Set **Mount Path** to `/app/data`.
   - Set size (e.g., 5GB or 10GB depending on video retention needs).
5. **Configure Environment Variables**:
   - `ENVIRONMENT`: `production`
   - `DATA_DIR`: `/app/data`
   - `CORS_ORIGINS`: `https://your-drishti-frontend.vercel.app`
   - `MAX_CONCURRENT_JOBS`: `1`
6. **Generate Domain**:
   - In **Settings** → **Networking** → **Generate Domain** (e.g., `https://drishti-production.up.railway.app`).
   - Copy this URL for the frontend configuration.

---

## 8. Vercel Frontend Deployment

1. **Import Project**: Log into [Vercel](https://vercel.com) and click **Add New...** → **Project**.
2. **Select Repository**: Select the `drishti-ai` repository.
3. **Configure Build Settings**:
   - **Root Directory**: Click *Edit* and select `Frontend`.
   - **Framework Preset**: `Vite`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Set Environment Variable**:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://drishti-production.up.railway.app` (your Railway backend URL without trailing slash).
5. **Deploy**:
   - Click **Deploy**. Vercel will build and deploy the SPA with automatic HTTPS.

---

## 9. Testing & End-to-End Verification

### Automated Test Suites
```bash
# Run all 43 backend tests
PYTHONPATH=. .venv/bin/pytest backend/tests/ -v

# Run all 95 frontend tests
cd Frontend && npm test

# Run frontend production build
cd Frontend && npm run build
```

### Health Probes Verification
```bash
# 1. Liveness check
curl -f https://your-backend.up.railway.app/api/health/live

# 2. Readiness check (verifies storage and model)
curl -f https://your-backend.up.railway.app/api/health/ready

# 3. Model status check
curl -f https://your-backend.up.railway.app/api/health/model
```

---

## 10. Common Deployment Issues & Diagnostics

1. **503 Service Unavailable on `/api/health/ready`**:
   - Check Railway build logs to verify `model.onnx` exists at `SIH_Model_Package/model/model.onnx`.
   - Check volume permissions on `/app/data`.
2. **CORS Error in Browser Console**:
   - Ensure `CORS_ORIGINS` in Railway matches your Vercel domain exactly (e.g. `https://your-frontend.vercel.app`, no trailing slash).
3. **Video Playback Black Screen or Format Error**:
   - Drishti AI automatically transcodes annotated outputs to web-compatible H.264 using `ffmpeg`. The provided Dockerfile installs `ffmpeg` at the OS level. If running on a bare VPS without Docker, ensure `sudo apt-get install -y ffmpeg` is executed.
4. **Memory Limit Exceeded (OOM)**:
   - For Railway Free/Hobby plans (512MB RAM), set `MAX_CONCURRENT_JOBS=1` and `FRAME_SAMPLE_INTERVAL=3` (or `4`). The ONNX runtime uses ~350MB of RSS RAM during inference.

---

## 11. Updating & Redeploying

- **Backend**: Pushes to the `main` branch on GitHub automatically trigger a new Docker build and rolling deployment on Railway. Completed jobs and videos stored on the `/app/data` persistent volume are preserved across deployments.
- **Frontend**: Pushes to `main` automatically trigger atomic preview and production builds on Vercel.
