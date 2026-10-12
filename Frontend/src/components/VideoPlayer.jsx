import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  AlertCircle,
  Film,
  Loader2,
} from 'lucide-react';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Drishti AI - Unified Reusable Video Player
 *
 * Provides a consistent, distraction-free playback surface across Workbench,
 * Results, and live monitoring. Features:
 * - 16px rounded corners, dark backdrop, subtle borders
 * - Hover & focus-revealed controls with smooth opacity transitions
 * - Responsive aspect ratio (16:9) with configurable object-fit ('contain' | 'cover')
 * - Full timeline scrubbing, mute/volume control, fullscreen toggle
 * - Keyboard shortcuts: Space (play/pause), M (mute/unmute), F (fullscreen)
 * - Empty, loading, and error states
 * - Non-obstructive live processing indicator
 */
const VideoPlayer = forwardRef(function VideoPlayer(
  {
    src,
    autoPlay = false,
    loop = false,
    muted: initialMuted = false,
    fit = 'contain', // 'contain' | 'cover'
    className = '',
    emptyState = null,
    badgeText = null,
    metadata = null, // { filename, resolution, duration, size }
    isProcessing = false,
    processingText = 'Neural analysis running...',
    onPlaybackChange,
    onTimeUpdate,
  },
  ref
) {
  const containerRef = useRef(null);
  const internalVideoRef = useRef(null);

  // Expose underlying HTML5 video element to forwarded ref
  useImperativeHandle(ref, () => internalVideoRef.current, []);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [volume, setVolume] = useState(initialMuted ? 0 : 1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [touchVisible, setTouchVisible] = useState(false);

  // Synchronize playback when source changes
  useEffect(() => {
    setHasError(false);
    setCurrentTime(0);
    setIsLoading(Boolean(src));

    if (src && autoPlay) {
      const v = internalVideoRef.current;
      if (v) {
        v.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  }, [src, autoPlay]);

  // Notify parent of telemetry updates
  useEffect(() => {
    if (onPlaybackChange) {
      onPlaybackChange({ isPlaying, currentTime, duration, hasError });
    }
  }, [isPlaying, currentTime, duration, hasError, onPlaybackChange]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = useCallback(
    (e) => {
      e?.stopPropagation();
      const v = internalVideoRef.current;
      if (!v) return;

      if (v.paused) {
        v.play()
          .then(() => setIsPlaying(true))
          .catch(() => {});
      } else {
        v.pause();
        setIsPlaying(false);
      }
    },
    []
  );

  const toggleMute = useCallback(
    (e) => {
      e?.stopPropagation();
      const v = internalVideoRef.current;
      if (!v) return;

      const nextMuted = !isMuted;
      v.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted && volume === 0) {
        v.volume = 0.5;
        setVolume(0.5);
      }
    },
    [isMuted, volume]
  );

  const handleVolumeChange = (e) => {
    e?.stopPropagation();
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    const v = internalVideoRef.current;
    if (v) {
      v.volume = newVol;
      if (newVol > 0 && isMuted) {
        v.muted = false;
        setIsMuted(false);
      } else if (newVol === 0 && !isMuted) {
        v.muted = true;
        setIsMuted(true);
      }
    }
  };

  const handleSeek = (e) => {
    e?.stopPropagation();
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    if (internalVideoRef.current) {
      internalVideoRef.current.currentTime = seekTime;
    }
  };

  const toggleFullscreen = (e) => {
    e?.stopPropagation();
    const c = containerRef.current;
    if (!c) return;

    if (!document.fullscreenElement) {
      c.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Keyboard accessibility within container
  const handleKeyDown = (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
      return; // let range slider handle left/right arrow keys
    }
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  const areControlsVisible = isHovered || isFocused || !isPlaying || touchVisible;

  // Empty state rendering
  if (!src) {
    return (
      <div
        className={`relative aspect-video rounded-2xl border border-zinc-200/90 bg-zinc-950 flex items-center justify-center overflow-hidden shadow-2xs select-none ${className}`}
      >
        {emptyState || (
          <div className="text-center p-6 text-zinc-400">
            <Film className="w-10 h-10 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-medium text-zinc-300">Awaiting Video Recording</p>
            <p className="text-xs font-mono text-zinc-500 mt-1">Select or upload a video to preview</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onTouchStart={() => setTouchVisible((prev) => !prev)}
      className={`relative group aspect-video rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-sm transition-all duration-200 focus:outline-hidden focus:ring-1 focus:ring-[#00D6B2]/50 select-none ${className}`}
    >
      {/* Video Stream Element */}
      {!hasError ? (
        <video
          ref={internalVideoRef}
          src={src}
          autoPlay={autoPlay}
          loop={loop}
          muted={isMuted}
          playsInline
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => setIsLoading(false)}
          onTimeUpdate={() => {
            if (internalVideoRef.current) {
              const ct = internalVideoRef.current.currentTime;
              setCurrentTime(ct);
              onTimeUpdate?.(ct);
            }
          }}
          onLoadedMetadata={() => {
            if (internalVideoRef.current) {
              setDuration(internalVideoRef.current.duration);
              setIsLoading(false);
              setHasError(false);
            }
          }}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          className={`w-full h-full cursor-pointer ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          }`}
        />
      ) : (
        /* Error Display */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-zinc-400 bg-zinc-900">
          <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
          <h4 className="text-sm font-medium text-zinc-200">Video Playback Error</h4>
          <p className="text-xs text-zinc-500 max-w-sm mt-1 font-mono">
            Could not load or decode video asset. Check encoding or network connection.
          </p>
        </div>
      )}

      {/* Loading Buffering Indicator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-8 h-8 text-[#00D6B2] animate-spin" />
        </div>
      )}

      {/* Top Overlay: Metadata Chips & Badge */}
      {!hasError && (badgeText || metadata) && (
        <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-4 flex items-center justify-between pointer-events-none transition-opacity duration-200 z-10">
          <div className="flex items-center gap-2">
            {badgeText && (
              <span className="font-mono text-[10px] font-semibold text-[#00D6B2] uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs border border-[#00D6B2]/30">
                {badgeText}
              </span>
            )}
            {metadata?.filename && (
              <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-300 uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs border border-white/10 truncate max-w-[240px]">
                {metadata.filename}
              </span>
            )}
            {metadata?.resolution && (
              <span className="hidden md:inline-block font-mono text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-black/50 border border-white/10">
                {metadata.resolution}
              </span>
            )}
          </div>

          <span className="font-mono text-[11px] text-zinc-200 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs border border-white/10">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Subtle Non-Intrusive Processing Bar */}
      {isProcessing && (
        <div className="absolute top-0 inset-x-0 bg-emerald-950/80 backdrop-blur-xs border-b border-[#00D6B2]/40 text-[#00D6B2] px-3 py-1 flex items-center justify-between text-[11px] font-mono z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00D6B2] animate-pulse" />
            <span className="tracking-wider uppercase font-semibold">{processingText}</span>
          </div>
          <span className="text-[10px] text-emerald-300">LIVE INFERENCE ACTIVE</span>
        </div>
      )}

      {/* Center Paused Overlay Indicator */}
      {!isPlaying && !isLoading && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-2xs cursor-pointer pointer-events-auto"
        >
          <div className="w-13 h-13 rounded-full bg-zinc-900/90 text-white flex items-center justify-center shadow-lg border border-white/20 transition-transform transform active:scale-90 hover:scale-105">
            <Play className="w-5 h-5 fill-current translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Bottom Controls Bar (Visible on Hover / Focus / Pause) */}
      {!hasError && (
        <div
          className={`absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-200 flex flex-col gap-2 z-10 ${
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
          <div className="flex items-center justify-between text-white text-xs pt-0.5">
            {/* Left Controls: Play/Pause, Mute/Volume, Time */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
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
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
