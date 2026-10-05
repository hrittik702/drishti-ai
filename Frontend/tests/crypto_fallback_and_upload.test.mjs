import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  computeSHA256, 
  hashFileSHA256, 
  isWebCryptoAvailable, 
  getCryptoProviderInfo 
} from '../src/services/cryptoService.js';
import { DocumentRepository } from '../src/services/documentRepository.js';

test('SHA-256: Computes exact standard NIST/FIPS test vectors', async () => {
  // Vector 1: Empty string
  const emptyBlob = new Blob([]);
  const emptyHash = await hashFileSHA256(emptyBlob);
  assert.equal(emptyHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

  // Vector 2: Standard test string
  const foxText = 'The quick brown fox jumps over the lazy dog';
  const foxBlob = new Blob([foxText]);
  const foxHash = await hashFileSHA256(foxBlob);
  assert.equal(foxHash, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');

  // Vector 3: String computeSHA256
  const strHash = await computeSHA256(foxText);
  assert.equal(strHash, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
});

test('SHA-256 Fallback: Operates flawlessly when crypto.subtle is unavailable (non-secure context)', async () => {
  // Save original crypto.subtle
  const originalSubtle = globalThis.crypto?.subtle;

  try {
    // Simulate non-secure origin (e.g. http://0.0.0.0:5173 where subtle is undefined)
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: undefined,
      configurable: true,
      writable: true
    });

    assert.equal(isWebCryptoAvailable(), false, 'WebCrypto must report unavailable');
    const providerInfo = getCryptoProviderInfo();
    assert.ok(providerInfo.provider.includes('Fallback'), 'Provider should indicate fallback engine');

    // Test hashing PDF dummy bytes under simulated non-secure environment
    const samplePdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const pdfBlob = new Blob([samplePdfBytes], { type: 'application/pdf' });

    // Hashing must NOT throw "Web Crypto API (crypto.subtle) is not available"
    const hash = await hashFileSHA256(pdfBlob);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64, 'SHA-256 fallback must produce standard 64-char hex string');

    // Must match direct computeSHA256
    const directHash = await computeSHA256(samplePdfBytes);
    assert.equal(hash, directHash);

  } finally {
    // Restore original crypto.subtle
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: originalSubtle,
      configurable: true,
      writable: true
    });
  }
});

test('SHA-256 Streaming: Progress callback receives increments for chunked files', async () => {
  // Create a 1MB payload
  const buffer = new Uint8Array(1024 * 1024);
  for (let i = 0; i < buffer.length; i++) buffer[i] = i % 256;
  const largeBlob = new Blob([buffer]);

  const progressTicks = [];
  const hash = await hashFileSHA256(largeBlob, (p) => {
    progressTicks.push(p);
  });

  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 64);
  assert.ok(progressTicks.length > 0, 'Progress callback should be invoked');
  assert.equal(progressTicks[progressTicks.length - 1], 1, 'Final progress must reach 100%');
});

test('Duplicate Detection: Identifies existing documents by hash or filename', async () => {
  // Mock repository documents
  const mockDocs = [
    {
      id: 'DOC-EXISTING-1',
      caseId: 'CR-2026-101',
      name: 'Charge_Sheet_Final.pdf',
      storedHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      currentVersion: 'V1'
    }
  ];

  // Temporarily stub getDocumentsByCase
  const origGetDocs = DocumentRepository.getDocumentsByCase;
  DocumentRepository.getDocumentsByCase = async (caseId) => {
    return mockDocs.filter(d => d.caseId === caseId);
  };

  try {
    // 1. Exact hash match
    const exactMatch = await DocumentRepository.findDuplicateDocument(
      'CR-2026-101', 
      'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      'Different_Name.pdf'
    );
    assert.equal(exactMatch.isDuplicate, true);
    assert.equal(exactMatch.type, 'EXACT_HASH');
    assert.equal(exactMatch.existingDoc.id, 'DOC-EXISTING-1');

    // 2. Same filename match
    const nameMatch = await DocumentRepository.findDuplicateDocument(
      'CR-2026-101',
      'other_hash_1122334455667788990011223344556677889900112233445566778899001122',
      'charge_sheet_final.pdf'
    );
    assert.equal(nameMatch.isDuplicate, true);
    assert.equal(nameMatch.type, 'SAME_NAME');

    // 3. Unique file
    const uniqueCheck = await DocumentRepository.findDuplicateDocument(
      'CR-2026-101',
      'unique_hash_9999999999999999999999999999999999999999999999999999999999999999',
      'Independent_Evidence.pdf'
    );
    assert.equal(uniqueCheck.isDuplicate, false);

  } finally {
    DocumentRepository.getDocumentsByCase = origGetDocs;
  }
});
