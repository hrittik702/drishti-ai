import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCaseId,
  getCasePriority,
  getCaseStatus,
  formatCaseDate,
  getCaseDocumentCount,
  filterAndSortCases
} from '../src/utils/caseUtils.js';
import { CaseRepository } from '../src/services/caseRepository.js';
import { SharingService } from '../src/services/sharingService.js';

// Sample mock data for testing
const mockCases = [
  {
    id: 'CASE-001',
    caseNumber: 'INV-2026-0142',
    title: 'Financial Fraud & Mule Banking Syndicate Investigation',
    type: 'Financial Cybercrime',
    status: 'Active Investigation',
    priority: 'High',
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '2026-09-26T09:42:00.000Z',
    policeStation: 'Special Cell (EOW), New Delhi',
    courtName: 'Rouse Avenue Courts',
    acts: ['Section 66C & 66D IT Act', 'Section 318(4) BNS'],
    assignedOfficers: ['Inspector Vikram Rathore', 'Dr. Ananya Sharma']
  },
  {
    id: 'CASE-002',
    caseNumber: 'INV-2026-0358',
    title: 'Shivam vs Shivani Domestic Asset Sequestration',
    type: 'Civil & Asset Recovery',
    status: 'In Trial',
    priority: 'Critical',
    createdAt: '2026-09-20T08:00:00.000Z',
    updatedAt: '2026-09-27T02:15:00.000Z',
    policeStation: 'Hauz Khas Police Station',
    courtName: 'Saket District Court',
    acts: ['Section 84 BNSS (Attachment of Property)'],
    assignedOfficers: ['Inspector Vikram Rathore']
  },
  {
    id: 'CASE-003',
    caseNumber: 'INV-2026-0937',
    title: 'State vs Rajesh Narcotic Trafficking Interception',
    type: 'Narcotics & Contraband',
    status: 'Charge Sheet Filed',
    priority: 'Low',
    createdAt: '2026-09-15T12:00:00.000Z',
    updatedAt: '2026-09-25T14:30:00.000Z',
    policeStation: 'Crime Branch Narcotics Cell',
    courtName: 'Patiala House Courts',
    acts: ['NDPS Act Section 20(b)'],
    assignedOfficers: ['Dr. Ananya Sharma']
  }
];

const mockDocuments = [
  { id: 'DOC-1', caseId: 'INV-2026-0142', name: 'Evidence_Report.pdf' },
  { id: 'DOC-2', caseId: '#INV-2026-0142', name: 'Bank_Statement.xlsx' },
  { id: 'DOC-3', caseId: 'CASE-002', name: 'Court_Sequestration_Order.pdf' }
];

const mockUserWithAssignedCases = {
  id: 'usr-1',
  name: 'Inspector Vikram Rathore',
  designation: 'Investigation Officer',
  role: { id: 'investigation_officer', name: 'Investigation Officer' },
  assignedCases: ['INV-2026-0142', 'INV-2026-0358']
};

test('Case Utils: formatCaseId formats standard monospace identifier', () => {
  assert.equal(formatCaseId('INV-2026-0142'), '#INV-2026-0142');
  assert.equal(formatCaseId('#INV-2026-0142'), '#INV-2026-0142');
  assert.equal(formatCaseId(''), '#CASE-UNKNOWN');
  assert.equal(formatCaseId(null), '#CASE-UNKNOWN');
});

test('Case Utils: getCasePriority returns restrained enterprise styling', () => {
  const critical = getCasePriority('Critical');
  assert.equal(critical.label, 'Critical');
  assert.ok(critical.badgeClass.includes('text-red-700'));

  const high = getCasePriority('High');
  assert.equal(high.label, 'High');
  assert.ok(high.badgeClass.includes('text-amber-700'));

  const medium = getCasePriority('Medium');
  assert.equal(medium.label, 'Medium');
  assert.ok(medium.badgeClass.includes('text-slate-700'));

  const low = getCasePriority('Low');
  assert.equal(low.label, 'Low');
  assert.ok(low.badgeClass.includes('text-slate-600'));
});

test('Case Utils: getCaseStatus returns understated lifecycle status', () => {
  const active = getCaseStatus('Active Investigation');
  assert.equal(active.label, 'Active Investigation');
  assert.ok(active.badgeClass.includes('text-blue-700'));

  const chargeSheet = getCaseStatus('Charge Sheet Filed');
  assert.equal(chargeSheet.label, 'Charge Sheet Filed');
  assert.ok(chargeSheet.badgeClass.includes('text-emerald-700'));

  const inTrial = getCaseStatus('In Trial');
  assert.equal(inTrial.label, 'In Trial');
  assert.ok(inTrial.badgeClass.includes('text-purple-700'));

  const closed = getCaseStatus('Closed');
  assert.equal(closed.label, 'Closed');
  assert.ok(closed.badgeClass.includes('text-slate-500'));
});

test('Case Utils: formatCaseDate produces compact readable strings', () => {
  const formatted = formatCaseDate('2026-09-26T09:42:00.000Z');
  assert.ok(formatted.includes('2026'));
  assert.ok(formatted.includes('Sep'));
  assert.equal(formatCaseDate(''), 'N/A');
  assert.equal(formatCaseDate(null), 'N/A');
});

test('Case Utils: getCaseDocumentCount accurately resolves document associations', () => {
  // Case 1 has 2 documents (one with 'INV-2026-0142' and one with '#INV-2026-0142')
  const count1 = getCaseDocumentCount(mockCases[0], mockDocuments);
  assert.equal(count1, 2);

  // Case 2 has 1 document matching its id 'CASE-002'
  const count2 = getCaseDocumentCount(mockCases[1], mockDocuments);
  assert.equal(count2, 1);

  // Case 3 has 0 documents
  const count3 = getCaseDocumentCount(mockCases[2], mockDocuments);
  assert.equal(count3, 0);
});

test('Case Utils: filterAndSortCases supports search, filtering and sorting', () => {
  // 1. Search by Case Number
  const searchNumber = filterAndSortCases(mockCases, mockDocuments, { search: '0142' });
  assert.equal(searchNumber.length, 1);
  assert.equal(searchNumber[0].caseNumber, 'INV-2026-0142');

  // 2. Search by Title keyword
  const searchTitle = filterAndSortCases(mockCases, mockDocuments, { search: 'Domestic Asset' });
  assert.equal(searchTitle.length, 1);
  assert.equal(searchTitle[0].caseNumber, 'INV-2026-0358');

  // 3. Search by Statute
  const searchAct = filterAndSortCases(mockCases, mockDocuments, { search: 'NDPS' });
  assert.equal(searchAct.length, 1);
  assert.equal(searchAct[0].caseNumber, 'INV-2026-0937');

  // 4. Search by Assigned Officer
  const searchOfficer = filterAndSortCases(mockCases, mockDocuments, { search: 'Rathore' });
  assert.equal(searchOfficer.length, 2);

  // 5. Filter by Priority
  const filterCrit = filterAndSortCases(mockCases, mockDocuments, { priority: 'Critical' });
  assert.equal(filterCrit.length, 1);
  assert.equal(filterCrit[0].caseNumber, 'INV-2026-0358');

  // 6. Filter by Status
  const filterStatus = filterAndSortCases(mockCases, mockDocuments, { status: 'Charge Sheet Filed' });
  assert.equal(filterStatus.length, 1);
  assert.equal(filterStatus[0].caseNumber, 'INV-2026-0937');

  // 7. Filter by Case Type
  const filterType = filterAndSortCases(mockCases, mockDocuments, { type: 'Financial Cybercrime' });
  assert.equal(filterType.length, 1);
  assert.equal(filterType[0].caseNumber, 'INV-2026-0142');

  // 8. Filter by RBAC Access
  const filterAccessible = filterAndSortCases(mockCases, mockDocuments, { access: 'ACCESSIBLE' }, 'updated', mockUserWithAssignedCases);
  assert.equal(filterAccessible.length, 2);

  const filterRestricted = filterAndSortCases(mockCases, mockDocuments, { access: 'RESTRICTED' }, 'updated', mockUserWithAssignedCases);
  assert.equal(filterRestricted.length, 1);
  assert.equal(filterRestricted[0].caseNumber, 'INV-2026-0937');

  // 9. Sorting by priority (Critical > High > Low)
  const sortPriority = filterAndSortCases(mockCases, mockDocuments, {}, 'priority');
  assert.equal(sortPriority[0].priority, 'Critical');
  assert.equal(sortPriority[1].priority, 'High');
  assert.equal(sortPriority[2].priority, 'Low');

  // 10. Sorting by records (Case 1: 2, Case 2: 1, Case 3: 0)
  const sortRecords = filterAndSortCases(mockCases, mockDocuments, {}, 'records');
  assert.equal(sortRecords[0].caseNumber, 'INV-2026-0142');
  assert.equal(sortRecords[1].caseNumber, 'INV-2026-0358');
  assert.equal(sortRecords[2].caseNumber, 'INV-2026-0937');
});

test('Case Repository: createCase, updateCase and getCaseById lifecycle', async () => {
  const newCaseData = {
    caseNumber: 'INV-2026-TEST-999',
    title: 'Autonomous Evidence Ingestion Test',
    type: 'Cybercrime',
    priority: 'Critical',
    status: 'Active Investigation',
    description: 'Verifying case lifecycle operations.'
  };

  // 1. Create
  const created = await CaseRepository.createCase(newCaseData);
  assert.ok(created.id);
  assert.equal(created.caseNumber, 'INV-2026-TEST-999');

  // 2. Retrieve
  const fetched = await CaseRepository.getCaseById(created.id);
  assert.ok(fetched);
  assert.equal(fetched.title, 'Autonomous Evidence Ingestion Test');

  // 3. Update
  const updated = await CaseRepository.updateCase(created.id, {
    status: 'Charge Sheet Filed',
    priority: 'High'
  });
  assert.equal(updated.status, 'Charge Sheet Filed');
  assert.equal(updated.priority, 'High');

  // 4. Delete
  const deleted = await CaseRepository.deleteCase(created.id);
  assert.equal(deleted, true);
});
