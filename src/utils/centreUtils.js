/**
 * Utility functions for Training Centre Compliance Monitoring
 */

/**
 * Normalizes and formats a centre code into a standard monospace identifier.
 * e.g. "TC-DEL-0142" -> "#TC-DEL-0142"
 *
 * @param {string} code
 * @returns {string} Formatted centre code
 */
export function formatCentreCode(code) {
  if (!code || typeof code !== 'string') return '#TC-UNKNOWN';
  const clean = code.trim();
  if (!clean) return '#TC-UNKNOWN';
  return clean.startsWith('#') ? clean : `#${clean}`;
}

/**
 * Returns the badge descriptor for a compliance status.
 *
 * @param {string} status - 'COMPLIANT' | 'ATTENTION' | 'CRITICAL' | 'OFFLINE'
 * @returns {Object} Status descriptor with label, color, and CSS classes
 */
export function getComplianceStatusBadge(status) {
  const norm = (status || '').trim().toUpperCase();

  switch (norm) {
    case 'COMPLIANT':
    case 'VERIFIED':
      return {
        label: 'COMPLIANT',
        color: 'emerald',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500'
      };
    case 'ATTENTION':
    case 'WARNING':
      return {
        label: 'ATTENTION',
        color: 'amber',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    case 'CRITICAL':
    case 'MISMATCH':
      return {
        label: 'CRITICAL',
        color: 'red',
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        dotClass: 'bg-red-500'
      };
    case 'OFFLINE':
    default:
      return {
        label: norm || 'OFFLINE',
        color: 'slate',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        dotClass: 'bg-slate-400'
      };
  }
}

/**
 * Returns the badge descriptor for a compliance event severity.
 *
 * @param {string} severity - 'Critical' | 'High' | 'Medium' | 'Low'
 * @returns {Object} Severity descriptor
 */
export function getSeverityBadge(severity) {
  const norm = (severity || '').trim().toLowerCase();

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
        color: 'red',
        badgeClass: 'bg-red-50 text-red-600 border-red-200'
      };
    case 'medium':
      return {
        label: 'Medium',
        color: 'amber',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    case 'low':
    default:
      return {
        label: severity || 'Low',
        color: 'blue',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
      };
  }
}

/**
 * Formats a date string for display.
 *
 * @param {string} dateStr
 * @returns {string} Formatted date
 */
export function formatCentreDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);

  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Formats a time string for display.
 *
 * @param {string} isoString
 * @returns {string} Formatted time
 */
export function formatCentreTime(isoString) {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '--:--';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? timeStr : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

/**
 * Calculates attendance discrepancy metrics.
 *
 * @param {number} expected
 * @param {number} detected
 * @returns {Object} { difference, discrepancyRate, status }
 */
export function calculateDiscrepancy(expected, detected) {
  if (expected == null || detected == null) {
    return { difference: 0, discrepancyRate: 0, status: 'UNKNOWN' };
  }
  const difference = detected - expected;
  const rate = expected > 0 ? Math.abs((difference / expected) * 100) : 0;
  const status = difference === 0 ? 'VERIFIED' : 'MISMATCH';

  return {
    difference,
    discrepancyRate: parseFloat(rate.toFixed(1)),
    status
  };
}

/**
 * Filters and sorts training centres collection based on criteria.
 *
 * @param {Array} centres
 * @param {Object} filters
 * @param {string} sortOption
 * @returns {Array} Filtered and sorted centres
 */
export function filterAndSortCentres(centres = [], filters = {}, sortOption = 'updated') {
  if (!Array.isArray(centres)) return [];

  let result = [...centres];

  // 1. Text Search
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(c => {
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchCode = (c.centreCode || c.id || '').toLowerCase().includes(q);
      const matchState = (c.location?.state || '').toLowerCase().includes(q);
      const matchDistrict = (c.location?.district || '').toLowerCase().includes(q);
      const matchScheme = (c.scheme || '').toLowerCase().includes(q);
      const matchCourse = (c.activeBatch?.courseName || '').toLowerCase().includes(q);
      const matchOfficer = (c.assignedOfficer || '').toLowerCase().includes(q);
      return matchName || matchCode || matchState || matchDistrict || matchScheme || matchCourse || matchOfficer;
    });
  }

  // 2. Status Filter
  if (filters.status && filters.status !== 'ALL') {
    result = result.filter(c => (c.complianceStatus || '').toUpperCase() === filters.status.toUpperCase());
  }

  // 3. Scheme Filter
  if (filters.scheme && filters.scheme !== 'ALL') {
    result = result.filter(c => (c.scheme || '').toLowerCase().includes(filters.scheme.toLowerCase()));
  }

  // 4. Issue Type Filter
  if (filters.issueType && filters.issueType !== 'ALL') {
    if (filters.issueType === 'ATTENDANCE') {
      result = result.filter(c => c.attendance?.status === 'MISMATCH');
    } else if (filters.issueType === 'INFRASTRUCTURE') {
      result = result.filter(c => c.infrastructure?.status === 'DEFICIENT');
    } else if (filters.issueType === 'CAMERA_OFFLINE') {
      result = result.filter(c => (c.edgeHealth?.camerasOffline || 0) > 0 || c.edgeHealth?.edgeStatus === 'OFFLINE');
    }
  }

  // 5. Sorting
  result.sort((a, b) => {
    switch (sortOption) {
      case 'status': {
        const priorityOrder = { CRITICAL: 4, ATTENTION: 3, OFFLINE: 2, COMPLIANT: 1 };
        const scoreA = priorityOrder[(a.complianceStatus || '').toUpperCase()] || 0;
        const scoreB = priorityOrder[(b.complianceStatus || '').toUpperCase()] || 0;
        return scoreB - scoreA;
      }
      case 'discrepancy': {
        const rateA = Math.abs(a.attendance?.discrepancyRate || 0);
        const rateB = Math.abs(b.attendance?.discrepancyRate || 0);
        return rateB - rateA;
      }
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'code':
        return (a.centreCode || '').localeCompare(b.centreCode || '');
      case 'updated':
      default: {
        const dateA = new Date(a.updatedAt || a.lastVerification || 0);
        const dateB = new Date(b.updatedAt || b.lastVerification || 0);
        return dateB - dateA;
      }
    }
  });

  return result;
}
