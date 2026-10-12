import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  AlertCircle,
  Video
} from 'lucide-react';
import Badge from './Badge';

/**
 * Drishti AI - CCTV Video Player
 * Prominent autoplaying CCTV player with on-hover overlay controls, timeline scrubber,
 * volume adjustments, fullscreen support, and touch accessibility.
 */
export default function CctvPlayer({
  src = '/cctv_v2_annotated.mp4',
  className = '',
  onPlaybackChange,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [touchControlsVisible, setTouchControlsVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Auto-play safely on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().then(() => {
      setIsPlaying(true);
    }).catch((err) => {
      console.warn('CCTV autoplay prevented by browser policy; user interaction required:', err);
      setIsPlaying(false);
    });
  }, [src]);

  // Report live playback telemetry to parent component
  useEffect(() => {
    if (onPlaybackChange) {
      onPlaybackChange({ isPlaying, currentTime, duration, hasError });
    }
  }, [isPlaying, currentTime, duration, hasError, onPlaybackChange]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Format time MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const togglePlay = (e) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      video.volume = 0.5;
      setVolume(0.5);
    }
  };

  const handleVolumeChange = (e) => {
    e?.stopPropagation();
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      if (newVol > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      } else if (newVol === 0 && !isMuted) {
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  const handleSeek = (e) => {
    e?.stopPropagation();
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Show controls on hover, or when paused, or toggled on touch
  const areControlsVisible = isHovered || !isPlaying || touchControlsVisible;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setTouchControlsVisible((prev) => !prev)}
      className={`relative group overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-950 shadow-sm transition-all duration-200 aspect-video select-none ${className}`}
    >
      {/* Video Element */}
      {!hasError ? (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted={isMuted}
          loop
          playsInline
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              setHasError(false);
            }
          }}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover cursor-pointer pointer-events-auto"
        />
      ) : (
        /* Useful Fallback on Load Failure */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400 bg-zinc-900">
          <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
          <h4 className="text-sm font-medium text-zinc-200 font-sans">
            CCTV Demonstration Feed Unavailable
          </h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1 font-mono">
            Could not load video asset from <span className="text-zinc-400">{src}</span>.
          </p>
        </div>
      )}

      {/* Top HUD Telemetry Overlay */}
      {!hasError && (
        <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between pointer-events-none transition-opacity duration-200">
          <div className="flex items-center gap-2">
            <Badge variant="neural" pulse={true} size="sm">
              CCTV DEMO STREAM
            </Badge>
            <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-300/80 uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-xs border border-white/10">
              848x480 • 60 FPS
            </span>
          </div>

          <span className="font-mono text-[11px] text-zinc-200 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-xs border border-white/10">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Center Paused Overlay Indicator */}
      {!isPlaying && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-2xs cursor-pointer pointer-events-auto"
        >
          <div className="w-14 h-14 rounded-full bg-zinc-900/90 text-white flex items-center justify-center shadow-lg border border-white/20 transition-transform transform active:scale-90 hover:scale-105">
            <Play className="w-6 h-6 fill-current translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Bottom Controls Bar (Visible on Hover / Pause / Touch) */}
      {!hasError && (
        <div
          className={`absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent transition-opacity duration-200 flex flex-col gap-2 ${
            areControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Timeline Range Scrubber */}
          <div className="relative w-full flex items-center group/timeline">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Video scrubber timeline"
              className="w-full h-1 sm:h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer focus:outline-hidden accent-[#00D6B2]"
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between text-white text-xs pt-1">
            {/* Left Controls: Play/Pause, Mute/Volume, Time */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause CCTV video' : 'Play CCTV video'}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current translate-x-0.5" />
                )}
              </button>

              {/* Volume & Mute */}
              <div className="flex items-center gap-1.5 group/volume">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute video audio' : 'Mute video audio'}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-zinc-300" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-zinc-100" />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume slider"
                  className="w-14 sm:w-18 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer focus:outline-hidden accent-[#00D6B2] hidden sm:inline-block"
                />
              </div>

              {/* Timestamp */}
              <span className="font-mono text-[11px] text-zinc-300 ml-1 hidden xs:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls: Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
