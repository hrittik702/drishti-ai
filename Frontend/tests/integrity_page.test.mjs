import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  shortenHash, 
  getIntegrityStatus, 
  formatLastVerified, 
  filterIntegrityDocuments 
} from '../src/utils/integrityUtils.js';
import { DocumentRepository } from '../src/services/documentRepository.js';

test('Integrity Utils: shortenHash formatting and edge cases', () => {
  const fullHash = '7fb4e583d7890abc1234567890abcdef1234567890abcdef123456784b2f43d4';
  
  // Standard 8 prefix, 8 suffix
  assert.equal(shortenHash(fullHash), '7fb4e583...4b2f43d4');
  
  // Custom prefix / suffix
  assert.equal(shortenHash(fullHash, 4, 4), '7fb4...43d4');
  assert.equal(shortenHash(fullHash, 10, 6), '7fb4e583d7...2f43d4');

  // Short string (less than or equal to prefix + suffix)
  assert.equal(shortenHash('short'), 'short');
  assert.equal(shortenHash('1234567812345678'), '1234567812345678');

  // Edge cases: null, undefined, empty, non-string
  assert.equal(shortenHash(null), 'N/A');
  assert.equal(shortenHash(undefined), 'N/A');
  assert.equal(shortenHash(''), 'N/A');
  assert.equal(shortenHash('   '), 'N/A');
  assert.equal(shortenHash(12345), 'N/A');
});

test('Integrity Utils: getIntegrityStatus classification', () => {
  // 1. Tampered / Mismatch takes precedence
  const tamperedDoc = {
    id: 'doc-1',
    isTampered: true,
    integrityStatus: 'VERIFIED'
  };
  const s1 = getIntegrityStatus(tamperedDoc);
  assert.equal(s1.status, 'MISMATCH');
  assert.equal(s1.label, '⚠ Mismatch');
  assert.equal(s1.color, 'red');

  // 2. Verified status
  const verifiedDoc = {
    id: 'doc-2',
    isTampered: false,
    integrityStatus: 'VERIFIED'
  };
  const s2 = getIntegrityStatus(verifiedDoc);
  assert.equal(s2.status, 'VERIFIED');
  assert.equal(s2.label, '✓ Verified');
  assert.equal(s2.color, 'emerald');

  // 3. Pending status (default)
  const pendingDoc = {
    id: 'doc-3',
    isTampered: false,
    integrityStatus: 'PENDING'
  };
  const s3 = getIntegrityStatus(pendingDoc);
  assert.equal(s3.status, 'PENDING');
  assert.equal(s3.label, '○ Pending');
  assert.equal(s3.color, 'slate');

  // Null doc
  const s4 = getIntegrityStatus(null);
  assert.equal(s4.status, 'PENDING');
});

test('Integrity Utils: formatLastVerified 24-hour timestamp formatting', () => {
  // Empty / null cases
  assert.equal(formatLastVerified(null), 'Pending');
  assert.equal(formatLastVerified(undefined), 'Pending');
  assert.equal(formatLastVerified(''), 'Pending');
  assert.equal(formatLastVerified('invalid-date'), 'Pending');

  // Valid date formatting in 24-hr time
  const testDate = new Date('2026-09-27T14:22:15Z');
  const formattedWithoutSec = formatLastVerified(testDate, false);
  const formattedWithSec = formatLastVerified(testDate, true);

  // Checks 24-hour format (e.g. HH:MM and HH:MM:SS)
  assert.match(formattedWithoutSec, /^\d{2}:\d{2}$/);
  assert.match(formattedWithSec, /^\d{2}:\d{2}:\d{2}$/);
});

test('Integrity Utils: filterIntegrityDocuments multi-criteria filtering', () => {
  const sampleDocs = [
    {
      id: 'doc-1',
      name: 'Forensic_Report.pdf',
      caseId: 'INV-2026-0142',
      storedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      integrityStatus: 'VERIFIED',
      isTampered: false
    },
    {
      id: 'doc-2',
      name: 'Financial_Ledger.xlsx',
      caseId: 'INV-2026-0142',
      storedHash: '7fb4e583d7890abc1234567890abcdef1234567890abcdef123456784b2f43d4',
      integrityStatus: 'MISMATCH',
      isTampered: true
    },
    {
      id: 'doc-3',
      name: 'Witness_Audio.wav',
      caseId: 'INV-2026-0255',
      storedHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      integrityStatus: 'PENDING',
      isTampered: false
    }
  ];

  // 1. No filters (returns all)
  assert.equal(filterIntegrityDocuments(sampleDocs, {}).length, 3);
  assert.equal(filterIntegrityDocuments(sampleDocs, { caseFilter: 'ALL', statusFilter: 'ALL' }).length, 3);

  // 2. Status filter
  const verifiedOnly = filterIntegrityDocuments(sampleDocs, { statusFilter: 'VERIFIED' });
  assert.equal(verifiedOnly.length, 1);
  assert.equal(verifiedOnly[0].id, 'doc-1');

  const mismatchOnly = filterIntegrityDocuments(sampleDocs, { statusFilter: 'MISMATCH' });
  assert.equal(mismatchOnly.length, 1);
  assert.equal(mismatchOnly[0].id, 'doc-2');

  const pendingOnly = filterIntegrityDocuments(sampleDocs, { statusFilter: 'PENDING' });
  assert.equal(pendingOnly.length, 1);
  assert.equal(pendingOnly[0].id, 'doc-3');

  // 3. Case filter
  const case142 = filterIntegrityDocuments(sampleDocs, { caseFilter: 'INV-2026-0142' });
  assert.equal(case142.length, 2);

  const case142WithHash = filterIntegrityDocuments(sampleDocs, { caseFilter: '#INV-2026-0142' });
  assert.equal(case142WithHash.length, 2);

  // 4. Search query
  const searchName = filterIntegrityDocuments(sampleDocs, { search: 'ledger' });
  assert.equal(searchName.length, 1);
  assert.equal(searchName[0].id, 'doc-2');

  const searchHash = filterIntegrityDocuments(sampleDocs, { search: '7fb4e583' });
  assert.equal(searchHash.length, 1);
  assert.equal(searchHash[0].id, 'doc-2');

  const searchCase = filterIntegrityDocuments(sampleDocs, { search: '0255' });
  assert.equal(searchCase.length, 1);
  assert.equal(searchCase[0].id, 'doc-3');

  // 5. Combined filter
  const combined = filterIntegrityDocuments(sampleDocs, {
    caseFilter: 'INV-2026-0142',
    statusFilter: 'MISMATCH',
    search: 'financial'
  });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].id, 'doc-2');
});

test('Integrity Verification: Real SHA-256 verification and tamper detection via DocumentRepository', async () => {
  const content = 'Pristine authentic evidence payload for integrity test';
  const testBlob = new Blob([content], { type: 'text/plain' });

  // 1. Create document
  const doc = await DocumentRepository.createDocumentWithFile(
    {
      caseId: 'INV-2026-INTEGRITY',
      name: 'Evidence_Affidavit.txt',
      classification: 'Secret',
      category: 'Evidence'
    },
    testBlob,
    { name: 'Inspector Sharma', designation: 'Forensic Officer' }
  );

  assert.ok(doc.id);
  assert.ok(doc.storedHash);

  // 2. Perform live integrity check on pristine document
  const actor = { name: 'Inspector Sharma', designation: 'Forensic Officer' };
  const verifyRes = await DocumentRepository.verifyDocumentIntegrity(doc.id, actor);

  assert.equal(verifyRes.valid, true);
  assert.equal(verifyRes.isTampered, false);
  assert.equal(verifyRes.calculatedHash, doc.storedHash);
  assert.equal(verifyRes.document.integrityStatus, 'VERIFIED');
  assert.ok(verifyRes.document.lastVerified);
  assert.ok(verifyRes.document.verifiedBy.includes('Inspector Sharma'));

  // 3. Simulate byte-level tamper
  await DocumentRepository.simulateDocumentTamper(doc.id);
  const tamperedDoc = await DocumentRepository.getDocumentById(doc.id);
  assert.equal(tamperedDoc.isTampered, true);

  // 4. Verify tampered document detects mismatch
  const mismatchRes = await DocumentRepository.verifyDocumentIntegrity(doc.id, actor);
  assert.equal(mismatchRes.valid, false);
  assert.equal(mismatchRes.isTampered, true);
  assert.notEqual(mismatchRes.calculatedHash, doc.storedHash);
  assert.equal(mismatchRes.document.integrityStatus, 'MISMATCH');

  // 5. Restore authentic version
  await DocumentRepository.restoreDocument(doc.id);
  const restoredDoc = await DocumentRepository.getDocumentById(doc.id);
  assert.equal(restoredDoc.isTampered, false);

  // 6. Verify restored document passes again
  const restoredRes = await DocumentRepository.verifyDocumentIntegrity(doc.id, actor);
  assert.equal(restoredRes.valid, true);
  assert.equal(restoredRes.isTampered, false);
  assert.equal(restoredRes.calculatedHash, doc.storedHash);
  assert.equal(restoredRes.document.integrityStatus, 'VERIFIED');

  // Cleanup
  await DocumentRepository.deleteDocument(doc.id);
});
