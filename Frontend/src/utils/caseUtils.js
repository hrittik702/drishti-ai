/**
 * Case Management Utilities for CASEGUARD
 */
import { SharingService } from '../services/sharingService.js';

/**
 * Normalizes and formats a case number into a standard monospace identifier.
 * e.g. "INV-2026-0142" -> "#INV-2026-0142"
 *
 * @param {string} caseNumber
 * @returns {string} Formatted case ID
 */
export function formatCaseId(caseNumber) {
  if (!caseNumber || typeof caseNumber !== 'string') return '#CASE-UNKNOWN';
  const clean = caseNumber.trim();
  if (!clean) return '#CASE-UNKNOWN';
  return clean.startsWith('#') ? clean : `#${clean}`;
}

/**
 * Returns a restrained enterprise priority descriptor.
 *
 * @param {string} priority - Priority value ('Critical', 'High', 'Medium', 'Low')
 * @returns {Object} Priority descriptor
 */
export function getCasePriority(priority) {
  const norm = (priority || '').trim().toLowerCase();

  switch (norm) {
    case 'critical':
      return {
        label: 'Critical',
        color: 'red',
        badgeClass: 'bg-red-50 text-red-700 border-red-200'
      };
    case 'high':
      return {
        label: 'High',
        color: 'amber',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    case 'low':
      return {
        label: 'Low',
        color: 'slate',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
      };
    case 'medium':
    default:
      return {
        label: priority || 'Medium',
        color: 'slate',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
      };
  }
}

/**
 * Returns an understated lifecycle status descriptor.
 *
 * @param {string} status - Case lifecycle status
 * @returns {Object} Status descriptor
 */
export function getCaseStatus(status) {
  const clean = (status || '').trim();
  const lower = clean.toLowerCase();

  if (lower.includes('charge sheet')) {
    return {
      label: clean || 'Charge Sheet Filed',
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  if (lower.includes('trial')) {
    return {
      label: clean || 'In Trial',
      color: 'purple',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200'
    };
  }
  if (lower.includes('review') || lower.includes('pending')) {
    return {
      label: clean || 'Pending Review',
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }
  if (lower.includes('closed') || lower.includes('archived')) {
    return {
      label: clean || 'Closed',
      color: 'slate',
      badgeClass: 'bg-slate-100 text-slate-500 border-slate-200'
    };
  }

  // Active / Under Investigation
  return {
    label: clean || 'Active Investigation',
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  };
}

/**
 * Formats a case timestamp into a clean, compact institutional string.
 *
 * @param {string|Date} dateStr
 * @returns {string} Formatted date/time
 */
export function formatCaseDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    // If already pre-formatted string like "26 Sep 2026, 09:42" or "24 Sep 2026"
    return String(dateStr);
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Accurately calculates the count of document records associated with a case.
 *
 * @param {Object} caseItem
 * @param {Array<Object>} documents
 * @returns {number}
 */
export function getCaseDocumentCount(caseItem, documents = []) {
  if (!caseItem || !Array.isArray(documents)) return 0;

  const rawNumber = String(caseItem.caseNumber || '').trim();
  const cleanNumber = rawNumber.replace(/^#/, '');
  const caseId = String(caseItem.id || '').trim();

  return documents.filter(d => {
    if (!d || !d.caseId) return false;
    const docCaseId = String(d.caseId).trim();
    const docCleanNumber = docCaseId.replace(/^#/, '');

    return (
      docCaseId === rawNumber ||
      docCleanNumber === cleanNumber ||
      docCaseId === caseId
    );
  }).length;
}

/**
 * Priority ranking weight for sorting
 */
const PRIORITY_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

/**
 * Filters and sorts cases according to search query, faceted filters, and sorting criteria.
 *
 * @param {Array<Object>} cases - Collection of case items
 * @param {Array<Object>} documents - Collection of documents for record count calculations
 * @param {Object} filters - Search and facet criteria
 * @param {string} sortOption - Sorting option ('updated', 'created', 'id', 'name', 'priority', 'records')
 * @param {Object} currentUser - Active officer persona for RBAC filtering
 * @returns {Array<Object>} Filtered and sorted case collection
 */
export function filterAndSortCases(cases = [], documents = [], filters = {}, sortOption = 'updated', currentUser = null) {
  if (!Array.isArray(cases)) return [];

  const {
    search = '',
    status = 'ALL',
    priority = 'ALL',
    type = 'ALL',
    access = 'ALL'
  } = filters;

  const query = (search || '').trim().toLowerCase();

  // 1. Filter
  const filtered = cases.filter(c => {
    if (!c) return false;

    // Search query matching
    if (query) {
      const caseNumber = String(c.caseNumber || '').toLowerCase();
      const title = String(c.title || '').toLowerCase();
      const caseType = String(c.type || '').toLowerCase();
      const desc = String(c.description || c.summary || '').toLowerCase();
      const station = String(c.policeStation || '').toLowerCase();
      const court = String(c.courtName || '').toLowerCase();
      const acts = Array.isArray(c.acts) ? c.acts.join(' ').toLowerCase() : '';
      const officers = Array.isArray(c.assignedOfficers) ? c.assignedOfficers.join(' ').toLowerCase() : '';

      const matchesSearch =
        caseNumber.includes(query) ||
        title.includes(query) ||
        caseType.includes(query) ||
        desc.includes(query) ||
        station.includes(query) ||
        court.includes(query) ||
        acts.includes(query) ||
        officers.includes(query);

      if (!matchesSearch) return false;
    }

    // Status filter
    if (status && status !== 'ALL') {
      const cStatus = (c.status || '').toLowerCase();
      const targetStatus = status.toLowerCase();
      if (!cStatus.includes(targetStatus) && targetStatus !== cStatus) {
        return false;
      }
    }

    // Priority filter
    if (priority && priority !== 'ALL') {
      if ((c.priority || '').toLowerCase() !== priority.toLowerCase()) {
        return false;
      }
    }

    // Case Type filter
    if (type && type !== 'ALL') {
      if ((c.type || '').toLowerCase() !== type.toLowerCase()) {
        return false;
      }
    }

    // Access filter (RBAC)
    if (access && access !== 'ALL' && currentUser) {
      const hasAccess = SharingService.canUserAccessCase(currentUser, c);
      if (access === 'ACCESSIBLE' && !hasAccess) return false;
      if (access === 'RESTRICTED' && hasAccess) return false;
    }

    return true;
  });

  // 2. Sort
  return filtered.sort((a, b) => {
    switch (sortOption) {
      case 'created': {
        const dateA = new Date(a.createdAt || a.createdDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.createdDate || 0).getTime();
        return dateB - dateA;
      }

      case 'id': {
        const idA = String(a.caseNumber || a.id || '');
        const idB = String(b.caseNumber || b.id || '');
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
      }

      case 'name': {
        const nameA = String(a.title || '');
        const nameB = String(b.title || '');
        return nameA.localeCompare(nameB);
      }

      case 'priority': {
        const wA = PRIORITY_WEIGHTS[(a.priority || '').toLowerCase()] || 0;
        const wB = PRIORITY_WEIGHTS[(b.priority || '').toLowerCase()] || 0;
        if (wB !== wA) return wB - wA;
        return String(a.caseNumber || '').localeCompare(String(b.caseNumber || ''));
      }

      case 'records': {
        const countA = getCaseDocumentCount(a, documents);
        const countB = getCaseDocumentCount(b, documents);
        return countB - countA;
      }

      case 'updated':
      default: {
        const dateA = new Date(a.updatedAt || a.lastActivity || a.createdAt || a.createdDate || 0).getTime();
        const dateB = new Date(b.updatedAt || b.lastActivity || b.createdAt || b.createdDate || 0).getTime();
        return dateB - dateA;
      }
    }
  });
}
