import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Download, 
  AlertCircle, 
  Film, 
  Gauge, 
  PictureInPicture,
  RefreshCw
} from 'lucide-react';

export default function VideoViewer({ blob, filename, mimeType, onDownload }) {
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [metadata, setMetadata] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Safe Blob URL lifecycle managed via useEffect
  useEffect(() => {
    if (!blob) {
      setVideoUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setVideoUrl(url);
    setError(null);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Handle native media errors
  const handleVideoError = (e) => {
    const mediaErr = videoRef.current?.error || e?.target?.error;
    let msg = 'Video playback format or codec is not supported by this browser.';
    if (mediaErr) {
      switch (mediaErr.code) {
        case 1: // MEDIA_ERR_ABORTED
          msg = 'Video playback was interrupted.';
          break;
        case 2: // MEDIA_ERR_NETWORK
          msg = 'Storage error while reading video binary stream.';
          break;
        case 3: // MEDIA_ERR_DECODE
          msg = 'Video decode error: file stream may be corrupted or uses an unsupported codec.';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          msg = 'Browser cannot decode this video codec natively. Download to view in an external player.';
          break;
        default:
          msg = mediaErr.message || msg;
      }
    }
    console.warn('HTML5 Video Error:', mediaErr);
    setError(msg);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setMetadata({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        duration: videoRef.current.duration
      });
      setError(null);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(err => {
        console.warn('Play interrupted:', err);
      });
    } else {
      videoRef.current.pause();
    }
  };

  const skipTime = (seconds) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration || 1000, videoRef.current.currentTime + seconds));
  };

  const changePlaybackRate = (rate) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  const togglePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const retryPlayback = () => {
    setError(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    }
  };

  if (!blob) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Film className="w-10 h-10 text-slate-400 mb-2 stroke-1" />
        <span className="text-xs font-medium">No video media provided</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 text-white select-none">
      
      {/* Main Video Viewport */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black overflow-hidden group">
        {/* Floating Resolution Badge if available */}
        {metadata?.width && metadata?.height && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
            <span className="font-mono text-xs font-medium bg-slate-900/80 backdrop-blur text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded shadow">
              {metadata.width}×{metadata.height} ({metadata.height >= 1080 ? 'FHD' : metadata.height >= 720 ? 'HD' : 'SD'})
            </span>
          </div>
        )}

        {error ? (
          <div className="m-auto text-center p-6 bg-slate-900 border border-red-500/40 rounded-2xl max-w-md space-y-3 shadow-2xl">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-semibold text-white text-sm">Video Playback Issue</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">{error}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={retryPlayback}
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Playback</span>
              </button>

              {onDownload && (
                <button
                  onClick={onDownload}
                  className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video Evidence</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              playsInline
              preload="auto"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
              }}
              onLoadedMetadata={handleLoadedMetadata}
              onError={handleVideoError}
              className="max-w-full max-h-full object-contain m-auto"
            />
          )
        )}
      </div>

      {/* Forensic Evidence Playback Bar */}
      {!error && (
        <div className="px-3.5 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0 select-none">
          {/* Left: Play/Pause, Step -5s / +5s, Timestamp */}
          <div className="flex items-center space-x-2">
            <button
              onClick={togglePlay}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => skipTime(-5)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
              title="Step back 5 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => skipTime(5)}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
              title="Step forward 5 seconds"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <div className="font-mono text-xs font-medium text-slate-300 ml-1">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-500">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Forensic Speed Selection, Mute, PIP, Fullscreen, Download */}
          <div className="flex items-center space-x-2">
            {/* Speed Multiplier Chips for Forensic Scrutiny */}
            <div className="hidden sm:flex items-center space-x-1 bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 text-xs">
              <Gauge className="w-3 h-3 text-slate-400 ml-1 mr-0.5" />
              {[0.5, 1, 1.5, 2].map(rate => (
                <button
                  key={rate}
                  onClick={() => changePlaybackRate(rate)}
                  className={`px-1.5 py-0.5 rounded font-mono text-xs font-medium transition-colors ${
                    playbackRate === rate
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Playback speed ${rate}x`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <button
              onClick={toggleMute}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={togglePip}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors hidden sm:inline-flex"
              title="Picture in Picture"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>

            {onDownload && (
              <button
                onClick={onDownload}
                className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded transition-colors"
                title="Download certified video copy"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
