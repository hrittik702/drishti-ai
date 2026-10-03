import React, { useEffect } from 'react';
import { X, ShieldAlert, ArrowRight, FileClock, LockKeyhole } from 'lucide-react';

export default function AccessDeniedModal({
  onClose,
  currentRole,
  attemptedDocName,
  attemptedType = 'DOCUMENT',
  resourceClassification = 'RESTRICTED',
  denialReason,
  onViewAudit
}) {
  const roleName = currentRole?.name || 'Officer';
  const roleDesignation = currentRole?.designation || currentRole?.role || 'Authorized Personnel';
  const roleClearance = currentRole?.clearance || 'Confidential';
  const badge = currentRole?.badge || currentRole?.id || 'AUTH-001';

  // Keyboard accessibility: ESC closes modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isSecretOrHigher = (resourceClassification || '').toLowerCase().includes('secret');
  const requestedAction = attemptedType === 'CASE' ? 'View Case Dossier' : 'View Document';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/45 backdrop-blur-[2px] overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div 
        className="bg-white border border-slate-200 rounded-xl w-full max-w-[540px] max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-32px)] shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="access-denied-title"
        aria-describedby="access-denied-description"
      >
        
        {/* Header */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 id="access-denied-title" className="text-[18px] font-semibold text-slate-900 leading-snug tracking-tight">
                Access denied
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                HTTP 403 · Authorization policy blocked this request
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close dialog"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Primary Security Status Strip */}
          <div className="bg-red-50/80 border border-red-200/80 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
            <LockKeyhole className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0" id="access-denied-description">
              <div className="text-[11px] font-bold text-red-800 tracking-wider uppercase">
                ACCESS DENIED
              </div>
              <div className="text-xs text-red-700 mt-0.5 font-normal">
                Authorization policy prevented access to this resource.
              </div>
            </div>
          </div>

          {/* Access Request Metadata */}
          <div>
            <h4 className="text-[14px] font-semibold text-slate-900 mb-2">
              Access request
            </h4>
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-lg p-3 text-xs space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500">Resource:</span>
                <span className="font-medium text-slate-900 text-[13px] truncate max-w-xs sm:text-right">
                  {attemptedDocName || 'Restricted Docket'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500">Resource boundary:</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase ${
                  isSecretOrHigher
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {resourceClassification}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500">Officer clearance:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {roleClearance} ({roleName})
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-500">Requested action:</span>
                <span className="text-slate-700 text-[13px] font-medium">
                  {requestedAction}
                </span>
              </div>
            </div>
          </div>

          {/* Denial Reason */}
          <div>
            <h4 className="text-[14px] font-semibold text-slate-900 mb-1.5">
              Why access was denied
            </h4>
            <p className="text-[13px] leading-5 text-slate-600 bg-white border border-slate-100 rounded-lg p-3">
              {denialReason || `Access was denied because your active identity (${roleDesignation}) is not authorized for this resource and does not meet the required access criteria.`}
            </p>
          </div>

          {/* Audit Event Info */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
            <FileClock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-semibold text-amber-900">
                Audit event recorded
              </div>
              <div className="text-amber-800/90 mt-0.5 leading-snug">
                This denied request has been recorded in the audit trail with officer badge identifier <span className="font-mono font-medium text-amber-950">{badge}</span>.
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose?.();
              if (onViewAudit) onViewAudit();
            }}
            className="text-[13px] font-medium text-blue-600 hover:text-blue-800 flex items-center justify-center sm:justify-start gap-1 py-1.5 sm:py-0 transition-colors"
          >
            <span>View logged audit entry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-10 sm:h-8 px-4 sm:px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors w-full sm:w-auto"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
}
