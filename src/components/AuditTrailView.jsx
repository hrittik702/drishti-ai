import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, 
  Search, 
  X, 
  Scale, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink,
  Download
} from 'lucide-react';
import { generateSection65BCertificate } from '../services/auditService';
import {
  formatActionName,
  formatTime,
  formatFullDateTime,
  getStatusInfo,
  resolveDocument,
  resolveCase,
  extractHash,
  filterAuditLogs
} from '../utils/auditUtils';

export default function AuditTrailView({ 
  auditLogs = [], 
  cases = [], 
  documents = [], 
  currentRole, 
  addToast,
  onSelectCase,
  onViewDocument
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCaseFilter, setSelectedCaseFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeCert, setActiveCert] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Close inspector on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedEvent(null);
      }
    };
    if (selectedEvent) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedEvent]);

  // Derived options for filter selects
  const availableCases = useMemo(() => {
    const set = new Set();
    cases.forEach(c => {
      if (c.caseNumber) set.add(c.caseNumber);
    });
    auditLogs.forEach(l => {
      if (l.caseId && l.caseId !== 'GENERAL' && l.caseId !== 'N/A') {
        set.add(String(l.caseId).replace(/^#/, ''));
      }
    });
    return Array.from(set).sort();
  }, [cases, auditLogs]);

  const availableActions = useMemo(() => {
    const set = new Set([
      'DOCUMENT_UPLOADED',
      'DOCUMENT_STORED',
      'DOCUMENT_VIEWED',
      'DOCUMENT_DOWNLOADED',
      'DOCUMENT_SHARED',
      'DOCUMENT_RESTORED',
      'DOCUMENT_DELETED',
      'OCR_STARTED',
      'OCR_COMPLETED',
      'OCR_FAILED',
      'INTEGRITY_VERIFIED',
      'INTEGRITY_MISMATCH',
      'TAMPER_DETECTED',
      'UNAUTHORIZED_ACCESS_DENIED',
      'VERSION_CREATED',
      'CASE_CREATED',
      'SEC65B_CERT_GENERATED'
    ]);
    auditLogs.forEach(l => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set);
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return filterAuditLogs(auditLogs, {
      searchTerm,
      caseFilter: selectedCaseFilter,
      actionFilter,
      resultFilter,
      dateFilter
    });
  }, [auditLogs, searchTerm, selectedCaseFilter, actionFilter, resultFilter, dateFilter]);

  const hasActiveFilters = Boolean(
    searchTerm || 
    selectedCaseFilter !== 'ALL' || 
    actionFilter !== 'ALL' || 
    resultFilter !== 'ALL' || 
    dateFilter
  );

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCaseFilter('ALL');
    setActionFilter('ALL');
    setResultFilter('ALL');
    setDateFilter('');
  };

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const handleGenerateCertificate = () => {
    const primaryDoc = documents[0] || (cases.length > 0 && cases[0].documents ? cases[0].documents[0] : null);
    
    if (!primaryDoc) {
      if (addToast) {
        addToast('No Documents', 'Upload an evidence document before generating an admissibility certificate.', 'warning');
      } else {
        alert('Please upload an evidence document before generating a certificate.');
      }
      return;
    }

    const assocCase = cases.find(c => c.caseNumber === primaryDoc.caseId) || cases[0] || { caseNumber: primaryDoc.caseId || 'GENERAL' };
    const cert = generateSection65BCertificate({
      document: primaryDoc,
      caseItem: assocCase,
      officer: currentRole,
      blockchainBlock: { blockHeight: 1, validatorNode: 'Node-01-Delhi-High-Court' }
    });
    setActiveCert(cert);
  };

  // Details for currently selected event in Inspector
  const selectedDoc = useMemo(() => resolveDocument(selectedEvent, documents), [selectedEvent, documents]);
  const selectedCase = useMemo(() => resolveCase(selectedEvent, cases), [selectedEvent, cases]);
  const selectedHash = useMemo(() => extractHash(selectedEvent, selectedDoc), [selectedEvent, selectedDoc]);
  const selectedStatus = useMemo(() => getStatusInfo(selectedEvent), [selectedEvent]);

  return (
    <div className="space-y-4">
      {/* Simple Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verification Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable compliance checks, telemetry synchronizations, and access history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateCertificate}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            title="Generate Section 63 Admissibility Certificate"
          >
            <Scale className="w-3.5 h-3.5 text-slate-600" />
            <span>Section 63 BSA Certificate</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium shadow-2xs transition-colors cursor-pointer"
            title="Print Verification Log"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <select
          value={selectedCaseFilter}
          onChange={(e) => setSelectedCaseFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="ALL">All Centres</option>
          {availableCases.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="ALL">All Actions</option>
          {availableActions.map(act => (
            <option key={act} value={act}>{formatActionName(act)}</option>
          ))}
        </select>

        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="ALL">All Results</option>
          <option value="SUCCESS">Success</option>
          <option value="ALERT">Alert</option>
          <option value="DENIED">Denied</option>
        </select>

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          title="Filter by Date"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main Audit Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col">
        <div className="hidden md:block overflow-x-auto min-h-[380px] max-h-[calc(100vh-230px)]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap w-[95px]">Time</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Actor</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Action</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Centre / Evidence</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap w-[110px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const statusInfo = getStatusInfo(log);
                const isSelected = selectedEvent?.id === log.id;
                const caseObj = resolveCase(log, cases);
                const docObj = resolveDocument(log, documents);
                const cleanCase = log.caseId && log.caseId !== 'N/A' && log.caseId !== 'GENERAL' 
                  ? String(log.caseId).replace(/^#/, '') 
                  : null;
                const docName = docObj?.name || (log.targetType === 'DOCUMENT' && log.targetId && log.targetId !== 'N/A' ? log.targetId : null);

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedEvent(log)}
                    className={`cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-300' 
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Time */}
                    <td className="py-2.5 px-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </td>

                    {/* Actor */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-900 font-medium text-xs">
                      {log.actorName || 'System'}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-800 text-xs font-normal">
                      {formatActionName(log.action)}
                    </td>

                    {/* Case / Document */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {cleanCase ? (
                          caseObj && onSelectCase ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCase(caseObj);
                              }}
                              title={`Open Centre ${cleanCase}`}
                              className="font-mono text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              #{cleanCase}
                            </button>
                          ) : (
                            <span className="font-mono text-slate-700 font-medium">#{cleanCase}</span>
                          )
                        ) : null}

                        {cleanCase && docName && (
                          <span className="text-slate-300 select-none">/</span>
                        )}

                        {docName ? (
                          docObj && onViewDocument ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewDocument(docObj);
                              }}
                              title={`Open ${docName}`}
                              className="text-slate-700 hover:text-blue-700 hover:underline truncate max-w-[220px] font-normal text-left"
                            >
                              {docName}
                            </button>
                          ) : (
                            <span className="text-slate-600 truncate max-w-[220px] font-normal" title={docName}>
                              {docName}
                            </span>
                          )
                        ) : null}

                        {!cleanCase && !docName && (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusInfo.badgeClass}`}>
                        <span className="text-xs">{statusInfo.symbol}</span>
                        <span>{statusInfo.label}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <div className="font-semibold text-slate-700 text-sm">No audit events found</div>
                    <p className="text-xs text-slate-500 mt-0.5 font-normal">
                      {auditLogs.length === 0 
                        ? 'Operational activity and cryptographic events will be automatically logged here.' 
                        : 'No events match the current filter criteria.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        Reset all filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Stacked Audit Cards (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => {
              const statusInfo = getStatusInfo(log);
              const isSelected = selectedEvent?.id === log.id;
              const caseObj = resolveCase(log, cases);
              const docObj = resolveDocument(log, documents);
              const cleanCase = log.caseId && log.caseId !== 'N/A' && log.caseId !== 'GENERAL' 
                ? String(log.caseId).replace(/^#/, '') 
                : null;
              const docName = docObj?.name || (log.targetType === 'DOCUMENT' && log.targetId && log.targetId !== 'N/A' ? log.targetId : null);

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedEvent(log)}
                  className={`p-4 space-y-2 hover:bg-slate-50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/70' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900 text-xs">
                      {formatActionName(log.action)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border shrink-0 ${statusInfo.badgeClass}`}>
                      <span>{statusInfo.symbol}</span>
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-slate-800">{log.actorName || 'System'}</span>
                    {cleanCase && (
                      <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                        #{cleanCase}
                      </span>
                    )}
                    {docName && (
                      <span className="text-slate-500 truncate max-w-[200px]" title={docName}>
                        {docName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-400">
                    <span className="font-mono">{formatTime(log.timestamp)}</span>
                    <span className="text-blue-600 font-medium text-xs">Inspect →</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <div className="font-semibold text-slate-700 text-sm">No audit events found</div>
              <p className="text-xs text-slate-500 mt-1">
                No events match the current filter criteria.
              </p>
            </div>
          )}
        </div>

        {/* Table Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Showing {filteredLogs.length} of {auditLogs.length} logged events</span>
          <span className="text-slate-400 hidden sm:inline">Click any row to inspect event details</span>
        </div>
      </div>

      {/* Right-Side Inspector Drawer (Bottom Sheet on Mobile) */}
      {selectedEvent && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] transition-opacity"
            onClick={() => setSelectedEvent(null)}
          />
          <aside 
            className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 w-full sm:w-[440px] max-h-[88vh] sm:max-h-full rounded-t-2xl sm:rounded-none bg-white border-t sm:border-t-0 sm:border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
            role="dialog"
            aria-label="Audit Event Details"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 leading-tight">Event Details</h2>
                  <div className="text-[11px] font-mono text-slate-500">{selectedEvent.id}</div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                aria-label="Close details"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {/* Status Banner */}
              <div className={`p-3 rounded-lg border flex items-center justify-between ${selectedStatus.badgeClass}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{selectedStatus.symbol}</span>
                  <div>
                    <div className="font-semibold text-xs">{selectedStatus.label}</div>
                    <div className="text-[11px] opacity-90">{formatActionName(selectedEvent.action)}</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider">
                  {selectedEvent.result || selectedEvent.status || 'SUCCESS'}
                </span>
              </div>

              {/* Event Metadata */}
              <div className="space-y-3 divide-y divide-slate-100">
                <div className="pt-1 flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-normal">Timestamp</span>
                  <span className="font-mono text-slate-800 font-medium text-right select-all">
                    {formatFullDateTime(selectedEvent.timestamp)}
                  </span>
                </div>

                <div className="pt-2 flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-normal">Actor</span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{selectedEvent.actorName || 'System'}</div>
                    {selectedEvent.badge && selectedEvent.badge !== 'N/A' && (
                      <div className="text-[11px] text-slate-500 font-mono">Badge: {selectedEvent.badge}</div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-normal">Role</span>
                  <span className="text-slate-800 font-medium text-right">
                    {selectedEvent.role || 'Compliance Officer'}
                  </span>
                </div>

                <div className="pt-2 flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-normal">Centre</span>
                  {selectedCase && onSelectCase ? (
                    <button
                      type="button"
                      onClick={() => onSelectCase(selectedCase)}
                      className="font-mono text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      #{String(selectedEvent.caseId).replace(/^#/, '')}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : (
                    <span className="font-mono text-slate-800 font-medium">
                      {selectedEvent.caseId ? `#${String(selectedEvent.caseId).replace(/^#/, '')}` : '—'}
                    </span>
                  )}
                </div>

                <div className="pt-2 flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-normal">Evidence Record</span>
                  {selectedDoc && onViewDocument ? (
                    <button
                      type="button"
                      onClick={() => onViewDocument(selectedDoc)}
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium max-w-[220px] text-right truncate cursor-pointer"
                    >
                      <span className="truncate">{selectedDoc.name}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </button>
                  ) : (
                    <span className="text-slate-800 font-medium max-w-[220px] text-right truncate">
                      {selectedDoc?.name || (selectedEvent.targetType === 'DOCUMENT' && selectedEvent.targetId !== 'N/A' ? selectedEvent.targetId : '—')}
                    </span>
                  )}
                </div>

                <div className="pt-2 flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-normal">Action Type</span>
                  <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {selectedEvent.action}
                  </span>
                </div>
              </div>

              {/* Relevant Details */}
              {selectedEvent.details && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900 block text-xs">Relevant Details</span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-normal text-xs leading-relaxed break-words whitespace-pre-wrap">
                    {selectedEvent.details}
                  </div>
                </div>
              )}

              {/* SHA-256 / Cryptographic Integrity */}
              {selectedHash && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 block text-xs">SHA-256 Digest</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedHash, 'hash')}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {copiedField === 'hash' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] break-all select-all leading-normal">
                    {selectedHash}
                  </div>
                </div>
              )}

              {/* Origin IP / Node Info */}
              {selectedEvent.ipAddress && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Origin Node:</span>
                  <span className="font-mono text-slate-600">{selectedEvent.ipAddress}</span>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Section 63 BSA / Section 65B Certificate Modal */}
      {activeCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-2xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-5 my-6">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                    Certificate of Electronic Evidence Admissibility
                  </h3>
                  <p className="text-xs text-blue-700 font-medium">
                    Section 63, Bharatiya Sakshya Adhiniyam (BSA), 2023
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveCert(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
                aria-label="Close certificate"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-700 leading-relaxed font-serif">
              "{activeCert.statement}"
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-semibold text-slate-900 block border-b border-slate-200 pb-1 text-xs">
                  Document Identity:
                </span>
                <div><span className="text-slate-500 font-normal">Title:</span> <strong className="text-slate-800 font-medium">{activeCert.documentDetails.title}</strong></div>
                <div><span className="text-slate-500 font-normal">Type:</span> <span className="text-slate-700 font-normal">{activeCert.documentDetails.type}</span></div>
                <div><span className="text-slate-500 font-normal">Security:</span> <span className="text-slate-700 font-normal">{activeCert.documentDetails.classification}</span></div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-semibold text-slate-900 block border-b border-slate-200 pb-1 text-xs">
                  Cryptographic Integrity:
                </span>
                <div><span className="text-slate-500 font-normal">Integrity Standard:</span> <span className="font-mono text-xs font-medium text-slate-800">Section 63 BSA Digital Seal</span></div>
                <div><span className="text-slate-500 font-normal">Anchor:</span> <span className="text-emerald-700 font-mono text-xs font-medium">Ledger Block #{activeCert.blockchainProof.blockHeight}</span></div>
                <div className="font-mono text-xs font-medium text-slate-600 break-all select-all pt-1">
                  {activeCert.documentDetails.sha256Hash ? `${activeCert.documentDetails.sha256Hash.slice(0, 16)}••••••••••••••••${activeCert.documentDetails.sha256Hash.slice(-8)}` : 'Verified'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="text-xs">
                <span className="text-slate-400 block text-[11px] uppercase font-medium">Certifying Official:</span>
                <strong className="text-slate-900 font-semibold text-sm">{activeCert.certifyingAuthority.officerName}</strong>
                <div className="text-slate-500 text-xs font-normal">{activeCert.certifyingAuthority.designation}</div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Official Certificate</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
