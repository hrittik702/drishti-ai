import React, { useState, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, AlertCircle, Download } from 'lucide-react';
import { calculateFitDimensions } from '../../utils/imageFit';
import { ensureRenderableBlob } from '../../utils/fileTypes';

export { calculateFitDimensions };

export default function ImageViewer({ blob, filename, onDownload }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [currentScale, setCurrentScale] = useState(1);
  const [isIdle, setIsIdle] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const idleTimerRef = useRef(null);
  const containerRef = useRef(null);
  const transformComponentRef = useRef(null);
  const imgRef = useRef(null);

  // Manage Object URL creation, validation, and lifecycle
  useEffect(() => {
    let createdUrl = null;
    setHasError(false);
    setIsLoaded(false);

    if (!blob) {
      setImageUrl(null);
      return;
    }

    try {
      if (typeof blob === 'string') {
        setImageUrl(blob);
      } else {
        const renderableBlob = ensureRenderableBlob(blob, filename);
        if (!renderableBlob || !(renderableBlob instanceof Blob) || renderableBlob.size === 0) {
          setHasError(true);
          setImageUrl(null);
          return;
        }

        createdUrl = URL.createObjectURL(renderableBlob);
        if (!createdUrl || typeof createdUrl !== 'string' || !createdUrl.startsWith('blob:')) {
          setHasError(true);
          setImageUrl(null);
          return;
        }

        setImageUrl(createdUrl);
      }
    } catch (err) {
      console.error('Failed to construct image source:', err);
      setHasError(true);
      setImageUrl(null);
    }

    // Cleanup: revoke URL ONLY when unmounted or source changes
    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [blob, filename, retryCount]);

  // Center / reset on resize or Inspector toggle when in 1.0x fit mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => {
      if (currentScale <= 1.05) {
        transformComponentRef.current?.resetTransform(0);
      }
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(handleResize);
      ro.observe(el);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', handleResize);
    };
  }, [currentScale]);

  // When image finishes loading, ensure clean centered fit
  const handleImageLoad = (e) => {
    const target = e.target;
    const isSvg = filename?.toLowerCase().endsWith('.svg');
    if ((target.naturalWidth > 0 && target.naturalHeight > 0) || isSvg) {
      setHasError(false);
      setIsLoaded(true);
      transformComponentRef.current?.resetTransform(0);
      setCurrentScale(1);
    } else {
      setHasError(true);
      setIsLoaded(false);
    }
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoaded(false);
    setRetryCount(c => c + 1);
  };

  // Auto-hide bottom controls after 2.5s idle
  const handleActivity = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 2500);
  };

  useEffect(() => {
    handleActivity();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Dedicated non-passive wheel listener: Zooms ONLY the image document and stops browser page zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (transformComponentRef.current) {
          if (e.deltaY < 0) {
            transformComponentRef.current.zoomIn(0.15);
          } else {
            transformComponentRef.current.zoomOut(0.15);
          }
        }
        handleActivity();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Keyboard zoom controls (Ctrl/Cmd + Plus, Minus, Zero)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.target?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        transformComponentRef.current?.zoomIn(0.15);
        handleActivity();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        transformComponentRef.current?.zoomOut(0.15);
        handleActivity();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        transformComponentRef.current?.resetTransform();
        setCurrentScale(1);
        handleActivity();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Error State: "Unable to preview image", [Retry] [Download Original]
  if (hasError || (!blob && !imageUrl)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-100 select-none">
        <div className="p-3 bg-red-50 border border-red-200 rounded-full text-red-600 mb-3">
          <AlertCircle className="w-6 h-6 stroke-2" />
        </div>
        <h4 className="text-slate-800 font-semibold text-sm mb-1">
          Unable to preview image
        </h4>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          The image file could not be displayed. You can retry loading or download the authentic file.
        </p>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Original</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const isZoomed = currentScale > 1.05;

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full min-h-0 bg-slate-100 overflow-hidden select-none"
      onMouseMove={handleActivity}
    >
      <TransformWrapper
        ref={transformComponentRef}
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit={true}
        centerZoomedOut={true}
        limitToBounds={false}
        onTransformed={(ref) => {
          setCurrentScale(ref.state.scale);
          handleActivity();
        }}
        wheel={{
          disabled: true
        }}
        pinch={{ step: 4 }}
        doubleClick={{
          mode: 'toggle',
          step: 0.5
        }}
        panning={{
          disabled: !isZoomed,
          velocityDisabled: true
        }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Viewport Canvas: 100% of container space, centered */}
            <div 
              className={`flex-1 min-h-0 w-full h-full overflow-hidden flex items-center justify-center ${
                isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
            >
              <TransformComponent
                wrapperClass="!w-full !h-full flex items-center justify-center"
                contentClass="!w-full !h-full flex items-center justify-center p-3 sm:p-5"
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt={filename || 'Evidence Photo'}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  style={{
                    objectFit: 'contain',
                    width: '100%',
                    height: '100%',
                    display: 'block'
                  }}
                  className="select-none pointer-events-auto rounded-sm drop-shadow-sm"
                />
              </TransformComponent>
            </div>

            {/* Minimal Floating Light Toolbar (Centered at bottom, auto-hides when idle) */}
            <div 
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-300 pointer-events-auto ${
                isIdle ? 'opacity-40 hover:opacity-100' : 'opacity-100'
              }`}
            >
              <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-md rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs text-slate-700 select-none">
                
                {/* Zoom Out */}
                <button
                  type="button"
                  onClick={() => zoomOut(0.15)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                {/* Reset to Fit */}
                <button
                  type="button"
                  onClick={() => {
                    resetTransform();
                    setCurrentScale(1);
                  }}
                  className="px-2 py-0.5 rounded-md hover:bg-slate-100 text-slate-700 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1"
                  title="Fit to Window (Reset)"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Fit</span>
                </button>

                {/* Zoom In */}
                <button
                  type="button"
                  onClick={() => zoomIn(0.15)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="h-3.5 w-px bg-slate-200"></div>

                {/* Scale Percentage Indicator */}
                <span className="font-mono text-xs font-medium text-slate-600 min-w-[38px] text-center">
                  {Math.round(currentScale * 100)}%
                </span>

                <span className="text-[11px] text-slate-400 pl-1 border-l border-slate-200 hidden sm:inline font-normal">
                  Ctrl + Wheel to Zoom
                </span>
              </div>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
