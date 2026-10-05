/**
 * Integrity Verification Utilities for CASEGUARD
 */

/**
 * Formats a 64-character SHA-256 cryptographic hash into a compact, readable string:
 * e.g. 7fb4e583...4b2f43d4
 * 
 * @param {string} hash - Full cryptographic hash string
 * @param {number} prefix - Number of leading characters to preserve (default: 8)
 * @param {number} suffix - Number of trailing characters to preserve (default: 8)
 * @returns {string} Shortened hash string or fallback if invalid
 */
export function shortenHash(hash, prefix = 8, suffix = 8) {
  if (!hash || typeof hash !== 'string') return 'N/A';
  const clean = hash.trim();
  if (!clean) return 'N/A';
  if (clean.length <= prefix + suffix) return clean;
  return `${clean.slice(0, prefix)}...${clean.slice(-suffix)}`;
}

/**
 * Resolves the integrity verification status and UI configuration for a document.
 * 
 * @param {Object} doc - Document model object
 * @returns {Object} Status descriptor with status, label, color, and badge classes
 */
export function getIntegrityStatus(doc) {
  if (!doc) {
    return {
      status: 'PENDING',
      label: '○ Pending',
      color: 'slate',
      badgeClass: 'bg-slate-50 text-slate-600 border-slate-200'
    };
  }

  // If the document has been tampered with or corrupted
  if (doc.isTampered) {
    return {
      status: 'MISMATCH',
      label: '⚠ Mismatch',
      color: 'red',
      badgeClass: 'bg-red-50 text-red-700 border-red-200'
    };
  }

  // If cryptographically verified
  if (doc.integrityStatus === 'VERIFIED') {
    return {
      status: 'VERIFIED',
      label: '✓ Verified',
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }

  // Default state: not yet verified
  return {
    status: 'PENDING',
    label: '○ Pending',
    color: 'slate',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200'
  };
}

/**
 * Formats a verification timestamp into 24-hour time (HH:MM or HH:MM:SS) or 'Pending'.
 * 
 * @param {string|number|Date} dateStr - Raw timestamp
 * @param {boolean} includeSeconds - Whether to include seconds in the output
 * @returns {string} 24-hour formatted time or fallback
 */
export function formatLastVerified(dateStr, includeSeconds = false) {
  if (!dateStr) return 'Pending';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Pending';

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: false
  });
}

/**
 * Filters a list of documents based on search keyword, case ID, and integrity status.
 * 
 * @param {Array<Object>} documents - Collection of documents
 * @param {Object} filters - Filter criteria { search, caseFilter, statusFilter }
 * @returns {Array<Object>} Filtered document collection
 */
export function filterIntegrityDocuments(documents = [], filters = {}) {
  const { search = '', caseFilter = 'ALL', statusFilter = 'ALL' } = filters;
  const normalizedSearch = (search || '').trim().toLowerCase();

  return documents.filter((doc) => {
    // 1. Status Filter
    if (statusFilter && statusFilter !== 'ALL') {
      const { status } = getIntegrityStatus(doc);
      if (status !== statusFilter) {
        return false;
      }
    }

    // 2. Case Filter
    if (caseFilter && caseFilter !== 'ALL') {
      const targetCase = String(caseFilter).replace(/^#/, '').toLowerCase();
      const docCase = String(doc.caseId || '').replace(/^#/, '').toLowerCase();
      if (docCase !== targetCase) {
        return false;
      }
    }

    // 3. Search Filter (document name, caseId, stored hash, shortened hash)
    if (normalizedSearch) {
      const name = String(doc.name || '').toLowerCase();
      const caseId = String(doc.caseId || '').toLowerCase();
      const storedHash = String(doc.storedHash || '').toLowerCase();
      const shortened = shortenHash(doc.storedHash).toLowerCase();

      const matches =
        name.includes(normalizedSearch) ||
        caseId.includes(normalizedSearch) ||
        storedHash.includes(normalizedSearch) ||
        shortened.includes(normalizedSearch);

      if (!matches) {
        return false;
      }
    }

    return true;
  });
}
