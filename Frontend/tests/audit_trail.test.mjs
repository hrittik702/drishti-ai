import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  formatActionName, 
  formatTime, 
  getStatusInfo, 
  resolveDocument, 
  resolveCase, 
  extractHash, 
  filterAuditLogs 
} from '../src/utils/auditUtils.js';

test('Audit Trail: formatActionName produces clean, human-readable labels', () => {
  assert.equal(formatActionName('DOCUMENT_UPLOADED'), 'Document Uploaded');
  assert.equal(formatActionName('DOCUMENT_STORED'), 'Document Stored');
  assert.equal(formatActionName('DOCUMENT_VIEWED'), 'Document Viewed');
  assert.equal(formatActionName('DOCUMENT_DOWNLOADED'), 'Document Downloaded');
  assert.equal(formatActionName('DOCUMENT_SHARED'), 'Document Shared');
  assert.equal(formatActionName('DOCUMENT_RESTORED'), 'Document Restored');
  assert.equal(formatActionName('DOCUMENT_DELETED'), 'Document Deleted');
  assert.equal(formatActionName('OCR_STARTED'), 'OCR Started');
  assert.equal(formatActionName('OCR_COMPLETED'), 'OCR Completed');
  assert.equal(formatActionName('OCR_FAILED'), 'OCR Failed');
  assert.equal(formatActionName('INTEGRITY_VERIFIED'), 'Integrity Verified');
  assert.equal(formatActionName('INTEGRITY_MISMATCH'), 'Integrity Mismatch');
  assert.equal(formatActionName('TAMPER_DETECTED'), 'Tamper Detected');
  assert.equal(formatActionName('UNAUTHORIZED_ACCESS_DENIED'), 'Access Denied');
  assert.equal(formatActionName('VERSION_CREATED'), 'Version Created');
  assert.equal(formatActionName('CASE_CREATED'), 'Case Created');
  assert.equal(formatActionName('SEC65B_CERT_GENERATED'), 'Certificate Issued');
  // Dynamic fallback
  assert.equal(formatActionName('CUSTOM_SECURITY_AUDIT'), 'Custom Security Audit');
  assert.equal(formatActionName(''), 'Unknown Action');
});

test('Audit Trail: formatTime renders readable 24-hr timestamps (HH:MM:SS)', () => {
  const ts = '2026-09-27T02:36:13.000Z';
  const formatted = formatTime(ts);
  // Match HH:MM:SS format
  assert.match(formatted, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(formatTime(null), '--:--:--');
  assert.equal(formatTime('invalid-date'), 'invalid-date');
});

test('Audit Trail: getStatusInfo correctly classifies Success, Alert, and Denied', () => {
  // 1. Success
  const s1 = getStatusInfo({ result: 'SUCCESS', action: 'DOCUMENT_UPLOADED' });
  assert.equal(s1.type, 'SUCCESS');
  assert.equal(s1.label, 'Success');
  assert.equal(s1.symbol, '✓');

  // 2. Alert (Tamper or Mismatch)
  const s2 = getStatusInfo({ result: 'ALERT', action: 'INTEGRITY_MISMATCH' });
  assert.equal(s2.type, 'ALERT');
  assert.equal(s2.label, 'Alert');
  assert.equal(s2.symbol, '⚠');

  const s3 = getStatusInfo({ result: 'SUCCESS', action: 'TAMPER_DETECTED' });
  assert.equal(s3.type, 'ALERT');

  // 3. Denied (Unauthorized Access)
  const s4 = getStatusInfo({ result: 'DENIED', action: 'UNAUTHORIZED_ACCESS_DENIED' });
  assert.equal(s4.type, 'DENIED');
  assert.equal(s4.label, 'Denied');
  assert.equal(s4.symbol, '✕');

  const s5 = getStatusInfo({ result: 'SUCCESS', action: 'ACCESS_DENIED' });
  assert.equal(s5.type, 'DENIED');
});

test('Audit Trail: Entity resolution and hash extraction', () => {
  const mockCases = [
    { id: 'c1', caseNumber: 'INV-2026-252', title: 'Cyber Fraud Investigation' },
    { id: 'c2', caseNumber: 'INV-2026-0189', title: 'Hedge Fund Infiltration' }
  ];

  const mockDocs = [
    { id: 'doc-123', name: 'ledger_dump.xlsx', caseId: 'INV-2026-252', storedHash: 'a'.repeat(64) },
    { id: 'doc-456', name: 'warrant_affidavit.pdf', caseId: 'INV-2026-0189', sha256Hash: 'b'.repeat(64) }
  ];

  // Resolve case
  assert.equal(resolveCase({ caseId: 'INV-2026-252' }, mockCases)?.title, 'Cyber Fraud Investigation');
  assert.equal(resolveCase({ caseId: '#INV-2026-252' }, mockCases)?.title, 'Cyber Fraud Investigation');
  assert.equal(resolveCase({ caseId: 'GENERAL' }, mockCases), null);
  assert.equal(resolveCase({ caseId: 'N/A' }, mockCases), null);

  // Resolve document
  assert.equal(resolveDocument({ targetType: 'DOCUMENT', targetId: 'doc-123' }, mockDocs)?.name, 'ledger_dump.xlsx');
  assert.equal(resolveDocument({ targetType: 'DOCUMENT', targetId: 'ledger_dump.xlsx' }, mockDocs)?.id, 'doc-123');
  assert.equal(resolveDocument({ details: 'Tamper detected on document warrant_affidavit.pdf' }, mockDocs)?.id, 'doc-456');

  // Extract hash
  assert.equal(extractHash({ hash: 'c'.repeat(64) }), 'c'.repeat(64));
  assert.equal(extractHash({}, mockDocs[0]), 'a'.repeat(64));
  assert.equal(extractHash({ details: `Target SHA-256: ${'d'.repeat(64)} logged.` }), 'd'.repeat(64));
});

test('Audit Trail: filterAuditLogs multi-criteria filtering', () => {
  const logs = [
    {
      id: 'AUD-001',
      timestamp: '2026-09-27T02:36:13.000Z',
      actorName: 'Sh. Alok Vardhan',
      action: 'TAMPER_DETECTED',
      caseId: 'INV-2026-252',
      result: 'ALERT',
      details: 'Hash mismatch detected on seized hard drive image.'
    },
    {
      id: 'AUD-002',
      timestamp: '2026-09-27T02:35:54.000Z',
      actorName: 'Sh. Alok Vardhan',
      action: 'OCR_COMPLETED',
      caseId: 'INV-2026-252',
      result: 'SUCCESS',
      details: 'OCR completed for warrant.pdf with 98% confidence.'
    },
    {
      id: 'AUD-003',
      timestamp: '2026-09-26T18:20:00.000Z',
      actorName: 'System',
      action: 'DOCUMENT_STORED',
      caseId: 'INV-2026-0189',
      result: 'SUCCESS',
      details: 'Document evidence.zip stored on IPFS block 42.'
    },
    {
      id: 'AUD-004',
      timestamp: '2026-09-26T15:10:00.000Z',
      actorName: 'Insp. Vikram Rathore',
      action: 'UNAUTHORIZED_ACCESS_DENIED',
      caseId: 'INV-2026-0189',
      result: 'DENIED',
      details: '403 Forbidden: Clearance level too low.'
    }
  ];

  // 1. All logs
  assert.equal(filterAuditLogs(logs, {}).length, 4);

  // 2. Filter by Case
  const caseFiltered = filterAuditLogs(logs, { caseFilter: 'INV-2026-252' });
  assert.equal(caseFiltered.length, 2);
  assert.ok(caseFiltered.every(l => l.caseId === 'INV-2026-252'));

  // 3. Filter by Action
  const actionFiltered = filterAuditLogs(logs, { actionFilter: 'OCR_COMPLETED' });
  assert.equal(actionFiltered.length, 1);
  assert.equal(actionFiltered[0].id, 'AUD-002');

  // 4. Filter by Result
  const alertFiltered = filterAuditLogs(logs, { resultFilter: 'ALERT' });
  assert.equal(alertFiltered.length, 1);
  assert.equal(alertFiltered[0].id, 'AUD-001');

  const deniedFiltered = filterAuditLogs(logs, { resultFilter: 'DENIED' });
  assert.equal(deniedFiltered.length, 1);
  assert.equal(deniedFiltered[0].id, 'AUD-004');

  // 5. Filter by Date (YYYY-MM-DD)
  const dateFiltered = filterAuditLogs(logs, { dateFilter: '2026-09-26' });
  assert.equal(dateFiltered.length, 2);
  assert.ok(dateFiltered.some(l => l.id === 'AUD-003'));
  assert.ok(dateFiltered.some(l => l.id === 'AUD-004'));

  // 6. Search query
  const searchActor = filterAuditLogs(logs, { searchTerm: 'Alok' });
  assert.equal(searchActor.length, 2);

  const searchKeyword = filterAuditLogs(logs, { searchTerm: 'warrant.pdf' });
  assert.equal(searchKeyword.length, 1);
  assert.equal(searchKeyword[0].id, 'AUD-002');

  const searchHumanAction = filterAuditLogs(logs, { searchTerm: 'Tamper Detected' });
  assert.equal(searchHumanAction.length, 1);
  assert.equal(searchHumanAction[0].id, 'AUD-001');
});
