import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, AlertCircle, Download, FileText } from 'lucide-react';

export default function DocxViewer({ blob, filename, onDownload }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    if (!blob) {
      setLoading(false);
      setError('No DOCX file binary provided.');
      return;
    }

    setLoading(true);
    setError(null);

    const renderDocx = async () => {
      try {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        await renderAsync(blob, containerRef.current, null, {
          className: 'docx-preview-rendered',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          experimental: true
        });

        if (!isCancelled) {
          setLoading(false);
        }
      } catch (err) {
        console.error('docx-preview error:', err);
        if (!isCancelled) {
          setError(err?.message || 'Unable to parse DOCX document structure.');
          setLoading(false);
        }
      }
    };

    renderDocx();

    return () => {
      isCancelled = true;
    };
  }, [blob]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-100 overflow-hidden">
      
      {/* Loading overlay */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2 m-auto">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-medium">Parsing DOCX document...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="m-auto text-center p-6 bg-white border border-red-200 rounded-xl max-w-sm space-y-2">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <div className="font-semibold text-slate-800 text-xs">DOCX Preview Unavailable</div>
          <p className="text-xs text-slate-500 font-normal">{error}</p>
          {onDownload && (
            <button
              onClick={onDownload}
              className="mt-2 inline-flex items-center space-x-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Original Document</span>
            </button>
          )}
        </div>
      )}

      {/* Render container: Begins cleanly below header */}
      <div 
        className={`flex-1 min-h-0 overflow-auto px-3 sm:px-4 pt-1 sm:pt-1.5 pb-16 flex justify-center items-start ${loading || error ? 'hidden' : ''}`}
      >
        <div 
          ref={containerRef} 
          className="bg-white shadow-md border border-slate-300 rounded max-w-4xl w-full p-6 text-slate-900 text-sm leading-relaxed"
        />
      </div>

    </div>
  );
}
