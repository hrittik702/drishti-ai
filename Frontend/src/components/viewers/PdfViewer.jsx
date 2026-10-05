import React, { useState, useEffect, useMemo, Suspense, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Loader2, 
  AlertCircle,
  Layers,
  FileText,
  RotateCcw
} from 'lucide-react';

// Configure PDF.js worker using relative URL handled by Vite
if (typeof window !== 'undefined' && pdfjs && pdfjs.GlobalWorkerOptions) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
  } catch (e) {
    console.warn('PDF.js worker initialization notice:', e);
  }
}

export default function PdfViewer({ blob, filename, onDownload }) {
  const getInitialScale = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return Math.min(1.0, Math.max(0.45, (window.innerWidth - 32) / 600));
    }
    return 1.15;
  };

  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(getInitialScale);
  const [loading, setLoading] = useState(true);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [isIdle, setIsIdle] = useState(false);
  const [pageTransitioning, setPageTransitioning] = useState(false);

  const containerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const touchStartRef = useRef(null);

  // Managed Object URL for iframe embed / open in new tab
  useEffect(() => {
    if (!blob) {
      setFileUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setFileUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  // Read binary data directly into a Uint8Array so PDF.js doesn't need to fetch() a blob URL
  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      setFileData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    blob.arrayBuffer()
      .then(buffer => {
        if (!isCancelled) {
          setFileData(new Uint8Array(buffer));
        }
      })
      .catch(err => {
        console.warn('Failed to read blob into ArrayBuffer, falling back to native iframe:', err);
        if (!isCancelled) {
          setUseNativeFallback(true);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [blob]);

  // Auto-hide bottom controls after 2.5s idle
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

  // Memoize file source object so react-pdf doesn't re-parse on every render
  const fileSource = useMemo(() => {
    if (!fileData) return null;
    return { data: fileData };
  }, [fileData]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  };

  const onDocumentLoadError = (err) => {
    console.warn('react-pdf parsing notice, switching to native browser PDF engine:', err);
    setUseNativeFallback(true);
    setLoading(false);
  };

  const changePage = useCallback((offset) => {
    setPageNumber(prev => {
      const target = Math.min(Math.max(1, prev + offset), numPages || 1);
      if (target !== prev) {
        setPageTransitioning(true);
        setTimeout(() => setPageTransitioning(false), 140);
      }
      return target;
    });
    handleActivity();
  }, [numPages, handleActivity]);

  const handleZoom = useCallback((delta) => {
    setScale(prev => Math.min(Math.max(0.5, Number((prev + delta).toFixed(2))), 2.5));
    handleActivity();
  }, [handleActivity]);

  const resetZoom = useCallback(() => {
    setScale(getInitialScale());
    handleActivity();
  }, [handleActivity]);

  // Desktop Keyboard Shortcuts (ArrowLeft, ArrowRight, PageUp, PageDown, Home, End, Ctrl+/-)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.target?.isContentEditable) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        changePage(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        changePage(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setPageNumber(1);
      } else if (e.key === 'End' && numPages) {
        e.preventDefault();
        setPageNumber(numPages);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoom(0.15);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        handleZoom(-0.15);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changePage, handleZoom, resetZoom, numPages]);

  // Wheel interaction: normal wheel scrolls; Ctrl/Cmd + wheel zooms
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        handleZoom(delta);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleZoom]);

  // Touch Swipe Navigation for Mobile/Tablet
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaY) < 40) {
      if (deltaX < 0) {
        changePage(1);
      } else {
        changePage(-1);
      }
    }
  };

  if (!blob || !fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <AlertCircle className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
        <span className="text-xs font-semibold">No PDF binary available</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative flex flex-col h-full min-h-0 bg-slate-100 overflow-hidden select-none"
      onMouseMove={handleActivity}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      
      {/* PDF Viewport Canvas: Consumes 100% of remaining vertical height */}
      <div 
        className="flex-1 min-h-0 overflow-auto px-3 sm:px-4 pt-1 sm:pt-1.5 pb-20 flex justify-center items-start relative select-text"
      >
        {useNativeFallback ? (
          // Embedded Native Browser PDF Engine Fallback
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=0`}
            className="w-full h-full rounded-lg border-0 bg-white shadow-sm"
            title={filename || 'PDF Document'}
          />
        ) : (
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2 m-auto">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading PDF document...</span>
            </div>
          }>
            {fileSource ? (
              <Document
                file={fileSource}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                suspense={false}
                loading={
                  <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2 m-auto">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium">Rendering PDF pages...</span>
                  </div>
                }
                error={
                  <div className="m-auto text-center p-6 bg-white border border-slate-200 rounded-xl max-w-sm space-y-3 shadow-sm">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                    <div className="font-semibold text-slate-800 text-xs">Switching to Native PDF Viewer</div>
                    <p className="text-xs text-slate-500 font-normal">
                      The canvas renderer encountered a worker policy restriction. Click below to view via the native engine.
                    </p>
                    <button
                      onClick={() => setUseNativeFallback(true)}
                      className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      <span>Activate Native Viewer</span>
                    </button>
                  </div>
                }
              >
                {numPages ? (
                  // Document Content: Clicking on content stops propagation to protect text selection/reading
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className={`shadow-md rounded-sm overflow-hidden bg-white border border-slate-300 z-10 transition-opacity duration-150 ${
                      pageTransitioning ? 'opacity-85' : 'opacity-100'
                    }`}
                  >
                    <Page 
                      pageNumber={pageNumber} 
                      scale={scale} 
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      suspense={false}
                      onRenderError={() => setUseNativeFallback(true)}
                    />
                  </div>
                ) : null}
              </Document>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2 m-auto">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Reading PDF binary payload...</span>
              </div>
            )}
          </Suspense>
        )}
      </div>

      {/* Invisible Spatial Left Navigation Zone (Previous Page) */}
      {!useNativeFallback && numPages > 1 && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            changePage(-1);
          }}
          className={`absolute left-0 top-0 bottom-16 w-[10%] min-w-[48px] max-w-[120px] z-20 flex items-center justify-start pl-3 sm:pl-5 transition-all select-none group ${
            pageNumber <= 1 ? 'cursor-default pointer-events-none' : 'cursor-pointer'
          }`}
          title="Previous Page (Click or Left Arrow)"
          aria-label="Previous Page"
        >
          {pageNumber > 1 && (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 border border-slate-200/90 shadow-md flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 backdrop-blur-xs hover:bg-white hover:text-blue-700">
              <ChevronLeft className="w-4 h-4" />
            </div>
          )}
        </div>
      )}

      {/* Invisible Spatial Right Navigation Zone (Next Page) */}
      {!useNativeFallback && numPages > 1 && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            changePage(1);
          }}
          className={`absolute right-0 top-0 bottom-16 w-[10%] min-w-[48px] max-w-[120px] z-20 flex items-center justify-end pr-3 sm:pr-5 transition-all select-none group ${
            pageNumber >= numPages ? 'cursor-default pointer-events-none' : 'cursor-pointer'
          }`}
          title="Next Page (Click or Right Arrow)"
          aria-label="Next Page"
        >
          {pageNumber < numPages && (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 border border-slate-200/90 shadow-md flex items-center justify-center text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 backdrop-blur-xs hover:bg-white hover:text-blue-700">
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>
      )}

      {/* Minimal Floating Contextual Bottom Pill */}
      <div 
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 transition-opacity duration-300 pointer-events-auto ${
          isIdle ? 'opacity-40 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 shadow-md rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs text-slate-700 select-none">
          
          {/* Subtle Page Indicator */}
          <span className="font-mono text-xs text-slate-800 font-medium px-1">
            {pageNumber} / {numPages || '...'}
          </span>

          {!useNativeFallback && (
            <>
              <div className="h-3.5 w-px bg-slate-200"></div>

              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => handleZoom(-0.15)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              {/* Fit / Reset */}
              <button
                type="button"
                onClick={resetZoom}
                className="px-1.5 py-0.5 text-xs rounded-md hover:bg-slate-100 text-slate-700 font-medium cursor-pointer transition-colors"
                title="Reset to Fit Width"
              >
                Fit
              </button>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => handleZoom(0.15)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <div className="h-3.5 w-px bg-slate-200"></div>

          {/* Toggle Native / Canvas */}
          <button
            type="button"
            onClick={() => setUseNativeFallback(prev => !prev)}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs flex items-center gap-1 font-medium cursor-pointer transition-colors"
            title={useNativeFallback ? "Switch to Canvas Viewer" : "Switch to Browser Native PDF Engine"}
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">{useNativeFallback ? 'Canvas' : 'Native'}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
