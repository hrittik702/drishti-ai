import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  X, 
  Copy, 
  Check, 
  RotateCcw, 
  AlertTriangle, 
  ExternalLink, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Play, 
  Loader2,
  Clock,
  History,
  Lock,
  Eye,
  Briefcase
} from 'lucide-react';
import { 
  shortenHash, 
  getIntegrityStatus, 
  formatLastVerified, 
  filterIntegrityDocuments 
} from '../utils/integrityUtils';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function IntegrityVerificationView({
  documents = [],
  cases = [],
  auditLogs = [],
  currentUser,
  currentRole,
  onVerifyDocument,
  onSimulateTamper,
  onRestoreDocument,
  onSelectCase,
  onViewDocument
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [caseFilter, setCaseFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected document for Inspector Slide-over Drawer
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [verifyAllProgress, setVerifyAllProgress] = useState({ current: 0, total: 0 });
  const [showDevControls, setShowDevControls] = useState(false);
  const [verifyingDocId, setVerifyingDocId] = useState(null);

  // Synchronize active selected document with latest collection state
  const selectedDoc = useMemo(() => {
    if (!selectedDocId) return null;
    return documents.find(d => d.id === selectedDocId) || null;
  }, [documents, selectedDocId]);

  // Close inspector on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedDocId(null);
      }
    };
    if (selectedDocId) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedDocId]);

  // Extract unique cases present in documents collection
  const availableCases = useMemo(() => {
    const set = new Set();
    documents.forEach(d => {
      if (d.caseId) {
        set.add(String(d.caseId).replace(/^#/, ''));
      }
    });
    cases.forEach(c => {
      if (c.caseNumber) {
        set.add(String(c.caseNumber).replace(/^#/, ''));
      }
    });
    return Array.from(set).sort();
  }, [documents, cases]);

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return filterIntegrityDocuments(documents, {
      search: searchTerm,
      caseFilter,
      statusFilter
    });
  }, [documents, searchTerm, caseFilter, statusFilter]);

  // Copy to clipboard helper
  const handleCopy = useCallback((text, fieldId) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {});
  }, []);

  // Single document verify handler
  const handleSingleVerify = async (doc, e) => {
    if (e) e.stopPropagation();
    if (!onVerifyDocument) return;
    try {
      setVerifyingDocId(doc.id);
      await onVerifyDocument(doc);
    } finally {
      setVerifyingDocId(null);
    }
  };

  // Batch Verify All handler
  const handleVerifyAll = async () => {
    if (!onVerifyDocument || isVerifyingAll) return;
    const targetDocs = filteredDocuments.length > 0 ? filteredDocuments : documents;
    if (targetDocs.length === 0) return;

    setIsVerifyingAll(true);
    setVerifyAllProgress({ current: 0, total: targetDocs.length });

    for (let i = 0; i < targetDocs.length; i++) {
      setVerifyAllProgress({ current: i + 1, total: targetDocs.length });
      try {
        await onVerifyDocument(targetDocs[i]);
      } catch (err) {
        console.error('Batch verification error for doc:', targetDocs[i].id, err);
      }
    }

    setIsVerifyingAll(false);
  };

  // Relevant audit events for the selected document in the inspector
  const docAuditEvents = useMemo(() => {
    if (!selectedDoc) return [];
    return auditLogs
      .filter(l => l.targetId === selectedDoc.id || l.documentId === selectedDoc.id)
      .slice(0, 10);
  }, [auditLogs, selectedDoc]);

  return (
    <div className="space-y-4">
      {/* 1. Header: Compact, Institutional, and Focused */}
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="cg-page-title text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600 stroke-[2]" />
            <span>Integrity Verification</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verify stored documents against their original cryptographic fingerprint.
          </p>
        </div>

        {/* Action: Verify All */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyAll}
            disabled={isVerifyingAll || documents.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Sequentially verify cryptographic integrity of all documents"
          >
            {isVerifyingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying ({verifyAllProgress.current}/{verifyAllProgress.total})...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search documents, cases, hashes..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Case Filter */}
          <select
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
          >
            <option value="ALL">All Cases</option>
            {availableCases.map((c) => (
              <option key={c} value={c}>#{c}</option>
            ))}
          </select>

          {/* Integrity Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="MISMATCH">Mismatch</option>
            <option value="PENDING">Pending</option>
          </select>

          {/* Reset Filters button if any filter is active */}
          {(searchTerm || caseFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCaseFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-slate-500 hover:text-slate-800 font-medium px-2 py-1 hover:bg-slate-100 rounded-md transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-slate-500 font-mono text-xs">
          Showing <span className="font-semibold text-slate-800">{filteredDocuments.length}</span> of {documents.length}
        </div>
      </div>

      {/* 3. Document Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono text-[11px] uppercase tracking-wider font-semibold select-none">
                <th className="py-2.5 px-4">Document</th>
                <th className="py-2.5 px-4">Case</th>
                <th className="py-2.5 px-3">Version</th>
                <th className="py-2.5 px-4">Integrity</th>
                <th className="py-2.5 px-4">Last Verified</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => {
                  const statusInfo = getIntegrityStatus(doc);
                  const isRowSelected = selectedDocId === doc.id;
                  const isVerifying = verifyingDocId === doc.id;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isRowSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      {/* Document Name & Shortened Fingerprint */}
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 p-1 rounded-md bg-slate-100 text-slate-500">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 cg-filename text-sm leading-tight">
                              {doc.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span 
                                className="font-mono text-[11px] text-slate-500 select-all"
                                title={`Full SHA-256: ${doc.storedHash || 'N/A'}`}
                              >
                                {shortenHash(doc.storedHash, 8, 8)}
                              </span>
                              {doc.storedHash && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(doc.storedHash, `table-${doc.id}`);
                                  }}
                                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-200/60 transition-colors"
                                  title="Copy full cryptographic fingerprint"
                                >
                                  {copiedField === `table-${doc.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Case Identifier */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectCase && doc.caseId) {
                              onSelectCase(doc.caseId);
                            }
                          }}
                          className="font-mono text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer"
                          title="Open Case Workspace"
                        >
                          #{String(doc.caseId || 'N/A').replace(/^#/, '')}
                        </button>
                      </td>

                      {/* Version Tag */}
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {doc.currentVersion || 'V1'}
                        </span>
                      </td>

                      {/* Integrity Status Pill */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Last Verified Timestamp */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-slate-600">
                          {formatLastVerified(doc.lastVerified, true)}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {statusInfo.status === 'MISMATCH' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedDocId(doc.id)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              >
                                Investigate
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSingleVerify(doc, e)}
                                disabled={isVerifying}
                                className="px-2.5 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-medium transition-colors cursor-pointer"
                                title="Re-run verification check"
                              >
                                {isVerifying ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  'Verify'
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleSingleVerify(doc, e)}
                              disabled={isVerifying}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                              title="Run live SHA-256 cryptographic check"
                            >
                              {isVerifying ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Checking...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Verify</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 bg-white">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 stroke-1" />
                    <div className="font-semibold text-slate-700 text-sm">No Documents Found</div>
                    <p className="text-xs text-slate-500 mt-1">
                      {documents.length === 0
                        ? 'No accessible evidence documents currently registered in this workspace.'
                        : 'No documents match the specified search or filter criteria.'}
                    </p>
                    {(searchTerm || caseFilter !== 'ALL' || statusFilter !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          setCaseFilter('ALL');
                          setStatusFilter('ALL');
                        }}
                        className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Cards View (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => {
              const statusInfo = getIntegrityStatus(doc);
              const isSelected = selectedDocId === doc.id;
              const isVerifying = verifyingDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`p-4 space-y-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 text-sm leading-tight break-words">
                        {doc.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          #{String(doc.caseId || 'N/A').replace(/^#/, '')}
                        </span>
                        <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {doc.currentVersion || 'V1'}
                        </span>
                        {doc.storedHash && (
                          <span className="font-mono text-[11px] text-slate-400 select-all">
                            {shortenHash(doc.storedHash, 6, 6)}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${statusInfo.badgeClass}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                      <span>Verified:</span>
                      <span>{formatLastVerified(doc.lastVerified, true)}</span>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {statusInfo.status === 'MISMATCH' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDocId(doc.id)}
                          className="px-3 py-1.5 min-h-[36px] bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                        >
                          Investigate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleVerifySingle(doc)}
                          disabled={isVerifying}
                          className="px-3 py-1.5 min-h-[36px] bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                        >
                          {isVerifying ? 'Verifying...' : 'Verify'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 stroke-1" />
              <div className="font-semibold text-slate-700 text-sm">No Documents Found</div>
              <p className="text-xs text-slate-500 mt-1">
                No documents match the specified search or filter criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Inspector Slide-Over Drawer (Bottom sheet on mobile) */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs transition-opacity"
            onClick={() => setSelectedDocId(null)}
          />

          {/* Drawer content */}
          <div 
            className="relative w-full sm:w-[440px] bg-white border-t sm:border-t-0 sm:border-l border-slate-200 rounded-t-2xl sm:rounded-none shadow-xl flex flex-col h-[88vh] sm:h-full z-10 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Document Integrity Details"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    #{String(selectedDoc.caseId || 'GENERAL').replace(/^#/, '')}
                  </span>
                  <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {selectedDoc.currentVersion || 'V1'}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 break-words leading-snug">
                  {selectedDoc.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDocId(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close dialog"
                title="Close Inspector (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Status Banner */}
              {(() => {
                const statusInfo = getIntegrityStatus(selectedDoc);
                if (statusInfo.status === 'MISMATCH') {
                  return (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 space-y-1">
                      <div className="flex items-center gap-2 font-semibold text-xs text-red-800">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>Integrity Violation Detected</span>
                      </div>
                      <p className="text-[11px] text-red-700 font-normal leading-relaxed pl-6">
                        Stored binary bytes do not match the anchored cryptographic seal. Evidence may have been altered or corrupted in storage.
                      </p>
                    </div>
                  );
                }
                if (statusInfo.status === 'VERIFIED') {
                  return (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                      <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Cryptographic Integrity Verified</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 font-normal leading-relaxed pl-6">
                        Calculated SHA-256 fingerprint matches the immutable seal anchored in the evidence chain of custody.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Verification Pending</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-normal leading-relaxed pl-6">
                      This document has not been verified in the current session. Run a live check to recalculate its fingerprint.
                    </p>
                  </div>
                );
              })()}

              {/* Mismatch Analysis Section (when tampered / corrupted) */}
              {selectedDoc.isTampered && (
                <div className="border border-red-200 bg-red-50/40 rounded-xl p-4 space-y-3">
                  <div className="font-semibold text-red-900 flex items-center justify-between">
                    <span>Mismatch Forensic Comparison</span>
                    <span className="text-[11px] font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                      Version: {selectedDoc.currentVersion || 'V1'}
                    </span>
                  </div>

                  {/* Expected Fingerprint */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-medium text-slate-700">Expected Fingerprint (Anchored Seal):</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedDoc.storedHash, 'expected')}
                        className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'expected' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="p-2 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-lg break-all select-all font-normal">
                      {selectedDoc.storedHash || 'N/A'}
                    </div>
                  </div>

                  {/* Actual Fingerprint */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-red-700">
                      <span className="font-medium text-red-800">Actual Fingerprint (Corrupted Payload):</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedDoc.tamperedHash, 'actual')}
                        className="text-red-700 hover:text-red-900 font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === 'actual' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="p-2 bg-red-100 border border-red-300 text-red-900 font-mono text-[11px] rounded-lg break-all select-all font-normal">
                      {selectedDoc.tamperedHash || 'Calculated byte mismatch'}
                    </div>
                  </div>
                </div>
              )}

              {/* Cryptographic Hashes (Standard) */}
              <div className="space-y-3">
                <div className="font-semibold text-slate-900">Cryptographic Identity</div>

                {/* Anchored SHA-256 */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="font-medium text-slate-700">Anchored Seal (SHA-256):</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedDoc.storedHash, 'storedHash')}
                      className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'storedHash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <div className="font-mono text-slate-800 text-[11px] break-all select-all font-normal">
                    {selectedDoc.storedHash || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Verification Metadata */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-900">Verification Telemetry</div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100">
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-slate-500">Last Verified:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {formatLastVerified(selectedDoc.lastVerified, true)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-slate-500">Verified By:</span>
                    <span className="text-slate-800 font-medium">
                      {selectedDoc.verifiedBy || (currentUser ? `${currentUser.name} (${currentUser.designation || 'Officer'})` : 'Security Verification System')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-slate-500">Classification:</span>
                    <span className="font-medium text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded text-[11px]">
                      {selectedDoc.classification || 'Restricted'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5">
                    <span className="text-slate-500">Payload Size:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {formatBytes(selectedDoc.size)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Integrity History / Audit Trail */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-900 flex items-center justify-between">
                  <span>Integrity History</span>
                  <span className="text-[11px] text-slate-400 font-normal">Recent Events</span>
                </div>
                {docAuditEvents.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                    {docAuditEvents.map((event) => (
                      <div key={event.id} className="p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {event.action}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatLastVerified(event.timestamp, true)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {event.details || event.action}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No specific integrity audit events logged for this document yet.
                  </div>
                )}
              </div>

              {/* Integrity & Tamper Testing Controls (Collapsible) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowDevControls(!showDevControls)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-slate-600 hover:text-slate-900 text-xs font-semibold cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>Integrity & Tamper Testing Controls</span>
                  </span>
                  {showDevControls ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {showDevControls && (
                  <div className="p-3.5 border-t border-slate-200 bg-white space-y-2 text-xs">
                    <p className="text-[11px] text-slate-500 font-normal">
                      Use these controls to simulate byte-level tamper events in storage and verify that CASEGUARD detects cryptographic mismatches.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      {!selectedDoc.isTampered ? (
                        <button
                          type="button"
                          onClick={() => onSimulateTamper && onSimulateTamper(selectedDoc)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Test Tamper Detection</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRestoreDocument && onRestoreDocument(selectedDoc)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Restore Authentic Version</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {onViewDocument && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewDocument(selectedDoc);
                      setSelectedDocId(null);
                    }}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open in Workspace</span>
                  </button>
                )}

                {onSelectCase && selectedDoc.caseId && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCase(selectedDoc.caseId);
                      setSelectedDocId(null);
                    }}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Dossier</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => handleSingleVerify(selectedDoc, e)}
                disabled={verifyingDocId === selectedDoc.id}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {verifyingDocId === selectedDoc.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Run Live Check</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
