import React, { useState, useEffect } from 'react';
import { X, Share2, Shield, Clock, UserCheck, AlertTriangle, CheckCircle2, Lock, Trash2, ArrowRight } from 'lucide-react';
import { DEMO_USERS } from '../data/demoUsers';
import { SharingService } from '../services/sharingService';
import { AuditRepository } from '../services/auditRepository';

export default function ShareDocumentModal({
  isOpen,
  onClose,
  document,
  currentUser,
  currentRole,
  onShareCreated,
  addToast
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [permission, setPermission] = useState('VIEW');
  const [expiryHours, setExpiryHours] = useState(24);
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeShares, setActiveShares] = useState([]);

  // Filter possible recipients (all demo users except current active user)
  const candidateRecipients = DEMO_USERS.filter(u => u.email !== (currentUser?.email || ''));

  const refreshActiveShares = () => {
    if (document?.id) {
      const shares = SharingService.getSharesForDocument(document.id);
      setActiveShares(shares);
    }
  };

  useEffect(() => {
    if (isOpen && document) {
      refreshActiveShares();
      // Default to first recipient in list
      if (candidateRecipients.length > 0 && !recipientEmail) {
        setRecipientEmail(candidateRecipients[0].email);
      }
    }
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    if (!recipientEmail) {
      if (addToast) addToast('Error', 'Please select an authorized recipient officer.', 'error');
      return;
    }

    const recipientObj = DEMO_USERS.find(u => u.email === recipientEmail) || {
      id: `user-${Date.now()}`,
      email: recipientEmail,
      name: recipientEmail,
      role: 'Authorized Officer'
    };

    setIsSubmitting(true);
    try {
      const share = SharingService.createShare({
        document,
        sharedBy: currentUser || currentRole,
        recipient: recipientObj,
        permission,
        expiryHours: Number(expiryHours),
        purpose: purpose || 'Official judicial review and investigation access'
      });

      // Log ACCESS_GRANTED in Section 63 BSA Audit Repository
      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        action: 'ACCESS_GRANTED',
        targetType: 'DOCUMENT',
        targetId: document.id,
        caseId: document.caseId || 'GENERAL',
        result: 'SUCCESS',
        details: `Delegated ${permission} access on "${document.name}" to ${recipientObj.name} (${recipientObj.email}) for ${expiryHours > 0 ? `${expiryHours}h` : 'Indefinite'}. Purpose: ${purpose || 'Official review'}`
      });

      if (addToast) {
        addToast('Access Delegated', `Granted ${permission} permission to ${recipientObj.name}.`, 'success');
      }

      setPurpose('');
      refreshActiveShares();
      if (onShareCreated) onShareCreated(share);
    } catch (err) {
      if (addToast) addToast('Sharing Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (share) => {
    try {
      SharingService.revokeShare(share.id, currentUser || currentRole);

      await AuditRepository.logAuditEvent({
        actor: currentUser || currentRole,
        action: 'ACCESS_REVOKED',
        targetType: 'DOCUMENT',
        targetId: document.id,
        caseId: document.caseId || 'GENERAL',
        result: 'ALERT',
        details: `Revoked access delegation on "${document.name}" previously issued to ${share.recipientName} (${share.recipientEmail}).`
      });

      if (addToast) {
        addToast('Access Revoked', `Revoked permissions for ${share.recipientName}.`, 'info');
      }

      refreshActiveShares();
      if (onShareCreated) onShareCreated();
    } catch (err) {
      if (addToast) addToast('Error', err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl shadow-xl overflow-hidden my-6 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
                Controlled Document Access Delegation
              </h3>
              <p className="text-xs text-slate-500 font-normal">
                PoLP-Compliant Inter-Agency Evidence Sharing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
            aria-label="Close dialog"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Document Meta Summary */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="font-mono text-xs font-medium text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded mr-2">
              #{document.caseId || 'GENERAL'}
            </span>
            <span className="font-semibold text-sm text-slate-900">{document.name}</span>
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
            {document.classification || 'Confidential'}
          </span>
        </div>

        {/* Content Form */}
        <form onSubmit={handleGrantAccess} className="p-6 space-y-4 text-xs">
          
          {/* Recipient Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Recipient Officer / Agency Personnel:
            </label>
            <select
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {candidateRecipients.map(u => (
                <option key={u.id} value={u.email}>
                  {u.name} — {u.designation} ({u.clearance})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 font-normal mt-1">
              Select verified judicial prosecutor, investigating officer, or administrator.
            </p>
          </div>

          {/* Permission Level & Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Permission Level:
              </label>
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="VIEW">VIEW ONLY (In-Browser Viewer)</option>
                <option value="DOWNLOAD">VIEW & DOWNLOAD (Section 65B Copy)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Delegation Validity:
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value={1}>1 Hour (Urgent Bail Review)</option>
                <option value={24}>24 Hours (Court Submission)</option>
                <option value={168}>7 Days (Inter-Agency Scrutiny)</option>
                <option value={0}>Indefinite / Permanent</option>
              </select>
            </div>
          </div>

          {/* Official Purpose */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Statutory Purpose / Case Justification:
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Trial preparation before Additional Sessions Judge, Saket"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Submit Grant */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording Delegation...' : 'Authorize & Grant Document Access'}</span>
            </button>
          </div>

          {/* Active Shares List */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700 text-xs uppercase tracking-wider">
                Active Delegation Tokens ({activeShares.length})
              </span>
              <span className="text-xs text-slate-500 font-normal">Live Token Status</span>
            </div>

            {activeShares.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {activeShares.map(s => (
                  <div key={s.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                        <span>{s.recipientName}</span>
                        <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                          {s.permission}
                        </span>
                      </div>
                      <div className="text-slate-500 text-xs font-normal mt-0.5">
                        Expires: {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : 'Permanent'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevoke(s)}
                      className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 text-xs font-medium flex items-center gap-1 transition-colors"
                      title="Revoke access immediately"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-xs font-normal italic">
                No active delegation tokens currently issued for this document.
              </p>
            )}
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-normal">
          <div className="flex items-center gap-1 text-slate-600">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Logged under Section 63 BSA Digital Evidence Standard</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
