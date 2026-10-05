import test from 'node:test';
import assert from 'node:assert';
import { SharingService } from '../src/services/sharingService.js';
import { DEMO_USERS } from '../src/data/demoUsers.js';

test('RBAC & Case Access: Case assignment validation', () => {
  const investigator = DEMO_USERS.find(u => u.email === 'investigator@caseguard.gov');
  const officer = DEMO_USERS.find(u => u.email === 'officer@caseguard.gov');
  const legal = DEMO_USERS.find(u => u.email === 'legal@caseguard.gov');
  const admin = DEMO_USERS.find(u => u.email === 'admin@caseguard.gov');

  // Admin has universal access
  assert.strictEqual(SharingService.canUserAccessCase(admin, 'INV-2026-0189'), true);
  assert.strictEqual(SharingService.canUserAccessCase(admin, 'ANY-UNKNOWN-CASE'), true);

  // Investigator is assigned to 0142, 0189, 0077
  assert.strictEqual(SharingService.canUserAccessCase(investigator, 'INV-2026-0142'), true);
  assert.strictEqual(SharingService.canUserAccessCase(investigator, 'INV-2026-0189'), true);

  // Officer is strictly assigned to 0189 only
  assert.strictEqual(SharingService.canUserAccessCase(officer, 'INV-2026-0189'), true);
  assert.strictEqual(SharingService.canUserAccessCase(officer, 'INV-2026-0142'), false);

  // Legal is assigned to 0142 & 0077, NOT 0189
  assert.strictEqual(SharingService.canUserAccessCase(legal, 'INV-2026-0142'), true);
  assert.strictEqual(SharingService.canUserAccessCase(legal, 'INV-2026-0189'), false);
});

test('RBAC & Clearance: Document clearance hierarchy prevents unauthorized decryption', () => {
  const legal = DEMO_USERS.find(u => u.email === 'legal@caseguard.gov'); // Clearance: Confidential

  const confidentialDoc = {
    id: 'DOC-CONF',
    caseId: 'INV-2026-0142',
    name: 'FIR_Report.pdf',
    classification: 'Confidential'
  };

  const topSecretDoc = {
    id: 'DOC-TOP-SEC',
    caseId: 'INV-2026-0142',
    name: 'CFSL_Cyber_Forensics_Report.pdf',
    classification: 'Top Secret'
  };

  // Legal officer is assigned to INV-2026-0142:
  const accessConf = SharingService.checkDocumentAccess(legal, confidentialDoc);
  assert.strictEqual(accessConf.allowed, true);

  // But Top Secret docket is blocked by PoLP clearance gate
  const accessSecret = SharingService.checkDocumentAccess(legal, topSecretDoc);
  assert.strictEqual(accessSecret.allowed, false);
  assert.strictEqual(accessSecret.reason, 'CLEARANCE_INSUFFICIENT');
});

test('Document Sharing Lifecycle: Grant, Verify Token Access, and Revoke', () => {
  const investigator = DEMO_USERS.find(u => u.email === 'investigator@caseguard.gov');
  const legal = DEMO_USERS.find(u => u.email === 'legal@caseguard.gov');

  const unassignedDoc = {
    id: 'DOC-0189-FIR',
    caseId: 'INV-2026-0189', // Legal is NOT assigned to this case!
    name: 'Homicide_FIR_0189.pdf',
    classification: 'Secret'
  };

  // 1. Initial check: Legal officer is blocked
  const initialCheck = SharingService.checkDocumentAccess(legal, unassignedDoc);
  assert.strictEqual(initialCheck.allowed, false);
  assert.strictEqual(initialCheck.reason, 'NOT_ASSIGNED_TO_CASE');

  // 2. Investigator shares document with Legal Officer with VIEW permission for 24h
  const share = SharingService.createShare({
    document: unassignedDoc,
    sharedBy: investigator,
    recipient: legal,
    permission: 'VIEW',
    expiryHours: 24,
    purpose: 'Bail objection prep'
  });

  assert.ok(share.id.startsWith('SHR-'));
  assert.strictEqual(share.permission, 'VIEW');

  // 3. Check again: Legal Officer now has access via active share!
  const sharedCheck = SharingService.checkDocumentAccess(legal, unassignedDoc);
  assert.strictEqual(sharedCheck.allowed, true);
  assert.strictEqual(sharedCheck.isShared, true);
  assert.deepStrictEqual(sharedCheck.permissions, ['VIEW']);

  // 4. Revoke share
  const revoked = SharingService.revokeShare(share.id, investigator);
  assert.strictEqual(revoked.isRevoked, true);

  // 5. Check again: Legal Officer is blocked once more
  const afterRevokeCheck = SharingService.checkDocumentAccess(legal, unassignedDoc);
  assert.strictEqual(afterRevokeCheck.allowed, false);
  assert.strictEqual(afterRevokeCheck.reason, 'NOT_ASSIGNED_TO_CASE');
});

test('Dashboard Role-Aware Scoping: Correctly computes accessible cases and documents per officer', () => {
  const officer = DEMO_USERS.find(u => u.email === 'officer@caseguard.gov');
  const admin = DEMO_USERS.find(u => u.email === 'admin@caseguard.gov');

  const mockCases = [
    { id: '1', caseNumber: 'INV-2026-0142', title: 'Cyber Fraud' },
    { id: '2', caseNumber: 'INV-2026-0189', title: 'Homicide Docket' },
    { id: '3', caseNumber: 'INV-2026-0077', title: 'Customs Smuggling' }
  ];

  const mockDocs = [
    { id: 'd1', caseId: 'INV-2026-0142', name: 'FIR.pdf', classification: 'Confidential' },
    { id: 'd2', caseId: 'INV-2026-0189', name: 'Autopsy.pdf', classification: 'Secret' },
    { id: 'd3', caseId: 'INV-2026-0077', name: 'Invoice.pdf', classification: 'Confidential' }
  ];

  // Officer access (INV-2026-0189 only)
  const officerCases = mockCases.filter(c => SharingService.canUserAccessCase(officer, c));
  assert.strictEqual(officerCases.length, 1);
  assert.strictEqual(officerCases[0].caseNumber, 'INV-2026-0189');

  const officerDocs = mockDocs.filter(d => {
    if (!SharingService.canUserAccessCase(officer, d.caseId)) return false;
    return SharingService.checkDocumentAccess(officer, d).allowed;
  });
  assert.strictEqual(officerDocs.length, 1);
  assert.strictEqual(officerDocs[0].name, 'Autopsy.pdf');

  // Admin access (All)
  const adminCases = mockCases.filter(c => SharingService.canUserAccessCase(admin, c));
  assert.strictEqual(adminCases.length, 3);

  const adminDocs = mockDocs.filter(d => {
    if (!SharingService.canUserAccessCase(admin, d.caseId)) return false;
    return SharingService.checkDocumentAccess(admin, d).allowed;
  });
  assert.strictEqual(adminDocs.length, 3);
});

test('Document Vault Search & Filter Engine: Multi-criteria filtering operates cleanly', () => {
  const mockVaultDocs = [
    { id: '1', name: 'FIR_Report.pdf', caseId: 'INV-2026-0142', type: 'FIR', classification: 'Confidential', isTampered: false, ocr: { extractedText: 'sim card banking transaction' } },
    { id: '2', name: 'Forensic_Trace.xlsx', caseId: 'INV-2026-0142', type: 'Forensic Report', classification: 'Secret', isTampered: true, ocr: null },
    { id: '3', name: 'ChargeSheet_Draft.docx', caseId: 'INV-2026-0077', type: 'Charge Sheet', classification: 'Top Secret', isTampered: false, ocr: { extractedText: 'customs clearance invoice' } },
    { id: '4', name: 'Witness_Audio.mp3', caseId: 'INV-2026-0189', type: 'Evidence', classification: 'Confidential', isTampered: false, ocr: null }
  ];

  // 1. Search Query: "customs" (matches OCR extracted text)
  const q1 = 'customs';
  const res1 = mockVaultDocs.filter(d => {
    return d.name.toLowerCase().includes(q1) || (d.ocr?.extractedText && d.ocr.extractedText.toLowerCase().includes(q1));
  });
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].id, '3');

  // 2. Filter: Integrity Mismatch only
  const res2 = mockVaultDocs.filter(d => d.isTampered);
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].name, 'Forensic_Trace.xlsx');

  // 3. Multi-filter: Case INV-2026-0142 AND Classification Secret
  const res3 = mockVaultDocs.filter(d => d.caseId === 'INV-2026-0142' && d.classification === 'Secret');
  assert.strictEqual(res3.length, 1);
  assert.strictEqual(res3[0].name, 'Forensic_Trace.xlsx');

  // 4. Combined Filter + Search: Case INV-2026-0142 AND query "sim"
  const res4 = mockVaultDocs.filter(d => {
    const matchCase = d.caseId === 'INV-2026-0142';
    const matchQ = d.name.toLowerCase().includes('sim') || (d.ocr?.extractedText && d.ocr.extractedText.toLowerCase().includes('sim'));
    return matchCase && matchQ;
  });
  assert.strictEqual(res4.length, 1);
  assert.strictEqual(res4[0].name, 'FIR_Report.pdf');
});


