import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreVertical, 
  Download, 
  ShieldCheck, 
  Share2, 
  History, 
  Trash2, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import DocumentThumbnail from './DocumentThumbnail';
import { getFileInfo } from '../utils/fileTypes';

export default function DocumentCard({
  doc,
  onOpenWorkspace,
  onDownload,
  onVerifyIntegrity,
  onOpenShare,
  onDelete,
  isSelected = false,
  isOcrRunning = false,
  currentUser,
  currentRole
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const fileInfo = getFileInfo(doc.mimeType, doc.name);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const canDelete = currentUser?.role?.id === 'administrator' || 
    currentRole?.id === 'administrator' || 
    (currentUser?.role?.permissions || currentRole?.permissions || []).includes('delete');

  const formattedDate = doc.createdAt 
    ? new Date(doc.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

  return (
    <div
      onClick={() => onOpenWorkspace(doc)}
      className={`group bg-white rounded-lg border transition-all cursor-pointer flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-xs ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-[16/10] w-full border-b border-slate-100 overflow-hidden bg-slate-50">
        <DocumentThumbnail doc={doc} />

        {/* Classification Tag Overlay */}
        {doc.classification && (
          <div className="absolute top-2 left-2 pointer-events-none">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded shadow-2xs border ${
              doc.classification === 'Top Secret' ? 'bg-red-900/90 text-red-100 border-red-700' :
              doc.classification === 'Secret' ? 'bg-amber-900/90 text-amber-100 border-amber-700' :
              'bg-slate-900/80 text-white border-slate-700'
            }`}>
              {doc.classification}
            </span>
          </div>
        )}

        {/* Three-dot Action Trigger */}
        <div className="absolute top-2 right-2" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="w-7 h-7 rounded-md bg-white/90 hover:bg-white text-slate-700 shadow-2xs border border-slate-200/80 flex items-center justify-center transition-colors"
            title="Document actions"
            aria-label="Document actions"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {/* Action Menu Dropdown */}
          {menuOpen && (
            <div 
              className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenWorkspace(doc);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Open Workspace</span>
              </button>

              {onDownload && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDownload(doc);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download</span>
                </button>
              )}

              {onVerifyIntegrity && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onVerifyIntegrity(doc);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verify Integrity</span>
                </button>
              )}

              {onOpenShare && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenShare(doc);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Share / Access</span>
                </button>
              )}

              {canDelete && onDelete && (
                <>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(doc);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 flex items-center space-x-2 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Document</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Body Metadata */}
      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
        <div>
          {/* Filename */}
          <h3 
            className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate"
            title={doc.name}
          >
            {doc.name}
          </h3>

          {/* Case & Type */}
          <div className="flex items-center space-x-1.5 text-[13px] text-slate-500 mt-1 truncate font-normal">
            <span className="font-mono text-xs text-blue-700 font-medium shrink-0">
              #{doc.caseId}
            </span>
            <span>·</span>
            <span className="truncate">
              {doc.type || fileInfo.label}
            </span>
          </div>
        </div>

        {/* Status, Version, and Date Row */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          {/* Integrity / OCR Status */}
          <div className="flex items-center space-x-1.5">
            {doc.isTampered ? (
              <span className="inline-flex items-center space-x-0.5 text-red-700 font-medium bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-xs">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>Mismatch</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-0.5 text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-xs">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified</span>
              </span>
            )}

            {isOcrRunning && (
              <span className="inline-flex items-center text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono text-xs animate-pulse font-medium" title="OCR Running">
                <Loader2 className="w-3 h-3 animate-spin" />
              </span>
            )}
          </div>

          {/* Version and Date */}
          <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-xs font-normal">
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 font-medium">
              {doc.currentVersion || 'v1'}
            </span>
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
