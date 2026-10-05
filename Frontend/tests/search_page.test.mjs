import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getOcrSnippet,
  calculateRelevanceScore,
  filterAndSortSearchResults
} from '../src/utils/searchUtils.js';

const mockCases = [
  {
    id: 'CASE-01',
    caseNumber: 'INV-2026-0142',
    title: 'Financial Cybercrime Investigation'
  },
  {
    id: 'CASE-02',
    caseNumber: 'INV-2026-0358',
    title: 'Domestic Asset Sequestration'
  }
];

const mockDocuments = [
  {
    id: 'DOC-1',
    name: 'Bank_Transfer_Audit.pdf',
    caseId: 'INV-2026-0142',
    category: 'Investigation Report',
    classification: 'Confidential',
    createdBy: 'Inspector Vikram Rathore',
    storedHash: 'a8f9104b2c1e8934fa76210d4589e1b23450987612345678abcdef0172bd9411',
    isTampered: false,
    integrityStatus: 'VERIFIED',
    createdAt: '2026-09-26T10:00:00.000Z',
    ocr: {
      status: 'COMPLETED',
      text: 'Detailed forensic corroboration of RTGS outflow transactions totaling INR 14.8 Crores across mule accounts.'
    }
  },
  {
    id: 'DOC-2',
    name: 'Court_Order_Attachment.pdf',
    caseId: 'INV-2026-0358',
    category: 'Court Order',
    classification: 'Secret',
    createdBy: 'Advocate Shrivastava',
    storedHash: 'b7123984caef01928374650192837465abcde987654321012345678901234567',
    isTampered: false,
    integrityStatus: 'VERIFIED',
    createdAt: '2026-09-25T14:30:00.000Z',
    ocr: {
      status: 'COMPLETED',
      text: 'Honourable Court ordered attachment of prime commercial real estate assets located in Saket District.'
    }
  },
  {
    id: 'DOC-3',
    name: 'Classified_Interception_Log.docx',
    caseId: 'INV-2026-0142',
    category: 'Evidence Record',
    classification: 'Top Secret',
    createdBy: 'Forensic Officer Sharma',
    storedHash: 'c8912345defa01293847561029384756fedcba09876543210987654321098765',
    isTampered: true,
    integrityStatus: 'MISMATCH',
    createdAt: '2026-09-27T08:00:00.000Z',
    ocr: {
      status: 'COMPLETED',
      text: 'Encrypted communication intercepts referencing clandestine financial transactions.'
    }
  }
];

const mockOfficer = {
  id: 'usr-io',
  name: 'Inspector Vikram Rathore',
  designation: 'Investigation Officer',
  clearance: 'Secret',
  role: { id: 'investigation_officer', clearance: 'Secret' },
  assignedCases: ['INV-2026-0142']
};

test('Search Utils: getOcrSnippet extracts contextual highlighted excerpt', () => {
  const text = 'The initial investigation observed unauthorized wire transfer of RTGS tokens to overseas beneficiary.';
  const snippet = getOcrSnippet(text, 'RTGS');
  assert.ok(snippet);
  assert.ok(snippet.includes('RTGS'));
  assert.ok(snippet.includes('wire transfer'));

  assert.equal(getOcrSnippet('', 'test'), null);
  assert.equal(getOcrSnippet('hello world', ''), null);
  assert.equal(getOcrSnippet('hello world', 'nonexistent'), null);
});

test('Search Utils: calculateRelevanceScore scores match precision accurately', () => {
  const doc = mockDocuments[0];

  // Exact filename
  const exactScore = calculateRelevanceScore(doc, 'Bank_Transfer_Audit.pdf');
  assert.equal(exactScore, 100);

  // Partial filename
  const partialScore = calculateRelevanceScore(doc, 'Bank_Transfer');
  assert.equal(partialScore, 85);

  // Case ID
  const caseScore = calculateRelevanceScore(doc, 'INV-2026-0142');
  assert.equal(caseScore, 65);

  // OCR text
  const ocrScore = calculateRelevanceScore(doc, 'RTGS outflow');
  assert.equal(ocrScore, 45);

  // Empty query
  assert.equal(calculateRelevanceScore(doc, ''), 0);
});

test('Search Utils: filterAndSortSearchResults matches across filename, case, OCR and hash', () => {
  // 1. Search by Filename
  const byFilename = filterAndSortSearchResults(mockDocuments, mockCases, 'Bank_Transfer');
  assert.equal(byFilename.length, 1);
  assert.equal(byFilename[0].id, 'DOC-1');
  assert.ok(byFilename[0].matchReasons.includes('Filename'));

  // 2. Search by Case ID
  const byCase = filterAndSortSearchResults(mockDocuments, mockCases, '0358');
  assert.equal(byCase.length, 1);
  assert.equal(byCase[0].id, 'DOC-2');

  // 3. Search by OCR text keyword
  const byOcr = filterAndSortSearchResults(mockDocuments, mockCases, 'RTGS');
  assert.equal(byOcr.length, 1);
  assert.equal(byOcr[0].id, 'DOC-1');
  assert.ok(byOcr[0].matchReasons.includes('OCR Extracted Text'));
  assert.ok(byOcr[0].ocrSnippet);

  // 4. Search by Cryptographic Hash
  const byHash = filterAndSortSearchResults(mockDocuments, mockCases, 'b7123984caef');
  assert.equal(byHash.length, 1);
  assert.equal(byHash[0].id, 'DOC-2');
  assert.ok(byHash[0].matchReasons.includes('Digital Fingerprint'));
});

test('Search Utils: Faceted filters narrow results correctly', () => {
  // Case filter
  const filterCase = filterAndSortSearchResults(mockDocuments, mockCases, '', { caseFilter: 'INV-2026-0358' });
  assert.equal(filterCase.length, 1);
  assert.equal(filterCase[0].id, 'DOC-2');

  // Type filter
  const filterType = filterAndSortSearchResults(mockDocuments, mockCases, '', { typeFilter: 'Investigation Report' });
  assert.equal(filterType.length, 1);
  assert.equal(filterType[0].id, 'DOC-1');

  // Classification filter
  const filterClass = filterAndSortSearchResults(mockDocuments, mockCases, '', { classificationFilter: 'Secret' });
  assert.equal(filterClass.length, 1);
  assert.equal(filterClass[0].id, 'DOC-2');

  // Integrity status filter (Verified vs Tampered)
  const filterVerified = filterAndSortSearchResults(mockDocuments, mockCases, '', { statusFilter: 'VERIFIED' });
  assert.equal(filterVerified.length, 2);

  const filterTampered = filterAndSortSearchResults(mockDocuments, mockCases, '', { statusFilter: 'TAMPERED' });
  assert.equal(filterTampered.length, 1);
  assert.equal(filterTampered[0].id, 'DOC-3');
});

test('Search Utils: Sorting by relevance, date, and name', () => {
  // Sorting by date (newest)
  const sortedNewest = filterAndSortSearchResults(mockDocuments, mockCases, '', {}, 'newest');
  assert.equal(sortedNewest[0].id, 'DOC-3'); // 27 Sep
  assert.equal(sortedNewest[1].id, 'DOC-1'); // 26 Sep
  assert.equal(sortedNewest[2].id, 'DOC-2'); // 25 Sep

  // Sorting by date (oldest)
  const sortedOldest = filterAndSortSearchResults(mockDocuments, mockCases, '', {}, 'oldest');
  assert.equal(sortedOldest[0].id, 'DOC-2'); // 25 Sep
  assert.equal(sortedOldest[2].id, 'DOC-3'); // 27 Sep

  // Sorting by filename (A-Z)
  const sortedName = filterAndSortSearchResults(mockDocuments, mockCases, '', {}, 'name');
  assert.equal(sortedName[0].id, 'DOC-1'); // Bank_Transfer
  assert.equal(sortedName[1].id, 'DOC-3'); // Classified_Interception
  assert.equal(sortedName[2].id, 'DOC-2'); // Court_Order
});

test('Search Utils: RBAC Security Enforcement hides unauthorized documents', () => {
  // mockOfficer:
  // - assignedCases: ['INV-2026-0142'] (cannot access DOC-2 from INV-2026-0358)
  // - clearance: 'Secret' (cannot access DOC-3 which is 'Top Secret')
  const officerResults = filterAndSortSearchResults(mockDocuments, mockCases, '', {}, 'newest', mockOfficer);

  // Only DOC-1 should be accessible!
  assert.equal(officerResults.length, 1);
  assert.equal(officerResults[0].id, 'DOC-1');

  // DOC-2 is blocked because officer is not assigned to Case INV-2026-0358
  const doc2Search = filterAndSortSearchResults(mockDocuments, mockCases, 'Court_Order', {}, 'relevance', mockOfficer);
  assert.equal(doc2Search.length, 0);

  // DOC-3 is blocked because clearance 'Secret' is below 'Top Secret'
  const doc3Search = filterAndSortSearchResults(mockDocuments, mockCases, 'Classified', {}, 'relevance', mockOfficer);
  assert.equal(doc3Search.length, 0);
});
