import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronLeft, 
  Download, 
  ShieldCheck, 
  Share2, 
  MoreVertical, 
  Trash2, 
  Info, 
  FileText, 
  History, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check, 
  Search, 
  Loader2, 
  X,
  User,
  Calendar,
  Lock,
  RotateCcw,
  Clock,
  Shield,
  ExternalLink
} from 'lucide-react';
import DocumentViewer from './viewers/DocumentViewer';
import { DocumentRepository } from '../services/documentRepository';
import { AuditRepository } from '../services/auditRepository';
import { SharingService } from '../services/sharingService';
import { getFileInfo, ensureRenderableBlob } from '../utils/fileTypes';

function HighlightedOcrText({ text, query }) {
  if (!text || !query) return <span>{text}</span>;
  const parts = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return <span>{text}</span>;

  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerQuery, lastIndex);

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.substring(lastIndex, idx), highlight: false });
    }
    parts.push({ text: text.substring(idx, idx + lowerQuery.length), highlight: true });
    lastIndex = idx + lowerQuery.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), highlight: false });
  }

  return (
    <span>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark key={i} className="bg-yellow-200 text-yellow-950 font-semibold px-0.5 rounded">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
}

export default function DocumentWorkspace({
  doc,
  onBack,
  onDownload,
  onVerifyIntegrity,
  onSimulateTamper,
  onRestore,
  onOpenShare,
  onDelete,
  currentUser,
  currentRole,
  addToast,
  onStartOcr,
  onCancelOcr,
  activeOcrJobs = {},
  onDocumentUpdated
}) {
  const [blob, setBlob] = useState(null);
  const [versions, setVersions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingBlob, setLoadingBlob] = useState(true);

  // Collapsible Information Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('details'); // 'details' | 'integrity' | 'versions' | 'access' | 'ocr' | 'activity'
  
  // OCR search & copy state
  const [ocrSearchTerm, setOcrSearchTerm] = useState('');
  const [copiedOcr, setCopiedOcr] = useState(false);

  // More menu dropdown
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  const fileInfo = getFileInfo(doc?.mimeType, doc?.name);

  // Load real file Blob, versions, and audit logs for this document
  useEffect(() => {
    let isMounted = true;
    if (!doc) return;

    setLoadingBlob(true);

    // Fast path: if doc already has originalBlob or fileBlob attached in memory
    const fastBlob = ensureRenderableBlob(doc.originalBlob || doc.fileBlob, doc.name, doc.mimeType);
    if (fastBlob) {
      setBlob(fastBlob);
      setLoadingBlob(false);
    }

    // 1. Fetch file blob from IndexedDB (with document fallback)
    DocumentRepository.getVersionBlob(doc.currentVersionId, doc.id)
      .then(b => {
        if (isMounted) {
          if (b) {
            setBlob(b);
          }
          setLoadingBlob(false);
        }
      })
      .catch(err => {
        console.error('Error fetching version blob:', err);
        if (isMounted) setLoadingBlob(false);
      });

    // 2. Fetch version lineage
    DocumentRepository.getDocumentVersions(doc.id)
      .then(vList => {
        if (isMounted) setVersions(vList);
      });

    // 3. Fetch document audit history
    AuditRepository.getAuditEventsByTarget(doc.id)
      .then(aList => {
        if (isMounted) setAuditLogs(aList);
      });

    return () => {
      isMounted = false;
    };
  }, [doc?.id, doc?.currentVersionId, doc?.updatedAt]);

  // Keyboard Escape listener
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (drawerOpen) {
          setDrawerOpen(false);
        } else {
          onBack();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, onBack]);

  // Prevent browser-level window zoom so that ONLY the document viewer scales
  useEffect(() => {
    const preventBrowserZoom = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const preventBrowserZoomKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '_', '0'].includes(e.key)) {
        e.preventDefault();
      }
    };

    const preventGesture = (e) => {
      e.preventDefault();
    };

    window.addEventListener('wheel', preventBrowserZoom, { passive: false });
    window.addEventListener('keydown', preventBrowserZoomKeys);
    window.addEventListener('gesturestart', preventGesture);
    window.addEventListener('gesturechange', preventGesture);

    return () => {
      window.removeEventListener('wheel', preventBrowserZoom);
      window.removeEventListener('keydown', preventBrowserZoomKeys);
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
    };
  }, []);

  // Close more menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  if (!doc) return null;

  const canDelete = currentUser?.role?.id === 'administrator' || 
    currentRole?.id === 'administrator' || 
    (currentUser?.role?.permissions || currentRole?.permissions || []).includes('delete');

  const shares = SharingService.getSharesForDocument(doc.id);
  const accessCheck = SharingService.checkDocumentAccess(currentUser || currentRole, doc);
  const isOcrRunning = Boolean(activeOcrJobs[doc.id]);

  const handleCopyOcr = () => {
    if (doc.ocr?.extractedText) {
      navigator.clipboard.writeText(doc.ocr.extractedText);
      setCopiedOcr(true);
      setTimeout(() => setCopiedOcr(false), 2000);
      if (addToast) addToast('Copied', 'OCR extracted text copied to clipboard.', 'success');
    }
  };

  const handleRevokeShare = (shareId) => {
    SharingService.revokeShare(shareId, currentUser || currentRole);
    if (addToast) addToast('Access Revoked', 'Delegated sharing grant has been immediately terminated.', 'info');
    onDocumentUpdated && onDocumentUpdated();
  };

  const maskedHash = doc.storedHash || doc.hash 
    ? `${(doc.storedHash || doc.hash).slice(0, 14)}••••••••••••••••${(doc.storedHash || doc.hash).slice(-8)}`
    : 'Not Anchored';

  const content = (
    <div 
      className="fixed inset-0 bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150"
      style={{ zIndex: 100 }}
    >
      
      {/* Top Workspace Bar: Sleek institutional bar at exact top 0 */}
      <header className="h-11 sm:h-12 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 shrink-0 shadow-2xs z-10">
        
        {/* Left: Back button & Document Identity */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1 text-slate-700 hover:text-blue-700 hover:bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer"
            title="Return to Document Vault (Esc)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

          <div className="min-w-0">
            <h1 className="text-[15px] sm:text-base font-semibold text-slate-900 truncate leading-tight" title={doc.name}>
              {doc.name}
            </h1>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-normal leading-none mt-0.5">
              <span className="text-blue-700 font-mono font-medium">#{doc.caseId}</span>
              <span>•</span>
              <span className="text-[13px]">{doc.type || fileInfo.label}</span>
              <span>•</span>
              <span className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600 font-mono text-[11px] font-medium">
                {doc.currentVersion || 'v1'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Drawer Toggle */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          
          {/* Quick Integrity Pill */}
          <div className="hidden md:flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-slate-50">
            {doc.isTampered ? (
              <span className="text-red-700 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Mismatch</span>
              </span>
            ) : (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified</span>
              </span>
            )}
          </div>

          {/* Download Original File */}
          {onDownload && (
            <button
              onClick={() => onDownload(doc, blob)}
              className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold shadow-xs transition-colors"
              title="Download original authentic file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
          )}

          {/* Share / Delegate Access */}
          {onOpenShare && (
            <button
              onClick={() => onOpenShare(doc)}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition-colors"
              title="Share document or grant access"
            >
              <Share2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}

          {/* Drawer Toggle Button */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold border transition-colors ${
              drawerOpen 
                ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-2xs' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
            title="Toggle document inspector drawer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Inspector</span>
          </button>

          {/* More Action Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md border border-transparent hover:border-slate-200 transition-colors"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-30 text-xs animate-in fade-in duration-100">
                {onVerifyIntegrity && (
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onVerifyIntegrity(doc);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verify Digital Seal</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setDrawerTab('versions');
                    setDrawerOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <History className="w-3.5 h-3.5 text-blue-600" />
                  <span>Version Lineage</span>
                </button>

                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setDrawerTab('activity');
                    setDrawerOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Audit Trail</span>
                </button>

                {canDelete && onDelete && (
                  <>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={() => {
                        setMoreMenuOpen(false);
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
      </header>

      {/* Main Workspace Body: Actual Document Center + Floating Information Drawer */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden bg-slate-100">
        
        {/* CENTER: Actual Document Viewer Canvas */}
        <div className="flex-1 min-h-0 min-w-0 h-full flex flex-col relative overflow-hidden">
          <DocumentViewer
            document={doc}
            blob={blob}
            loading={loadingBlob}
            onDownload={() => onDownload && onDownload(doc, blob)}
            onVerifyIntegrity={() => onVerifyIntegrity && onVerifyIntegrity(doc)}
          />
        </div>

        {/* RIGHT DRAWER: Floating Document Information & Management Panel */}
        {drawerOpen && (
          <>
            {/* Subtle backdrop overlay with blur */}
            <div 
              className="fixed sm:absolute inset-0 z-40 sm:z-30 bg-slate-900/20 sm:bg-slate-900/10 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150" 
              onClick={() => setDrawerOpen(false)}
              aria-label="Close Inspector"
            />
            <aside className="fixed sm:absolute inset-x-0 bottom-0 sm:inset-y-0 sm:left-auto sm:right-0 z-50 sm:z-40 w-full sm:w-[380px] bg-white border-t sm:border-t-0 sm:border-l border-slate-200 rounded-t-2xl sm:rounded-none flex flex-col h-[85vh] sm:h-full max-h-[85vh] sm:max-h-full shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
              
              {/* Drag pill for mobile */}
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />

              {/* Drawer Header */}
              <div className="px-4 py-2.5 sm:py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-sm text-slate-900">Document Inspector</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 sm:p-1 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-md"
                  aria-label="Close drawer"
                  title="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            {/* Drawer Tabs */}
            <div className="px-3 border-b border-slate-200 bg-slate-50 flex items-center space-x-1 overflow-x-auto text-xs shrink-0 select-none">
              {[
                { id: 'details', label: 'Details' },
                { id: 'integrity', label: 'Integrity' },
                { id: 'versions', label: `Versions (${versions.length})` },
                { id: 'access', label: `Access (${shares.length})` },
                { id: 'ocr', label: isOcrRunning ? 'OCR (Running)' : 'OCR' },
                { id: 'activity', label: `Activity (${auditLogs.length})` }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDrawerTab(t.id)}
                  className={`py-2 px-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    drawerTab === t.id
                      ? 'border-blue-600 text-blue-700 bg-white shadow-2xs font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Drawer Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs">
              
              {/* TAB 1: DETAILS */}
              {drawerTab === 'details' && (
                <div className="space-y-3.5">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Metadata
                    </span>
                    <div className="space-y-1.5 pt-1 text-[13px]">
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">Case Docket</span>
                        <span className="font-mono font-medium text-blue-700 text-xs">#{doc.caseId}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">Document Type</span>
                        <span className="font-medium text-slate-800">{doc.type || fileInfo.label}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">Classification</span>
                        <span className="font-medium text-slate-800">{doc.classification || 'Confidential'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">File Size</span>
                        <span className="font-mono text-xs font-medium text-slate-700">{(doc.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">Current Version</span>
                        <span className="font-mono text-xs font-medium text-blue-600">{doc.currentVersion || 'v1'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">Uploaded By</span>
                        <span className="text-slate-800 font-medium">{doc.uploadedBy || 'Investigation Officer'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500 font-normal">Date Added</span>
                        <span className="text-slate-700 font-normal">{new Date(doc.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500 font-normal">Last Modified</span>
                        <span className="text-slate-700 font-normal">{new Date(doc.updatedAt || doc.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {doc.description && (
                    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Case Annotation / Remarks
                      </span>
                      <p className="text-slate-700 text-sm font-normal leading-relaxed mt-1">
                        {doc.description}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: INTEGRITY */}
              {drawerTab === 'integrity' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${
                    doc.isTampered 
                      ? 'bg-red-50 border-red-200 text-red-900' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center space-x-2 mb-2">
                      {doc.isTampered ? (
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      )}
                      <span className="font-semibold text-sm">
                        {doc.isTampered ? 'INTEGRITY MISMATCH' : 'CRYPTOGRAPHIC SEAL VERIFIED'}
                      </span>
                    </div>
                    <p className="text-xs font-normal leading-relaxed opacity-90">
                      {doc.isTampered 
                        ? 'Stored digital seal does NOT match calculated bytes in local storage. Evidence has been modified or corrupted.'
                        : 'Authentic bitstream verified against anchored SHA-256 seal under Section 63 BSA.'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Cryptographic Fingerprint (SHA-256)
                      </span>
                      {(doc.storedHash || doc.hash) && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(doc.storedHash || doc.hash);
                            if (addToast) addToast('Copied', 'SHA-256 hash copied to clipboard.', 'success');
                          }}
                          className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                          title="Copy SHA-256 hash"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy Hash</span>
                        </button>
                      )}
                    </div>
                    <div className="font-mono text-xs font-medium bg-white p-2.5 rounded border border-slate-200 text-slate-800 break-all select-all">
                      {doc.storedHash || doc.hash || 'Not Anchored'}
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between pt-1">
                      <span className="font-normal">Legal Status</span>
                      <span className="font-mono text-emerald-600 font-medium">Anchored (BSA Sec 63)</span>
                    </div>
                    {doc.lastVerified && (
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span className="font-normal">Last Verified</span>
                        <span className="font-mono text-slate-700">{new Date(doc.lastVerified).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => onVerifyIntegrity && onVerifyIntegrity(doc)}
                      className="w-full inline-flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Perform Live Verification</span>
                    </button>

                    {/* Demonstration Testing Controls */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => onSimulateTamper && onSimulateTamper(doc)}
                        className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-medium transition-colors"
                        title="Test cryptographic tamper detection against storage alterations"
                      >
                        Test Tamper Detection
                      </button>
                      <button
                        onClick={() => onRestore && onRestore(doc)}
                        className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[11px] font-medium transition-colors"
                        title="Restore original authentic file bytes"
                      >
                        Restore Original
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: VERSIONS */}
              {drawerTab === 'versions' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Version Lineage ({versions.length})
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Immutable Log</span>
                  </div>

                  <div className="space-y-2.5">
                    {versions.map((v, i) => (
                      <div 
                        key={v.id || i}
                        className={`p-3 rounded-lg border transition-all ${
                          v.id === doc.currentVersionId || v.version === doc.currentVersion
                            ? 'bg-blue-50/60 border-blue-200 shadow-2xs'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-medium text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                              {v.version || `v${versions.length - i}`}
                            </span>
                            {(v.id === doc.currentVersionId || v.version === doc.currentVersion) && (
                              <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(v.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-[13px] font-normal text-slate-700 leading-snug mt-1">
                          {v.changeDescription || 'Evidence modification / version update'}
                        </p>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-normal">
                          <span>by {v.author || 'Investigation Officer'}</span>
                          <span className="font-mono text-xs font-medium">{(v.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    ))}

                    {versions.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No previous versions recorded.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: ACCESS & DELEGATION */}
              {drawerTab === 'access' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Active Officer Permissions
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(accessCheck.permissions || ['VIEW']).map((p) => (
                        <span key={p} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono text-slate-700 font-medium">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Delegated Shares ({shares.length})
                      </span>
                      {onOpenShare && (
                        <button
                          onClick={() => onOpenShare(doc)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          + New Share
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {shares.map((s) => (
                        <div key={s.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-900">
                              {s.recipientName || s.recipientEmail}
                            </span>
                            <span className="text-[11px] font-mono font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                              {s.permission}
                            </span>
                          </div>
                          <div className="text-xs font-normal text-slate-500">
                            Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : 'Indefinite'}
                          </div>
                          <button
                            onClick={() => handleRevokeShare(s.id)}
                            className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Revoke Share
                          </button>
                        </div>
                      ))}

                      {shares.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          No active delegation tokens issued.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: OCR EXTRACTED TEXT */}
              {drawerTab === 'ocr' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold text-xs text-slate-900">
                        {isOcrRunning ? 'OCR In Progress...' : doc.ocr?.extractedText ? 'OCR Extracted Text' : 'Optical Character Recognition'}
                      </span>
                    </div>
                    {doc.ocr?.extractedText && (
                      <button
                        onClick={handleCopyOcr}
                        className="inline-flex items-center space-x-1 text-slate-600 hover:text-blue-600 text-xs font-medium"
                      >
                        {copiedOcr ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedOcr ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>

                  {/* OCR Search Bar */}
                  {doc.ocr?.extractedText && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search keywords in extracted text..."
                        value={ocrSearchTerm}
                        onChange={(e) => setOcrSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* OCR Text Display Area */}
                  {doc.ocr?.extractedText ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto select-text">
                      <HighlightedOcrText text={doc.ocr.extractedText} query={ocrSearchTerm} />
                    </div>
                  ) : isOcrRunning ? (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                      <div className="font-semibold text-xs text-slate-800">Processing OCR with Tesseract.js...</div>
                      <p className="text-[11px] text-slate-400">Extracting text layers from document binary.</p>
                      {onCancelOcr && (
                        <button
                          onClick={() => onCancelOcr(doc.id)}
                          className="mt-2 text-xs text-red-600 hover:underline"
                        >
                          Cancel OCR
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto stroke-1" />
                      <div className="text-xs font-semibold text-slate-700">No OCR Text Available</div>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                        Run in-browser OCR to extract searchable text and identify evidentiary keywords.
                      </p>
                      {onStartOcr && fileInfo.ocrEligible && (
                        <button
                          onClick={() => onStartOcr(doc)}
                          className="mt-2 inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Run OCR Now</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: ACTIVITY AUDIT */}
              {drawerTab === 'activity' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Document Custody Events
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Section 63 BSA</span>
                  </div>

                  <div className="space-y-2.5">
                    {auditLogs.map((evt) => (
                      <div key={evt.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-800">
                            {evt.action.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[13px] font-normal text-slate-600 leading-snug">
                          {evt.details}
                        </p>
                        <div className="text-xs text-slate-400 font-normal flex items-center justify-between pt-0.5">
                          <span>by {evt.actorName || 'System'}</span>
                          <span className="font-mono text-xs font-medium text-emerald-600">{evt.result}</span>
                        </div>
                      </div>
                    ))}

                    {auditLogs.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No custody events logged for this document yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

          </aside>
        </>
      )}

      </div>

    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
}
