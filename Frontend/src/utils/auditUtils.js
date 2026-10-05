/**
 * Normalizes system action strings into human-readable action titles.
 */
export function formatActionName(action) {
  if (!action) return 'Unknown Action';
  const actionMap = {
    'DOCUMENT_UPLOADED': 'Document Uploaded',
    'DOCUMENT_STORED': 'Document Stored',
    'DOCUMENT_VIEWED': 'Document Viewed',
    'DOCUMENT_DOWNLOADED': 'Document Downloaded',
    'DOCUMENT_SHARED': 'Document Shared',
    'DOCUMENT_RESTORED': 'Document Restored',
    'DOCUMENT_DELETED': 'Document Deleted',
    'OCR_STARTED': 'OCR Started',
    'OCR_COMPLETED': 'OCR Completed',
    'OCR_FAILED': 'OCR Failed',
    'OCR_CANCELLED': 'OCR Cancelled',
    'INTEGRITY_VERIFIED': 'Integrity Verified',
    'INTEGRITY_MISMATCH': 'Integrity Mismatch',
    'TAMPER_DETECTED': 'Tamper Detected',
    'UNAUTHORIZED_ACCESS_DENIED': 'Access Denied',
    'ACCESS_DENIED': 'Access Denied',
    'ACCESS_GRANTED': 'Access Granted',
    'VERSION_CREATED': 'Version Created',
    'CASE_CREATED': 'Case Created',
    'SEC65B_CERT_GENERATED': 'Certificate Issued'
  };

  if (actionMap[action]) return actionMap[action];

  return action
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats a timestamp into a readable 24-hour time (HH:MM:SS).
 */
export function formatTime(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/**
 * Formats full timestamp for inspector.
 */
export function formatFullDateTime(ts) {
  if (!ts) return 'N/A';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
}

/**
 * Determines result status, badge styling, and iconography.
 */
export function getStatusInfo(log) {
  if (!log) {
    return { type: 'SUCCESS', label: 'Success', symbol: '✓', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  const res = (log.result || log.status || '').toUpperCase();
  const act = (log.action || '').toUpperCase();

  if (res === 'ALERT' || act.includes('TAMPER') || act.includes('MISMATCH') || act.includes('FAILED')) {
    return {
      type: 'ALERT',
      label: 'Alert',
      symbol: '⚠',
      badgeClass: 'bg-red-50 text-red-700 border-red-200'
    };
  }
  if (res === 'DENIED' || act.includes('DENIED') || act.includes('BLOCKED')) {
    return {
      type: 'DENIED',
      label: 'Denied',
      symbol: '✕',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
    };
  }
  return {
    type: 'SUCCESS',
    label: 'Success',
    symbol: '✓',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };
}

/**
 * Resolves a document entity associated with an audit log.
 */
export function resolveDocument(log, documents = []) {
  if (!log) return null;
  if (log.targetType === 'DOCUMENT' && log.targetId && log.targetId !== 'N/A') {
    const byId = documents.find(d => d.id === log.targetId);
    if (byId) return byId;
    const byName = documents.find(d => d.name === log.targetId);
    if (byName) return byName;
  }
  if (log.details) {
    const byDetails = documents.find(d => d.name && log.details.includes(d.name));
    if (byDetails) return byDetails;
  }
  return null;
}

/**
 * Resolves a case entity associated with an audit log.
 */
export function resolveCase(log, cases = []) {
  if (!log || !log.caseId || log.caseId === 'N/A' || log.caseId === 'GENERAL') return null;
  const cleanId = String(log.caseId).replace(/^#/, '');
  return cases.find(c => c.caseNumber === cleanId || c.id === cleanId || c.caseNumber === log.caseId);
}

/**
 * Extracts SHA-256 hash if present in log, doc, or details.
 */
export function extractHash(log, resolvedDoc) {
  if (!log) return null;
  if (log.hash && /^[a-f0-9]{64}$/i.test(log.hash)) return log.hash;
  if (log.sha256 && /^[a-f0-9]{64}$/i.test(log.sha256)) return log.sha256;
  if (resolvedDoc?.storedHash && /^[a-f0-9]{64}$/i.test(resolvedDoc.storedHash)) return resolvedDoc.storedHash;
  if (resolvedDoc?.sha256Hash && /^[a-f0-9]{64}$/i.test(resolvedDoc.sha256Hash)) return resolvedDoc.sha256Hash;
  if (resolvedDoc?.hash && /^[a-f0-9]{64}$/i.test(resolvedDoc.hash)) return resolvedDoc.hash;
  if (log.details) {
    const match = log.details.match(/\b[a-f0-9]{64}\b/i);
    if (match) return match[0];
  }
  return null;
}

/**
 * Filters audit logs according to search query, case, action, result, and date.
 */
export function filterAuditLogs(logs, { searchTerm = '', caseFilter = 'ALL', actionFilter = 'ALL', resultFilter = 'ALL', dateFilter = '' }) {
  const query = searchTerm.trim().toLowerCase();

  return logs.filter(log => {
    // 1. Case filter
    if (caseFilter !== 'ALL') {
      const logCase = String(log.caseId || '').replace(/^#/, '');
      if (logCase !== caseFilter && log.caseId !== caseFilter) {
        return false;
      }
    }

    // 2. Action filter
    if (actionFilter !== 'ALL' && log.action !== actionFilter) {
      return false;
    }

    // 3. Result filter
    if (resultFilter !== 'ALL') {
      const statusInfo = getStatusInfo(log);
      if (statusInfo.type !== resultFilter) {
        return false;
      }
    }

    // 4. Date filter (YYYY-MM-DD)
    if (dateFilter) {
      if (!log.timestamp) return false;
      const d = new Date(log.timestamp);
      if (isNaN(d.getTime())) return false;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;
      if (localDateStr !== dateFilter && !log.timestamp.startsWith(dateFilter)) {
        return false;
      }
    }

    // 5. Search query
    if (query) {
      const humanAction = formatActionName(log.action).toLowerCase();
      const actor = (log.actorName || '').toLowerCase();
      const details = (log.details || '').toLowerCase();
      const caseId = (log.caseId || '').toLowerCase();
      const targetId = (log.targetId || '').toLowerCase();

      const matches = 
        actor.includes(query) ||
        details.includes(query) ||
        humanAction.includes(query) ||
        caseId.includes(query) ||
        targetId.includes(query);

      if (!matches) return false;
    }

    return true;
  });
}
