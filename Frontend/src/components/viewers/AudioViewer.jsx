import React, { useMemo, useState, useEffect } from 'react';
import { Music, AlertCircle, Download, Volume2, Play, Pause } from 'lucide-react';
import { objectUrlManager } from '../../utils/objectUrlManager';

export default function AudioViewer({ blob, filename, mimeType, onDownload }) {
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    if (!blob) {
      setAudioUrl(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    setError(null);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  if (!blob) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <AlertCircle className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
        <span className="text-xs font-medium">No audio media provided</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[360px] bg-slate-100 rounded-xl p-8 border border-slate-200">
      
      {/* Central Audio Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-6">
        
        {/* Cover / Visualizer Art */}
        <div className="relative w-28 h-28 mx-auto rounded-2xl bg-gradient-to-tr from-amber-50 to-orange-100 border border-amber-200 flex items-center justify-center shadow-xs">
          <div className="absolute inset-0 rounded-2xl bg-amber-500/5 animate-pulse" />
          <Music className="w-12 h-12 text-amber-600" />
        </div>

        {/* Track Metadata */}
        <div className="text-center space-y-1">
          <h3 className="font-semibold text-slate-900 text-[15px] truncate" title={filename}>
            {filename || 'Audio Recording'}
          </h3>
          <p className="text-xs text-slate-500 font-normal">
            <span className="font-mono text-xs">{mimeType || 'audio/mpeg'}</span> • <span className="font-mono text-xs">{(blob.size / 1024).toFixed(1)} KB</span>
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center space-y-1">
            <p className="text-xs text-red-600 font-normal">{error}</p>
          </div>
        )}

        {/* Native HTML5 Audio Player */}
        <div className="pt-2">
          <audio
            controls
            src={audioUrl}
            onError={() => setError('Audio codec not supported by browser. Download the file to listen locally.')}
            className="w-full h-11 rounded-lg"
          >
            Your browser does not support the audio element.
          </audio>
        </div>

        {/* Quick Download CTA */}
        {onDownload && (
          <div className="pt-2 border-t border-slate-100 flex justify-center">
            <button
              onClick={onDownload}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors py-1 px-3 rounded-lg hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Audio Evidence</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
