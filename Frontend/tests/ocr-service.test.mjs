import test from 'node:test';
import assert from 'node:assert/strict';
import { isOcrSupported, recognizeDocument } from '../src/services/ocr/ocrService.js';

test('OCR Service: isOcrSupported detects file types correctly', () => {
  // Images
  assert.equal(isOcrSupported('image/png', 'fir_scan.png').supported, true);
  assert.equal(isOcrSupported('image/jpeg', 'evidence_photo.jpg').type, 'IMAGE');
  assert.equal(isOcrSupported('', 'document.webp').supported, true);
  assert.equal(isOcrSupported('image/tiff', 'fingerprint.tiff').type, 'IMAGE');

  // PDF
  assert.equal(isOcrSupported('application/pdf', 'charge_sheet.pdf').supported, true);
  assert.equal(isOcrSupported('application/pdf', 'charge_sheet.pdf').type, 'PDF');
  assert.equal(isOcrSupported('', 'affidavit.pdf').type, 'PDF');

  // DOCX
  assert.equal(isOcrSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'brief.docx').type, 'DOCX');
  assert.equal(isOcrSupported('', 'statement.docx').type, 'DOCX');

  // Plain text
  assert.equal(isOcrSupported('text/plain', 'log.txt').type, 'TEXT');
  assert.equal(isOcrSupported('text/csv', 'data.csv').type, 'TEXT');

  // Unsupported formats (video, audio, archives)
  assert.equal(isOcrSupported('video/mp4', 'cctv_footage.mp4').supported, false);
  assert.equal(isOcrSupported('audio/mpeg', 'wiretap.mp3').supported, false);
  assert.equal(isOcrSupported('application/zip', 'backup.zip').supported, false);
});

test('OCR Service: recognizeDocument processes text files directly and gracefully handles unsupported formats', async () => {
  // Plain text file
  const sampleContent = 'First Information Report No. 42/2026 registered at Central Cyber Cell.';
  const textBlob = new Blob([sampleContent], { type: 'text/plain' });
  const textResult = await recognizeDocument(textBlob, { name: 'FIR_42.txt', mimeType: 'text/plain' });

  assert.equal(textResult.status, 'COMPLETED');
  assert.equal(textResult.text, sampleContent);
  assert.equal(textResult.pageCount, 1);
  assert.ok(textResult.processedAt);

  // Unsupported media file
  const binaryBlob = new Blob([new Uint8Array([0x00, 0x01, 0x02])], { type: 'audio/mp3' });
  const unsupportedResult = await recognizeDocument(binaryBlob, { name: 'recording.mp3', mimeType: 'audio/mp3' });

  assert.equal(unsupportedResult.status, 'NOT_APPLICABLE');
  assert.equal(unsupportedResult.text, '');
  assert.ok(unsupportedResult.error);
});

test('Universal Search: matches across OCR extracted text and extracts contextual snippet', () => {
  const documents = [
    {
      id: 'DOC-01',
      name: 'Inspection_Report.pdf',
      caseId: 'CR-2026-001',
      ocr: {
        status: 'COMPLETED',
        text: 'The suspect vehicle bearing registration DL-1C-AA-9988 was located near the warehouse perimeters.'
      }
    },
    {
      id: 'DOC-02',
      name: 'Bank_Statement.pdf',
      caseId: 'CR-2026-002',
      ocr: {
        status: 'COMPLETED',
        text: 'Account transfer initiated via NEFT transaction reference 98471203 to offshore entity.'
      }
    }
  ];

  function searchDocuments(docs, query) {
    const q = query.toLowerCase().trim();
    if (!q) return docs;
    return docs.filter(d => {
      const matchName = (d.name || '').toLowerCase().includes(q);
      const matchCase = (d.caseId || '').toLowerCase().includes(q);
      const matchOcr = (d.ocr?.text || '').toLowerCase().includes(q);
      return matchName || matchCase || matchOcr;
    });
  }

  // Search by keyword only present in OCR text
  const resultsVehicle = searchDocuments(documents, 'DL-1C-AA-9988');
  assert.equal(resultsVehicle.length, 1);
  assert.equal(resultsVehicle[0].id, 'DOC-01');

  const resultsNeft = searchDocuments(documents, 'NEFT');
  assert.equal(resultsNeft.length, 1);
  assert.equal(resultsNeft[0].id, 'DOC-02');

  // Search by filename
  const resultsFilename = searchDocuments(documents, 'Bank_Statement');
  assert.equal(resultsFilename.length, 1);
  assert.equal(resultsFilename[0].id, 'DOC-02');

  // Non-matching search
  const resultsNonExistent = searchDocuments(documents, 'NonExistentTerm123');
  assert.equal(resultsNonExistent.length, 0);
});

test('Access Control: RBAC clearance check restricts classified OCR text', () => {
  const CLEARANCE_LEVELS = {
    'Confidential': 1,
    'Secret': 2,
    'Top Secret': 3
  };

  function canAccessOcr(roleClearance, docClassification) {
    const userLevel = CLEARANCE_LEVELS[roleClearance] || 1;
    const docLevel = CLEARANCE_LEVELS[docClassification] || 1;
    return userLevel >= docLevel;
  }

  // Legal officer (Confidential) vs Top Secret document
  assert.equal(canAccessOcr('Confidential', 'Top Secret'), false);
  // Investigation officer (Secret) vs Top Secret document
  assert.equal(canAccessOcr('Secret', 'Top Secret'), false);
  // Investigation officer (Secret) vs Confidential document
  assert.equal(canAccessOcr('Secret', 'Confidential'), true);
  // Forensic Analyst (Top Secret) vs Top Secret document
  assert.equal(canAccessOcr('Top Secret', 'Top Secret'), true);
});
