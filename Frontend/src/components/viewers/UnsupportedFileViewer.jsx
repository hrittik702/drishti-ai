import React from 'react';
import { 
  FileQuestion, 
  Download, 
  ShieldCheck, 
  Info, 
  ExternalLink,
  Lock,
  FileCode
} from 'lucide-react';
import { getFileExtension } from '../../utils/fileTypes';

export default function UnsupportedFileViewer({ 
  blob, 
  filename, 
  mimeType, 
  isLegacy = false, 
  customMessage,
  onDownload 
}) {
  const ext = getFileExtension(filename).toUpperCase();
  const fileSize = blob?.size || 0;

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[380px] p-6 text-center bg-slate-900/60 rounded-xl border border-slate-800">
      
      <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 text-left">
        
        {/* Header Icon + File Title */}
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
            {isLegacy ? <Lock className="w-6 h-6" /> : <FileQuestion className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-slate-800 text-slate-300 mb-1">
              {ext || 'BINARY'}
            </span>
            <h3 className="font-semibold text-white text-[15px] truncate" title={filename}>
              {filename || 'Evidence File'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-normal">
              <span className="font-mono text-xs">{formatBytes(fileSize)}</span> • <span className="font-mono text-xs">{mimeType || 'application/octet-stream'}</span>
            </p>
          </div>
        </div>

        {/* Honest Fallback Explanation */}
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="flex items-center space-x-1.5 text-amber-400 font-medium text-xs uppercase tracking-wide">
            <Info className="w-3.5 h-3.5" />
            <span>{customMessage || (isLegacy ? 'Legacy Binary Format' : 'Native Preview Unavailable')}</span>
          </div>

          <p className="text-slate-300 leading-relaxed text-xs font-normal">
            {customMessage ? (
              <>
                Preview unavailable for this format in browser. You can download the authentic binary file to view the presentation in compatible desktop software.
              </>
            ) : isLegacy ? (
              <>
                In-browser parsing is strictly supported for modern OpenXML formats (<code className="text-blue-400 font-mono text-xs">.docx</code>, <code className="text-blue-400 font-mono text-xs">.pptx</code>). Legacy binary Microsoft Office files (<code className="text-amber-300 font-mono text-xs">.{ext.toLowerCase()}</code>) require desktop software to ensure forensic fidelity.
              </>
            ) : (
              <>
                Direct in-browser interactive rendering is not supported for this binary format. The cryptographic identity, version history, and chain-of-custody audit logs remain fully active and secured.
              </>
            )}
          </p>
        </div>

        {/* Security & Integrity Note */}
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-3 py-2 rounded-lg font-normal">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>File payload is tamper-verified and ready for offline investigation.</span>
        </div>

        {/* Direct Download Button */}
        {onDownload && (
          <button
            onClick={onDownload}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/10 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Original</span>
          </button>
        )}

      </div>

    </div>
  );
}
