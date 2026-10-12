import React, { useState, useEffect, useRef } from 'react';
import HeaderNav from './components/rec/HeaderNav';
import OverviewView from './components/views/OverviewView';
import VideoAnalysisView from './components/views/VideoAnalysisView';
import ResultsView from './components/views/ResultsView';
import Toast from './components/Toast';
import { loadLocal, saveLocal } from './services/db';

export default function App() {
  // Navigation: 'overview' | 'analysis' | 'results'
  const [currentView, setCurrentView] = useState('overview');

  // Backend Health & Model Runtime
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);

  // In-session job history (preserved in localStorage via dual-persistence)
  const [sessionJobs, setSessionJobs] = useState(() => loadLocal('drishti_session_jobs', loadLocal('sih_session_jobs', [])));

  // Video Analysis Stage State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null); // 'queued' | 'processing' | 'completed' | 'failed'
  const [progressPercent, setProgressPercent] = useState(0);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.35);
  const [frameSampleInterval, setFrameSampleInterval] = useState(3);
  const [currentFps, setCurrentFps] = useState(0);
  const [liveClassCounts, setLiveClassCounts] = useState({ student: 0, computer: 0 });

  // Results State
  const [activeResults, setActiveResults] = useState(() => loadLocal('drishti_latest_results', loadLocal('sih_latest_results', null)));

  // Toast Stack
  const [toasts, setToasts] = useState([]);
  const pollIntervalRef = useRef(null);

  const addToast = (title, message, type = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check backend health on mount
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(err.message || 'Backend connection failed');
    }
  };

  useEffect(() => {
    checkHealth();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Save session jobs to localStorage on update
  useEffect(() => {
    saveLocal('drishti_session_jobs', sessionJobs);
    saveLocal('sih_session_jobs', sessionJobs);
  }, [sessionJobs]);

  // Save latest results to localStorage on update
  useEffect(() => {
    if (activeResults) {
      saveLocal('drishti_latest_results', activeResults);
      saveLocal('sih_latest_results', activeResults);
    }
  }, [activeResults]);

  // Poll job status during background analysis
  useEffect(() => {
    if (jobId && jobStatus === 'processing') {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const statusData = await res.json();

          setJobStatus(statusData.status);
          setProgressPercent(statusData.progress_percent || 0);
          setProcessedFrames(statusData.processed_frames || 0);
          setTotalFrames(statusData.total_frames || 0);
          if (statusData.current_fps !== undefined) setCurrentFps(statusData.current_fps);
          if (statusData.live_class_counts) setLiveClassCounts(statusData.live_class_counts);

          if (statusData.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setIsAnalyzing(false);
            await handleFetchResults(jobId);
          } else if (statusData.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setIsAnalyzing(false);
            setJobError(statusData.error || 'Video analysis failed.');
            addToast('Analysis Failed', statusData.error || 'Processing encountered an error.', 'error');
          }
        } catch (err) {
          console.error('Job polling error:', err);
        }
      }, 800);
    } else {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId, jobStatus]);

  // Fetch results when job completes
  const handleFetchResults = async (id) => {
    try {
      const res = await fetch(`/api/jobs/${id}/results`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setActiveResults(data);

      // Append or update job in sessionJobs
      setSessionJobs((prev) => {
        const existing = prev.filter((j) => j.job_id !== id);
        return [data, ...existing];
      });

      addToast('Analysis Complete', `Job ${id} processed successfully.`, 'success');
      setCurrentView('results');
    } catch (err) {
      setJobError(err.message);
      addToast('Results Error', err.message, 'error');
    }
  };

  // Upload video file to backend
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadError(null);
    setJobError(null);

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const uploadData = await res.json();
      setJobId(uploadData.job_id);
      setJobStatus('queued');
      addToast('Video Queued', `${selectedFile.name} uploaded successfully. Ready for inference.`, 'success');
    } catch (err) {
      setUploadError(err.message);
      addToast('Upload Failed', err.message, 'error');
    }
  };

  // Start background analysis
  const handleStartAnalysis = async (options = {}) => {
    if (!jobId) return;

    setIsAnalyzing(true);
    setJobError(null);

    const conf = options.confidenceThreshold !== undefined ? options.confidenceThreshold : confidenceThreshold;
    const interval = options.frameSampleInterval !== undefined ? options.frameSampleInterval : frameSampleInterval;

    try {
      const res = await fetch(`/api/jobs/${jobId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confidence_threshold: conf,
          frame_sample_interval: interval,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      setJobStatus('processing');
      addToast('Inference Started', 'Neural video frame analysis underway...', 'info');
    } catch (err) {
      setIsAnalyzing(false);
      setJobError(err.message);
      addToast('Analysis Error', err.message, 'error');
    }
  };

  // Reset current video analysis stage
  const handleReset = (errMsg = null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setJobId(null);
    setJobStatus(null);
    setProgressPercent(0);
    setProcessedFrames(0);
    setTotalFrames(0);
    setIsAnalyzing(false);
    setJobError(null);
    setUploadError(errMsg);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-zinc-900 flex flex-col font-sans selection:bg-zinc-200 selection:text-zinc-950">
      {/* Sticky Header Nav with Brand & Pill Dock */}
      <HeaderNav
        currentView={currentView}
        setCurrentView={setCurrentView}
        health={health}
        isAnalyzing={isAnalyzing}
        hasResults={!!activeResults}
      />

      {/* Main Viewport Content Area */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 sm:px-8 lg:px-[75px] py-8">
        {/* VIEW 1: OVERVIEW */}
        {currentView === 'overview' && (
          <OverviewView
            health={health}
            sessionJobs={sessionJobs}
            activeResults={activeResults}
            onNavigateToAnalysis={() => setCurrentView('analysis')}
            onSelectJobForResults={(job) => {
              setActiveResults(job);
              setCurrentView('results');
            }}
          />
        )}

        {/* VIEW 2: VIDEO ANALYSIS */}
        {currentView === 'analysis' && (
          <VideoAnalysisView
            health={health}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            previewUrl={previewUrl}
            setPreviewUrl={setPreviewUrl}
            jobId={jobId}
            setJobId={setJobId}
            jobStatus={jobStatus}
            setJobStatus={setJobStatus}
            progressPercent={progressPercent}
            processedFrames={processedFrames}
            totalFrames={totalFrames}
            isAnalyzing={isAnalyzing}
            jobError={jobError}
            uploadError={uploadError}
            confidenceThreshold={confidenceThreshold}
            setConfidenceThreshold={setConfidenceThreshold}
            frameSampleInterval={frameSampleInterval}
            setFrameSampleInterval={setFrameSampleInterval}
            currentFps={currentFps}
            liveClassCounts={liveClassCounts}
            onUpload={handleUpload}
            onStartAnalysis={handleStartAnalysis}
            onViewResults={() => setCurrentView('results')}
            onReset={handleReset}
          />
        )}

        {/* VIEW 3: RESULTS */}
        {currentView === 'results' && (
          <ResultsView
            results={activeResults}
            onAnalyzeAnother={() => {
              handleReset();
              setCurrentView('analysis');
            }}
          />
        )}
      </main>

      {/* Drishti AI Status Bar Footer */}
      <footer className="border-t border-[#18261e] bg-[#0e1713] text-[#faf9f6] py-6 mt-16 text-xs font-mono">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 lg:px-[75px] flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Drishti AI Branding & Subtitle */}
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <div className="flex items-baseline">
              <span className="font-editorial italic font-normal text-xl text-white">Drishti</span>
              <span className="font-display font-black text-sm text-white ml-1 tracking-tight">AI</span>
            </div>
            <span className="text-[#3a5245] hidden sm:inline">•</span>
            <span className="text-zinc-400 text-[11px] sm:text-xs">
              Training Centre Video Monitoring
            </span>
          </div>

          {/* Right: Telemetry & Connection Status Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
            {/* CCTV Stream Demo Status */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#16231d] border border-[#23382f] text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-[#00D6B2] shadow-[0_0_8px_#00D6B2]" />
              <span className="tracking-wider font-medium text-white">CCTV DEMO READY</span>
            </div>

            {/* Backend Service Status */}
            {health ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#16231d] border border-[#23382f] text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-[#00D6B2]" />
                <span className="tracking-wider font-medium text-white">
                  BACKEND ONLINE ({health.model_mode?.toUpperCase() || 'ONLINE'})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-rose-950/40 border border-rose-900/50 text-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="tracking-wider font-medium">BACKEND OFFLINE</span>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Telemetry Footnote */}
        <div className="max-w-[1500px] mx-auto px-4 sm:px-8 lg:px-[75px] mt-3 pt-3 border-t border-[#18261e]/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-zinc-400">
          <span>Local CCTV feed streams directly in-browser • Custom video inference processed via RT-DETRv2 engine</span>
          <span className="text-zinc-400">DRISHTI AI PLATFORM</span>
        </div>
      </footer>

      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
