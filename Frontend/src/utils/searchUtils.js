/**
 * Search Utilities for CASEGUARD Document & Evidence Retrieval
 */
import { SharingService } from '../services/sharingService.js';

/**
 * Extracts a clean contextual snippet from OCR text around the matching query term.
 *
 * @param {string} text - Full OCR text
 * @param {string} query - Search term
 * @param {number} beforeChars - Number of characters to preserve before match (default: 40)
 * @param {number} afterChars - Number of characters to preserve after match (default: 50)
 * @returns {string|null} Contextual snippet with ellipsis or null if no match
 */
export function getOcrSnippet(text, query, beforeChars = 40, afterChars = 50) {
  if (!text || !query) return null;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return null;

  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return null;

  const start = Math.max(0, index - beforeChars);
  const end = Math.min(text.length, index + lowerQuery.length + afterChars);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';

  return prefix + text.slice(start, end).replace(/\s+/g, ' ') + suffix;
}

/**
 * Calculates a genuine relevance score based on match location and precision.
 *
 * @param {Object} doc - Document object
 * @param {string} query - Search query
 * @returns {number} Relevance score (0 to 100)
 */
export function calculateRelevanceScore(doc, query) {
  if (!doc || !query) return 0;
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = (doc.name || '').toLowerCase();
  const caseId = String(doc.caseId || '').toLowerCase().replace(/^#/, '');
  const hash = (doc.storedHash || doc.hash || '').toLowerCase();
  const ocrText = (doc.ocr?.text || '').toLowerCase();
  const category = (doc.category || doc.type || '').toLowerCase();
  const uploader = (doc.createdBy || doc.uploadedBy || '').toLowerCase();

  let score = 0;

  // Exact filename match
  if (name === q) {
    score = Math.max(score, 100);
  } else if (name.startsWith(q)) {
    score = Math.max(score, 85);
  } else if (name.includes(q)) {
    score = Math.max(score, 70);
  }

  // Exact or partial Case ID match
  if (caseId === q.replace(/^#/, '')) {
    score = Math.max(score, 65);
  } else if (caseId.includes(q.replace(/^#/, ''))) {
    score = Math.max(score, 55);
  }

  // Cryptographic hash match
  if (hash === q) {
    score = Math.max(score, 90);
  } else if (hash.includes(q)) {
    score = Math.max(score, 50);
  }

  // OCR full-text match
  if (ocrText.includes(q)) {
    score = Math.max(score, 45);
  }

  // Document type / category match
  if (category.includes(q)) {
    score = Math.max(score, 30);
  }

  // Uploader match
  if (uploader.includes(q)) {
    score = Math.max(score, 20);
  }

  return score;
}

/**
 * Filters and sorts search results across documents with full RBAC clearance checks.
 *
 * @param {Array<Object>} documents - Collection of documents
 * @param {Array<Object>} cases - Collection of cases
 * @param {string} query - Keyword search term
 * @param {Object} filters - Faceted filter options { caseFilter, typeFilter, classificationFilter, statusFilter }
 * @param {string} sortOption - Sort criteria ('relevance', 'newest', 'oldest', 'name', 'caseId')
 * @param {Object} currentUser - Active authenticated officer
 * @returns {Array<Object>} Processed, filtered, and sorted search results
 */
export function filterAndSortSearchResults(
  documents = [],
  cases = [],
  query = '',
  filters = {},
  sortOption = 'relevance',
  currentUser = null
) {
  if (!Array.isArray(documents)) return [];

  const {
    caseFilter = 'ALL',
    typeFilter = 'ALL',
    classificationFilter = 'ALL',
    statusFilter = 'ALL'
  } = filters;

  const q = (query || '').trim().toLowerCase();

  // 1. Associate case items and filter
  const results = [];

  for (const d of documents) {
    if (!d) continue;

    const caseItem = cases.find(
      c => c.caseNumber === d.caseId || c.id === d.caseId || String(c.caseNumber).replace(/^#/, '') === String(d.caseId).replace(/^#/, '')
    ) || null;

    // RBAC Security Enforcement: Do not expose documents the active user cannot access
    if (currentUser) {
      const canAccessCase = SharingService.canUserAccessCase(currentUser, d.caseId || caseItem);
      if (!canAccessCase) continue;

      const accessCheck = SharingService.checkDocumentAccess(currentUser, d, caseItem);
      if (!accessCheck.allowed) continue;
    }

    const docName = (d.name || '').toLowerCase();
    const docCaseId = String(d.caseId || '').toLowerCase();
    const cleanCaseId = docCaseId.replace(/^#/, '');
    const docType = (d.category || d.type || '').toLowerCase();
    const docUploader = (d.createdBy || d.uploadedBy || '').toLowerCase();
    const docHash = (d.storedHash || d.hash || '').toLowerCase();
    const docOcrText = (d.ocr?.text || '').toLowerCase();

    // Query matching & match reason tracking
    const matchReasons = [];
    if (q) {
      if (docName.includes(q)) matchReasons.push('Filename');
      if (docCaseId.includes(q) || cleanCaseId.includes(q.replace(/^#/, ''))) matchReasons.push(`Case #${d.caseId}`);
      if (docType.includes(q)) matchReasons.push('Document Type');
      if (docUploader.includes(q)) matchReasons.push('Uploader');
      if (docHash.includes(q)) matchReasons.push('Digital Fingerprint');
      if (docOcrText.includes(q)) matchReasons.push('OCR Extracted Text');

      if (matchReasons.length === 0) continue;
    }

    // Faceted filters
    if (caseFilter && caseFilter !== 'ALL') {
      const targetCase = caseFilter.replace(/^#/, '').toLowerCase();
      if (cleanCaseId !== targetCase && docCaseId !== targetCase) {
        continue;
      }
    }

    if (typeFilter && typeFilter !== 'ALL') {
      const curType = (d.category || d.type || '').toLowerCase();
      if (curType !== typeFilter.toLowerCase()) {
        continue;
      }
    }

    if (classificationFilter && classificationFilter !== 'ALL') {
      if ((d.classification || '').toLowerCase() !== classificationFilter.toLowerCase()) {
        continue;
      }
    }

    if (statusFilter && statusFilter !== 'ALL') {
      const isTampered = !!d.isTampered || d.integrityStatus === 'MISMATCH';
      if (statusFilter === 'VERIFIED' && isTampered) continue;
      if ((statusFilter === 'TAMPERED' || statusFilter === 'MISMATCH') && !isTampered) continue;
    }

    // Extract OCR snippet if query matched OCR text
    const ocrSnippet = q && docOcrText.includes(q) ? getOcrSnippet(d.ocr?.text, query) : null;
    const relevanceScore = q ? calculateRelevanceScore(d, query) : 0;

    results.push({
      ...d,
      caseItem,
      matchReasons,
      ocrSnippet,
      relevanceScore
    });
  }

  // 2. Sort
  return results.sort((a, b) => {
    switch (sortOption) {
      case 'relevance': {
        if (q) {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
        }
        // Fallback to newest when score is equal
        const dateA = new Date(a.createdAt || a.uploadDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.uploadDate || 0).getTime();
        return dateB - dateA;
      }

      case 'newest': {
        const dateA = new Date(a.createdAt || a.uploadDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.uploadDate || 0).getTime();
        return dateB - dateA;
      }

      case 'oldest': {
        const dateA = new Date(a.createdAt || a.uploadDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.uploadDate || 0).getTime();
        return dateA - dateB;
      }

      case 'name': {
        return (a.name || '').localeCompare(b.name || '');
      }

      case 'caseId': {
        const idA = String(a.caseId || '').replace(/^#/, '');
        const idB = String(b.caseId || '').replace(/^#/, '');
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
      }

      default:
        return 0;
    }
  });
}
