import React, { useState, useRef } from 'react';
import Card from '../rec/Card';
import Button from '../rec/Button';
import Badge from '../rec/Badge';
import VideoPlayer from '../VideoPlayer';
import {
  Upload,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  ChevronRight,
  Film,
  Users,
  Laptop,
  Gauge,
  RotateCcw,
  Check,
} from 'lucide-react';

export default function VideoAnalysisView({
  health,
  selectedFile,
  setSelectedFile,
  previewUrl,
  setPreviewUrl,
  jobId,
  setJobId,
  jobStatus,
  setJobStatus,
  progressPercent = 0,
  processedFrames = 0,
  totalFrames = 0,
  isAnalyzing = false,
  jobError,
  uploadError,
  confidenceThreshold = 0.35,
  setConfidenceThreshold,
  frameSampleInterval = 3,
  setFrameSampleInterval,
  currentFps = 0,
  liveClassCounts = { student: 0, computer: 0 },
  onUpload,
  onStartAnalysis,
  onViewResults,
  onReset,
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Clean model display name without internal suffix
  const activeModelDisplay = health?.active_model_id
    ? health.active_model_id.replace('-SIH', '')
    : 'RT-DETRv2-R18';

  const handleFileChange = (file) => {
    if (!file) return;

    // Check extension
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
    if (!allowed.includes(ext)) {
      onReset(`Unsupported format "${ext}". Supported: ${allowed.join(', ')}`);
      return;
    }

    // Check max size (150MB)
    const maxBytes = 150 * 1024 * 1024;
    if (file.size > maxBytes) {
      onReset('File exceeds maximum allowed size of 150MB.');
      return;
    }

    // Create local object URL for instant preview
    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);
    setJobId(null);
    setJobStatus(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  const handleStartWithSettings = () => {
    if (onStartAnalysis) {
      onStartAnalysis({
        confidenceThreshold: confidenceThreshold,
        frameSampleInterval: frameSampleInterval,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Workbench Header */}
      <div className="border-b border-zinc-200/80 pb-4 pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 uppercase tracking-wider mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D6B2]" />
            <span>Video Inference Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 tracking-tight">
            Video Analysis Workbench
          </h1>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReset(null)}
              disabled={isAnalyzing || jobStatus === 'processing'}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>
            {jobStatus === 'completed' && (
              <Button
                variant="neural"
                size="sm"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                onClick={onViewResults}
              >
                Inspect Results &rarr;
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Responsive Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Primary Video Panel (~67% desktop) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="relative">
            {previewUrl ? (
              <VideoPlayer
                src={previewUrl}
                fit="contain"
                badgeText={jobStatus ? jobStatus.toUpperCase() : 'PREVIEW'}
                metadata={{
                  filename: selectedFile?.name,
                  size: selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : null,
                }}
                isProcessing={isAnalyzing || jobStatus === 'processing'}
                processingText="Running RT-DETRv2 neural inference..."
              />
            ) : (
              /* High-polish Empty Dropzone */
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative aspect-video rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-8 text-center select-none ${
                  isDragOver
                    ? 'border-[#00D6B2] bg-emerald-950/20'
                    : 'border-zinc-300 hover:border-zinc-400 bg-white hover:bg-zinc-50/60 shadow-2xs'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.avi,.mov,.mkv,.webm"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                  className="hidden"
                />
                <div className="w-13 h-13 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 mb-3 shadow-2xs">
                  <Upload className="w-6 h-6 text-zinc-700" />
                </div>
                <h3 className="text-sm font-display font-bold text-zinc-900 tracking-tight">
                  Select CCTV Recording for Analysis
                </h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm leading-relaxed">
                  Drag and drop a video file here, or click to browse. Supports MP4, AVI, MOV, MKV, and WEBM.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 font-mono text-[10px] text-zinc-600">
                  <span>Maximum file size: 150 MB</span>
                </div>
              </div>
            )}
          </div>

          {/* Compact Telemetry Footer Bar */}
          {selectedFile && (
            <div className="p-3 rounded-xl bg-white border border-zinc-200/90 shadow-2xs flex flex-wrap items-center justify-between text-xs font-mono gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 text-[11px]">FILE:</span>
                  <span className="font-medium text-zinc-800 truncate max-w-[200px]" title={selectedFile.name}>
                    {selectedFile.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 text-[11px]">JOB:</span>
                  <span className="font-medium text-zinc-800">{jobId || 'UNASSIGNED'}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {currentFps > 0 && (
                  <div className="flex items-center gap-1 text-zinc-700">
                    <Gauge className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{currentFps.toFixed(1)} FPS</span>
                  </div>
                )}
                {totalFrames > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-400 text-[11px]">FRAMES:</span>
                    <span className="text-zinc-800">
                      {processedFrames} / {totalFrames}
                    </span>
                    <span className="text-[#008f77] font-semibold">({progressPercent}%)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Alert Box */}
          {(uploadError || jobError) && (
            <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-900 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold font-mono uppercase tracking-wider text-[11px]">Processing Alert</p>
                <p className="mt-0.5 text-rose-800 leading-relaxed">{uploadError || jobError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Settings & Controls (~33% desktop) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Model Status Card */}
          <Card className="p-4 bg-white border-zinc-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-2">
              <span>Detection Engine</span>
              {health?.model_initialized ? (
                <span className="inline-flex items-center gap-1.5 text-[#008f77] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00D6B2] animate-pulse" />
                  READY
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  STANDBY
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono font-bold text-sm text-zinc-950 tracking-tight">
                  {activeModelDisplay}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Real-Time Detection Transformer
                </div>
              </div>
            </div>

            {/* Target Classes Chips */}
            <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 font-mono">Classes:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Users className="w-3 h-3 text-emerald-600" /> student
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-sky-50 text-sky-800 border border-sky-200">
                <Laptop className="w-3 h-3 text-sky-600" /> computer
              </span>
            </div>
          </Card>

          {/* Inference Parameters Card */}
          <Card className="p-5 bg-white border-zinc-200/90 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
              <Sliders className="w-4 h-4 text-zinc-600" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900">
                Analysis Parameters
              </h3>
            </div>

            {/* 1. Confidence Threshold Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-600">Confidence Threshold:</span>
                <span className="font-bold text-zinc-950">{Math.round(confidenceThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.85"
                step="0.05"
                value={confidenceThreshold}
                disabled={isAnalyzing || jobStatus === 'processing'}
                onChange={(e) => setConfidenceThreshold?.(parseFloat(e.target.value))}
                className="w-full accent-[#00D6B2] cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span>15% (Sensitive)</span>
                <span>35% (Default)</span>
                <span>85% (Strict)</span>
              </div>
            </div>

            {/* 2. Frame Sampling Interval */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-zinc-600">Sampling Rate:</span>
                <span className="font-bold text-zinc-950">
                  {frameSampleInterval === 1 ? '1x (All Frames)' : `${frameSampleInterval}x (1 in ${frameSampleInterval})`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                {[
                  { value: 1, label: '1x Full' },
                  { value: 3, label: '3x Fast' },
                  { value: 5, label: '5x Ultra' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isAnalyzing || jobStatus === 'processing'}
                    onClick={() => setFrameSampleInterval?.(opt.value)}
                    className={`py-1.5 px-2 rounded-lg text-center font-medium transition-all cursor-pointer disabled:opacity-50 ${
                      frameSampleInterval === opt.value
                        ? 'bg-zinc-950 text-white font-bold shadow-2xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Progress Feedback */}
            {(jobStatus === 'processing' || progressPercent > 0) && (
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <div className="flex justify-between text-[11px] font-mono text-zinc-600">
                  <span>ANALYSIS PROGRESS</span>
                  <span className="font-bold text-zinc-950">{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
                  <div
                    className="h-full bg-[#00D6B2] transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Live Observation Counts */}
                {jobStatus === 'processing' && (
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                    <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                      <span className="text-emerald-700">Students:</span>
                      <span className="font-bold text-emerald-950">{liveClassCounts.student || 0}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-sky-50/70 border border-sky-100 flex items-center justify-between">
                      <span className="text-sky-700">Computers:</span>
                      <span className="font-bold text-sky-950">{liveClassCounts.computer || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-2 border-t border-zinc-100 space-y-2">
              {!jobId ? (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  disabled={!selectedFile || isAnalyzing}
                  onClick={onUpload}
                  icon={<Upload className="w-3.5 h-3.5" />}
                >
                  Upload &amp; Queue Video
                </Button>
              ) : jobStatus === 'completed' ? (
                <Button
                  variant="neural"
                  size="md"
                  className="w-full justify-center"
                  onClick={onViewResults}
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  View Analysis Results &rarr;
                </Button>
              ) : (
                <Button
                  variant="neural"
                  size="md"
                  className="w-full justify-center"
                  disabled={isAnalyzing || jobStatus === 'processing'}
                  onClick={handleStartWithSettings}
                  icon={
                    isAnalyzing || jobStatus === 'processing' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )
                  }
                >
                  {isAnalyzing || jobStatus === 'processing'
                    ? 'Running RT-DETRv2 Analysis...'
                    : 'Start Neural Analysis'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
