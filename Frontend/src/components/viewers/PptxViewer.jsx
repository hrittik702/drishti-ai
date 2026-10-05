import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SlideCanvas, useViewerBuildingBlocks } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles';
import { 
  Loader2, 
  AlertCircle, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2 
} from 'lucide-react';
import { detectSwipeDirection } from '../../utils/slideNavigation';

export default function PptxViewer({ blob, filename, onDownload }) {
  const [uint8Array, setUint8Array] = useState(null);
  const [extractLoading, setExtractLoading] = useState(true);
  const [extractError, setExtractError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Presentation State
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(1);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [isIdle, setIsIdle] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef(null);
  const handleRef = useRef(null);
  const idleTimerRef = useRef(null);
  const touchStateRef = useRef({ startX: 0, startY: 0 });
  const dragStateRef = useRef({ isDown: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  // Load and extract Uint8Array binary from blob
  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      setExtractLoading(false);
      setExtractError(true);
      return;
    }

    setExtractLoading(true);
    setExtractError(false);

    const extractBinary = async () => {
      let buffer;
      if (blob instanceof ArrayBuffer) {
        buffer = blob;
      } else if (ArrayBuffer.isView(blob)) {
        buffer = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
      } else if (typeof blob.arrayBuffer === 'function') {
        buffer = await blob.arrayBuffer();
      } else {
        throw new Error('Unsupported blob format for PPTX extraction');
      }

      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Empty PPTX binary (0 bytes)');
      }

      return new Uint8Array(buffer);
    };

    extractBinary()
      .then((bytes) => {
        if (!isCancelled) {
          setUint8Array(bytes);
          setExtractLoading(false);
          setExtractError(false);
        }
      })
      .catch((err) => {
        console.error('Failed to extract PPTX binary:', err);
        if (!isCancelled) {
          setExtractError(true);
          setExtractLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [blob, retryCount]);

  // Hook into pptx-react-viewer building blocks
  const blocks = useViewerBuildingBlocks({
    content: uint8Array,
    canEdit: false,
    handle: handleRef,
    fitPadding: 24, // Consistent institutional margin around slide
    maxFitScale: null,
    onActiveSlideChange: useCallback((idx) => {
      setCurrentSlide(idx + 1);
    }, []),
    onSlideCountChange: useCallback((count) => {
      if (count > 0) setTotalSlides(count);
    }, []),
    onZoomChange: useCallback((z) => {
      if (typeof z === 'number' && !isNaN(z) && z > 0) {
        setCurrentZoom(z);
      }
    }, []),
  });

  const handleRetry = useCallback(() => {
    setExtractError(false);
    setExtractLoading(true);
    setUint8Array(null);
    setRetryCount((c) => c + 1);
  }, []);

  // Activity timer for floating pill controls
  const handleActivity = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 2500);
  }, []);

  useEffect(() => {
    handleActivity();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [handleActivity]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Navigation handlers invoking handleRef
  const navigateNext = useCallback(() => {
    handleRef.current?.goNext?.();
    handleActivity();
  }, [handleActivity]);

  const navigatePrev = useCallback(() => {
    handleRef.current?.goPrev?.();
    handleActivity();
  }, [handleActivity]);

  const navigateFirst = useCallback(() => {
    handleRef.current?.goTo?.(0);
    handleActivity();
  }, [handleActivity]);

  const navigateLast = useCallback(() => {
    handleRef.current?.goTo?.(totalSlides - 1);
    handleActivity();
  }, [totalSlides, handleActivity]);

  const navigateZoomIn = useCallback(() => {
    handleRef.current?.zoomIn?.();
    handleActivity();
  }, [handleActivity]);

  const navigateZoomOut = useCallback(() => {
    handleRef.current?.zoomOut?.();
    handleActivity();
  }, [handleActivity]);

  const navigateFit = useCallback(() => {
    handleRef.current?.zoomReset?.();
    handleActivity();
  }, [handleActivity]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    handleActivity();
  }, [handleActivity]);

  // Global Keyboard Navigation (ArrowLeft, ArrowRight, Home, End)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.target?.isContentEditable) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        navigateNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigatePrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        navigateFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        navigateLast();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateNext, navigatePrev, navigateFirst, navigateLast]);

  // Touch Swipe Navigation for Mobile / Tablets
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStateRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY
      };
    }
  };

  const handleTouchEnd = (e) => {
    if (e.changedTouches.length === 1) {
      const { startX, startY } = touchStateRef.current;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const direction = detectSwipeDirection(startX, startY, endX, endY);
      if (direction === 'next') {
        navigateNext();
      } else if (direction === 'prev') {
        navigatePrev();
      }
    }
  };

  // Spatial Edge-Click Navigation: clicks outside the slide on the left/right advance or go back
  const handleCanvasClick = (e) => {
    // If click is on interactive controls, toolbar, or links, ignore
    if (e.target.closest('button') || e.target.closest('.floating-toolbar') || e.target.closest('a')) return;

    // Requirement: Do not trigger navigation when clicking inside the actual slide content
    const insideSlide = e.target.closest('[role="region"]') || 
                        e.target.closest('[aria-roledescription="slide"]') ||
                        e.target.closest('[data-pptx-ai-active]');
    if (insideSlide) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.3) {
      navigatePrev();
    } else if (clickX > rect.width * 0.7) {
      navigateNext();
    }
  };

  // Double-Click Zoom (Toggles between Fit and ~1.5x)
  const handleDoubleClick = (e) => {
    if (e.target.closest('button') || e.target.closest('.floating-toolbar')) return;
    if (currentZoom <= 1.05) {
      navigateZoomIn();
      setTimeout(navigateZoomIn, 50);
    } else {
      navigateFit();
    }
  };

  // Drag / Pan when zoomed beyond Fit scale
  const isPannable = currentZoom > 1.05;

  const handleMouseDown = (e) => {
    if (!isPannable || e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('.floating-toolbar') || e.target.closest('a')) return;

    const viewport = containerRef.current?.querySelector('[data-pptx-viewport="true"]') ||
                     containerRef.current?.querySelector('.overflow-auto');
    if (!viewport) return;

    dragStateRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    handleActivity();
    if (!dragStateRef.current.isDown) return;

    const viewport = containerRef.current?.querySelector('[data-pptx-viewport="true"]') ||
                     containerRef.current?.querySelector('.overflow-auto');
    if (!viewport) return;

    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    viewport.scrollLeft = dragStateRef.current.scrollLeft - dx;
    viewport.scrollTop = dragStateRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    if (dragStateRef.current.isDown) {
      dragStateRef.current.isDown = false;
      setIsDragging(false);
    }
  };

  const isRenderingError = extractError || Boolean(blocks.error);
  const isStillLoading = extractLoading || blocks.loading || (!blocks.canvasProps?.activeSlide && !isRenderingError);

  if (isStillLoading) {
    return (
      <div className="flex-1 h-full min-h-0 flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-100 select-none">
        <Loader2 className="w-7 h-7 animate-spin text-orange-600 mb-2 stroke-[1.75]" />
        <span className="text-xs font-medium text-slate-500">Parsing PowerPoint presentation...</span>
      </div>
    );
  }

  if (isRenderingError) {
    return (
      <div className="flex-1 h-full min-h-0 flex items-center justify-center p-6 bg-slate-100 select-none">
        <div className="m-auto text-center p-8 bg-white border border-slate-200 rounded-2xl max-w-sm shadow-sm space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto stroke-1" />
          <div className="font-semibold text-slate-900 text-sm">Unable to preview this presentation.</div>
          <p className="text-xs text-slate-500 font-normal">
            The presentation structure could not be rendered in the browser.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleRetry}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer transition-colors"
            >
              Retry
            </button>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Original</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`relative flex-1 min-h-0 w-full h-full bg-slate-100 overflow-hidden select-none flex flex-col items-center justify-center ${
        isPannable 
          ? isDragging ? 'cursor-grabbing' : 'cursor-grab' 
          : 'cursor-default'
      }`}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Strict CSS Isolation for PPTX Presentation Canvas */}
      <style>{`
        /* Isolate rendering context to prevent external cascade leak */
        .pptx-isolated-canvas-wrapper {
          isolation: isolate;
          width: 100%;
          height: 100%;
          display: flex;
          flex: 1 1 0%;
          min-height: 0;
          position: relative;
          background-color: #f1f5f9;
        }

        /* Viewport fill and background */
        .pptx-isolated-canvas-wrapper [data-pptx-viewport="true"] {
          background-color: #f1f5f9 !important;
          width: 100% !important;
          height: 100% !important;
          outline: none !important;
        }

        /* Slide stage card styling: clean institutional border and shadow */
        .pptx-isolated-canvas-wrapper [role="region"][aria-roledescription="slide"] {
          border-radius: 4px !important;
          box-shadow: 0 4px 24px -2px rgba(15, 23, 42, 0.12), 0 2px 8px -1px rgba(15, 23, 42, 0.08) !important;
          border: 1px solid #e2e8f0 !important;
          background-color: #ffffff !important;
        }

        /* Protect images inside slides from Tailwind's preflight img { max-width: 100%; height: auto; } */
        .pptx-isolated-canvas-wrapper [role="region"][aria-roledescription="slide"] img {
          max-width: none !important;
        }

        /* Protect SVG shapes (e.g. edge cards on slide 3) from being clipped */
        .pptx-isolated-canvas-wrapper [role="region"][aria-roledescription="slide"] svg {
          overflow: visible !important;
        }

        /* Ensure paragraphs inside slide text boxes do not inherit external margin */
        .pptx-isolated-canvas-wrapper [role="region"][aria-roledescription="slide"] p {
          margin: 0 !important;
        }
      `}</style>

      {/* Actual Slide Presentation Canvas */}
      <div className="pptx-isolated-canvas-wrapper pointer-events-auto">
        <SlideCanvas {...blocks.canvasProps} showRulers={false} showGrid={false} />
      </div>

      {/* Spatial Left Navigation Edge Trigger (Hover affordance) */}
      <div 
        onClick={(e) => { e.stopPropagation(); navigatePrev(); }}
        className="absolute left-0 top-0 bottom-0 w-20 sm:w-28 z-10 cursor-pointer flex items-center justify-start pl-3 group select-none pointer-events-auto"
        title="Previous Slide (Arrow Left / Click)"
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-xs border border-slate-200 shadow-md rounded-full p-2 text-slate-600 hover:text-slate-900 hover:scale-105 active:scale-95 transition-transform">
          <ChevronLeft className="w-5 h-5" />
        </div>
      </div>

      {/* Spatial Right Navigation Edge Trigger (Hover affordance) */}
      <div 
        onClick={(e) => { e.stopPropagation(); navigateNext(); }}
        className="absolute right-0 top-0 bottom-0 w-20 sm:w-28 z-10 cursor-pointer flex items-center justify-end pr-3 group select-none pointer-events-auto"
        title="Next Slide (Arrow Right / Click)"
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-xs border border-slate-200 shadow-md rounded-full p-2 text-slate-600 hover:text-slate-900 hover:scale-105 active:scale-95 transition-transform">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* Minimal Floating Bottom Presentation Pill (Auto-hides after 2.5s idle) */}
      <div 
        className={`floating-toolbar absolute bottom-4 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300 pointer-events-auto ${
          isIdle ? 'opacity-35 hover:opacity-100' : 'opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-md rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs text-slate-700 select-none">
          
          {/* Slide Indicator */}
          <span className="font-mono text-xs font-semibold text-slate-800 min-w-[50px] text-center px-1">
            {currentSlide} / {totalSlides}
          </span>

          <div className="h-3.5 w-px bg-slate-200"></div>

          {/* Previous Slide */}
          <button
            type="button"
            onClick={navigatePrev}
            disabled={currentSlide <= 1}
            className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
            title="Previous Slide (Arrow Left)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Next Slide */}
          <button
            type="button"
            onClick={navigateNext}
            disabled={currentSlide >= totalSlides}
            className="p-1 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
            title="Next Slide (Arrow Right)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-200"></div>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={navigateZoomOut}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
            title="Zoom Out (Ctrl + -)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Reset to Fit */}
          <button
            type="button"
            onClick={navigateFit}
            className="px-2 py-0.5 rounded-md hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
            title="Reset to Fit"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Fit</span>
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={navigateZoomIn}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
            title="Zoom In (Ctrl + +)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-200"></div>

          {/* Zoom Scale Percentage */}
          <span className="font-mono text-xs font-medium text-slate-600 min-w-[38px] text-center">
            {Math.round(currentZoom * 100)}%
          </span>

          <div className="h-3.5 w-px bg-slate-200"></div>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-slate-700" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
