import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  FileVideo,
  Layers,
  RefreshCw,
  Download,
  Info,
  ShieldCheck,
  ChevronRight,
  Filter,
  MonitorPlay,
  Users,
  Laptop
} from 'lucide-react';
import { apiUrl, resolveMediaUrl } from '../services/api';

export default function VideoMonitoringView({ addToast }) {
  // Backend health & model state
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(true);

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Job & analysis state
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // 'queued' | 'processing' | 'completed' | 'failed'
  const [progressPercent, setProgressPercent] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jobError, setJobError] = useState(null);

  // Results state
  const [results, setResults] = useState(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const pollIntervalRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch backend operational health
  const checkHealth = async () => {
    setIsCheckingHealth(true);
    setHealthError(null);
    try {
      const res = await fetch(apiUrl('/api/health'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setHealthError(err.message || 'Failed to connect to backend');
      setHealth(null);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Poll job status while processing
  useEffect(() => {
    if (jobId && jobStatus === 'processing') {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(apiUrl(`/api/jobs/${jobId}`));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const statusData = await res.json();

          setJobStatus(statusData.status);
          setProgressPercent(statusData.progress_percent || 0);
          setProcessedFrames(statusData.processed_frames || 0);
          setTotalFrames(statusData.total_frames || 0);

          if (statusData.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setIsAnalyzing(false);
            fetchResults(jobId);
            if (addToast) addToast('Analysis Completed', `Job ${jobId} finished processing successfully.`, 'success');
          } else if (statusData.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setIsAnalyzing(false);
            setJobError(statusData.error || 'Video analysis failed.');
            if (addToast) addToast('Analysis Failed', statusData.error || 'Processing error occurred.', 'error');
          }
        } catch (err) {
          console.error('Error polling job status:', err);
        }
      }, 800);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, jobStatus]);

  // Fetch results when job finishes
  const fetchResults = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/jobs/${id}/results`));
      if (!res.ok) throw new Error(`Failed to fetch results (HTTP ${res.status})`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setJobError(err.message);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    if (!allowed.includes(ext)) {
      setUploadError(`Unsupported video format "${ext}". Allowed: ${allowed.join(', ')}`);
      setSelectedFile(null);
      return;
    }

    const maxBytes = 150 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError('File exceeds maximum size of 150MB.');
      setSelectedFile(null);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
    // Reset any prior job
    setJobId(null);
    setJobStatus(null);
    setResults(null);
    setJobError(null);
  };

  // Upload video
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    setJobError(null);

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      const res = await fetch(apiUrl('/api/videos'), {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const uploadData = await res.json();
      setJobId(uploadData.job_id);
      setJobStatus('queued');
      if (addToast) addToast('Video Uploaded', `File ${selectedFile.name} uploaded successfully.`, 'success');
    } catch (err) {
      setUploadError(err.message);
      if (addToast) addToast('Upload Error', err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Start analysis
  const handleStartAnalysis = async () => {
    if (!jobId) return;

    setIsAnalyzing(true);
    setJobError(null);

    try {
      const res = await fetch(apiUrl(`/api/jobs/${jobId}/analyze`), {
        method: 'POST'
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      setJobStatus('processing');
      if (addToast) addToast('Analysis Started', 'Background AI processing initiated...', 'info');
    } catch (err) {
      setIsAnalyzing(false);
      setJobError(err.message);
      if (addToast) addToast('Analysis Error', err.message, 'error');
    }
  };

  // Reset workflow
  const handleReset = () => {
    setSelectedFile(null);
    setJobId(null);
    setJobStatus(null);
    setProgressPercent(0);
    setProcessedFrames(0);
    setTotalFrames(0);
    setIsAnalyzing(false);
    setResults(null);
    setJobError(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter detections
  const filteredDetections = (results?.detections || []).filter((det) => {
    const matchesClass =
      selectedClassFilter === 'ALL' ||
      det.class_name.toLowerCase() === selectedClassFilter.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      det.class_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(det.timestamp_seconds).includes(searchQuery) ||
      det.timestamp_seconds.toFixed(2).includes(searchQuery) ||
      String(det.frame_index).includes(searchQuery);
    return matchesClass && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Status Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <MonitorPlay className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  AI Video Monitoring & Compliance Analysis
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated trainee presence & workstation compliance verification for training centres
                </p>
              </div>
            </div>
          </div>

          {/* Model Status Pill */}
          <div className="flex items-center space-x-3">
            <button
              onClick={checkHealth}
              disabled={isCheckingHealth}
              className="px-2.5 py-1 text-xs border border-slate-200 hover:border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors"
              title="Refresh backend status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {health ? (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono bg-slate-50 border-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-800">{health.active_model_id}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                  health.is_mock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {health.model_mode}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Backend Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Model Provenance & Honest AI Disclaimer Banner */}
        <div className="mt-5 p-3.5 rounded-lg border bg-blue-50/60 border-blue-200 text-blue-900 text-xs flex items-start space-x-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-blue-950">
              {health?.is_mock ? 'Assumed Prototype Model (Mock Inference)' : 'Active Neural Model Pipeline'}
            </div>
            <p className="text-blue-800 leading-relaxed">
              {health?.is_mock
                ? 'Running deterministic assumed-model adapter simulating the target RT-DETRv2-R18 architecture [classes: student, computer]. Detections are isolated within a modular adapter architecture, ready for drop-in replacement with PaddleDetection weights without backend or frontend modifications.'
                : `Executing neural network inference with ${health?.active_model_id || 'PyTorch'}. Note: Raw person/trainee detections reflect observed physical instances, not verified biometric attendance.`}
            </p>
          </div>
        </div>

        {healthError && (
          <div className="mt-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Connection issue: {healthError}. Verify FastAPI backend is running on port 8000.</span>
          </div>
        )}
      </div>

      {/* Main Grid: Upload & Controls or Results */}
      {!results ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Zone (2 cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
            <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
              <FileVideo className="w-4 h-4 text-slate-600" />
              <span>Video Input & Ingestion</span>
            </h2>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                selectedFile
                  ? 'border-blue-500 bg-blue-50/20'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.avi,.mov,.mkv,.webm"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  selectedFile ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedFile ? selectedFile.name : 'Click to select or drag & drop video'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports MP4, AVI, MOV, MKV, WEBM (Max 150MB)
                  </p>
                </div>

                {selectedFile && (
                  <div className="text-xs font-mono text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-md shadow-2xs">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'video/mp4'}
                  </div>
                )}
              </div>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleReset}
                disabled={!selectedFile || isUploading || isAnalyzing}
                className="px-4 py-2 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Clear Selection
              </button>

              {!jobId ? (
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading || !health}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading Video...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Queue Job</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing || jobStatus === 'processing'}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {isAnalyzing || jobStatus === 'processing' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing Frames...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start AI Analysis</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Job Pipeline Telemetry Card (1 col) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>Job Orchestration</span>
              </h2>

              <div className="mt-4 space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex justify-between text-slate-500">
                    <span>Job Identifier</span>
                    <span className="font-mono font-medium text-slate-800">{jobId || 'None (Awaiting upload)'}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Current Status</span>
                    <span className={`font-semibold capitalize ${
                      jobStatus === 'completed' ? 'text-emerald-600' :
                      jobStatus === 'processing' ? 'text-blue-600 animate-pulse' :
                      jobStatus === 'failed' ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      {jobStatus || 'Idle'}
                    </span>
                  </div>
                  {totalFrames > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Frame Progress</span>
                      <span className="font-mono text-slate-800">{processedFrames} / {totalFrames}</span>
                    </div>
                  )}
                </div>

                {/* Live Progress Bar */}
                {(jobStatus === 'processing' || progressPercent > 0) && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600 font-medium">
                      <span>Inference Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {jobError && (
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
                    <p className="font-semibold">Processing Failed</p>
                    <p className="mt-0.5">{jobError}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center space-x-2 text-slate-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Compliant Execution</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Processed locally inside container. Bounding boxes & confidence metrics overlaid on video output.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Results Dashboard */
        <div className="space-y-6">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Analysis Completed: {results.filename}</h2>
                <p className="text-xs text-slate-500 font-mono">Job ID: {results.job_id} • Duration: {results.processing_duration_seconds}s</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <a
                href={resolveMediaUrl(results.output_video_url)}
                download
                className="px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Video</span>
              </a>

              <button
                onClick={handleReset}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Analyze Another Video</span>
              </button>
            </div>
          </div>

          {/* KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Total Detections</span>
                <Layers className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {results.total_detections}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Across {results.total_frames} frames</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Trainee Detections</span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
                {results.class_counts?.student || results.class_counts?.person || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Observed instances (not biometric ID)</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Computer Workstations</span>
                <Laptop className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-indigo-600 mt-2 font-mono">
                {results.class_counts?.computer || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Hardware compliance tally</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Inference Speed</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                {results.processing_duration_seconds > 0
                  ? (results.total_frames / results.processing_duration_seconds).toFixed(1)
                  : '0'} <span className="text-sm font-normal text-slate-500">FPS</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Processed in {results.processing_duration_seconds}s</p>
            </div>
          </div>

          {/* Dual-Pane View: Annotated Video & Detection Log */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Pane: Annotated Video Player (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                  <MonitorPlay className="w-4 h-4 text-slate-600" />
                  <span>Annotated Output Video (Bounding Boxes & Telemetry)</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  H.264 / MP4
                </span>
              </div>

              {results.output_video_url && (
                <div className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
                  <video
                    controls
                    autoPlay
                    loop
                    muted
                    className="w-full h-full object-contain"
                    src={resolveMediaUrl(results.output_video_url)}
                  >
                    Your browser does not support HTML5 video streaming.
                  </video>
                </div>
              )}

              <p className="text-xs text-slate-400 italic">
                * Video contains real-time bounding box annotations (green = student, blue = computer) and semi-transparent telemetry HUD overlay.
              </p>
            </div>

            {/* Right Pane: Detection Log Table (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-slate-600" />
                    <span>Detection Records ({filteredDetections.length})</span>
                  </h3>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                    {['ALL', 'STUDENT', 'COMPUTER'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setSelectedClassFilter(tab)}
                        className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                          selectedClassFilter === tab
                            ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {tab.toLowerCase()}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Search by second / frame..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {/* Records Table */}
                <div className="max-h-[360px] overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100 text-xs">
                  {filteredDetections.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      No detections match the selected criteria.
                    </div>
                  ) : (
                    filteredDetections.slice(0, 100).map((det, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            det.class_name.toLowerCase() === 'student' ? 'bg-emerald-500' : 'bg-blue-500'
                          }`} />
                          <span className="font-semibold text-slate-800 capitalize">{det.class_name}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {det.timestamp_seconds.toFixed(2)}s (frame #{det.frame_index})
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {(det.confidence * 100).toFixed(0)}%
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 hidden sm:inline" title="Bounding Box [x1, y1, x2, y2]">
                            [{det.bbox.join(',')}]
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {filteredDetections.length > 100 && (
                  <p className="text-[11px] text-slate-400 text-right">
                    Showing first 100 of {filteredDetections.length} detections
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
