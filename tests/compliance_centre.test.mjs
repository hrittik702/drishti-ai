import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCentreCode,
  getComplianceStatusBadge,
  getSeverityBadge,
  calculateDiscrepancy,
  filterAndSortCentres
} from '../src/utils/centreUtils.js';
import { INITIAL_CENTRES } from '../src/data/initialCentres.js';

test('Centre Utils: formatCentreCode formats standard and custom codes correctly', () => {
  assert.equal(formatCentreCode('TC-DEL-0142'), '#TC-DEL-0142');
  assert.equal(formatCentreCode('#TC-BLR-0189'), '#TC-BLR-0189');
  assert.equal(formatCentreCode(''), '#TC-UNKNOWN');
  assert.equal(formatCentreCode(null), '#TC-UNKNOWN');
});

test('Centre Utils: getComplianceStatusBadge maps statuses to compliant badges', () => {
  const comp = getComplianceStatusBadge('COMPLIANT');
  assert.equal(comp.label, 'COMPLIANT');
  assert.equal(comp.color, 'emerald');
  assert.ok(comp.badgeClass.includes('emerald'));

  const att = getComplianceStatusBadge('ATTENTION');
  assert.equal(att.label, 'ATTENTION');
  assert.equal(att.color, 'amber');

  const crit = getComplianceStatusBadge('CRITICAL');
  assert.equal(crit.label, 'CRITICAL');
  assert.equal(crit.color, 'red');

  const off = getComplianceStatusBadge('OFFLINE');
  assert.equal(off.label, 'OFFLINE');
  assert.equal(off.color, 'slate');
});

test('Centre Utils: calculateDiscrepancy calculates count differences and rates', () => {
  // Congruent attendance
  const res1 = calculateDiscrepancy(20, 20);
  assert.equal(res1.difference, 0);
  assert.equal(res1.discrepancyRate, 0.0);
  assert.equal(res1.status, 'VERIFIED');

  // Deficit discrepancy (-6 out of 28 is ~21.4%)
  const res2 = calculateDiscrepancy(28, 22);
  assert.equal(res2.difference, -6);
  assert.equal(res2.discrepancyRate, 21.4);
  assert.equal(res2.status, 'MISMATCH');

  // Total absence (0 out of 20 is 100%)
  const res3 = calculateDiscrepancy(20, 0);
  assert.equal(res3.difference, -20);
  assert.equal(res3.discrepancyRate, 100.0);
  assert.equal(res3.status, 'MISMATCH');
});

test('Centre Utils: filterAndSortCentres filters by search query and compliance status', () => {
  assert.ok(INITIAL_CENTRES.length >= 4);

  // Search by state
  const delhiCentres = filterAndSortCentres(INITIAL_CENTRES, { search: 'Delhi' });
  assert.ok(delhiCentres.length > 0);
  assert.ok(delhiCentres.every(c => c.location.state === 'Delhi' || c.name.includes('Delhi') || c.centreCode.includes('DEL')));

  // Filter by status
  const critical = filterAndSortCentres(INITIAL_CENTRES, { status: 'CRITICAL' });
  assert.ok(critical.length > 0);
  assert.ok(critical.every(c => c.complianceStatus === 'CRITICAL'));

  // Sort by discrepancy
  const sorted = filterAndSortCentres(INITIAL_CENTRES, {}, 'discrepancy');
  for (let i = 0; i < sorted.length - 1; i++) {
    const rateA = Math.abs(sorted[i].attendance?.discrepancyRate || 0);
    const rateB = Math.abs(sorted[i + 1].attendance?.discrepancyRate || 0);
    assert.ok(rateA >= rateB, `Discrepancy sorting should be descending: ${rateA} >= ${rateB}`);
  }
});

test('Compliance Repositories: CentreRepository and ComplianceEventRepository handle CRUD and status updates', async () => {
  const { CentreRepository } = await import('../src/services/centreRepository.js');
  const { ComplianceEventRepository } = await import('../src/services/complianceEventRepository.js');

  // 1. CentreRepository
  const centres = await CentreRepository.getAllCentres();
  assert.ok(Array.isArray(centres));
  assert.ok(centres.length >= 4);

  const okhla = await CentreRepository.getCentreById('TC-DEL-0142');
  assert.ok(okhla);
  assert.equal(okhla.centreCode, 'TC-DEL-0142');
  assert.equal(okhla.complianceStatus, 'ATTENTION');

  // 2. ComplianceEventRepository
  const events = await ComplianceEventRepository.getAllEvents();
  assert.ok(Array.isArray(events));
  assert.ok(events.length >= 3);

  const firstEvent = events[0];
  assert.ok(firstEvent.id);
  assert.ok(firstEvent.centreId);
  assert.ok(firstEvent.eventType);
  assert.ok(firstEvent.severity);

  // Status update
  const originalStatus = firstEvent.status;
  await ComplianceEventRepository.updateEventStatus(firstEvent.id, 'RESOLVED');
  const updatedEvents = await ComplianceEventRepository.getAllEvents();
  const matched = updatedEvents.find(e => e.id === firstEvent.id);
  assert.equal(matched.status, 'RESOLVED');

  // Restore status
  await ComplianceEventRepository.updateEventStatus(firstEvent.id, originalStatus);
});

test('Compliance Lifecycle: Direct Centre creation decouples from legacy CaseRepository', async () => {
  const { CentreRepository } = await import('../src/services/centreRepository.js');
  
  const testCode = `TC-TEST-${Date.now().toString(36).toUpperCase()}`;
  const created = await CentreRepository.createCentre({
    id: testCode,
    centreCode: testCode,
    name: 'Apex Skill Training Centre — Rohini',
    scheme: 'PMKVY 4.0',
    sector: 'IT-ITeS',
    location: { state: 'Delhi', district: 'North West Delhi', address: 'Sector 14 Rohini' },
    complianceStatus: 'COMPLIANT',
    activeBatch: {
      batchId: 'BATCH-TEST-01',
      courseName: 'Cloud Computing Technician',
      enrolledCount: 30,
      startTime: '09:00',
      endTime: '17:00'
    },
    attendance: {
      declaredExpected: 30,
      detectedByAI: 30,
      difference: 0,
      discrepancyRate: 0.0,
      status: 'VERIFIED'
    }
  });

  assert.equal(created.centreCode, testCode);
  assert.equal(created.complianceStatus, 'COMPLIANT');

  const retrieved = await CentreRepository.getCentreById(testCode);
  assert.ok(retrieved);
  assert.equal(retrieved.name, 'Apex Skill Training Centre — Rohini');
  assert.equal(retrieved.activeBatch.courseName, 'Cloud Computing Technician');
});

test('Compliance Events: Filtering by severity and centre association', async () => {
  const { ComplianceEventRepository } = await import('../src/services/complianceEventRepository.js');
  
  const events = await ComplianceEventRepository.getAllEvents();
  assert.ok(events.length > 0);

  const criticalEvents = events.filter(e => e.severity === 'Critical');
  assert.ok(criticalEvents.every(e => e.severity === 'Critical'));

  for (const e of events) {
    assert.ok(e.centreId, 'Event must be associated with a valid centreId');
    assert.ok(e.detectedValue !== undefined, 'Event must contain detectedValue telemetry');
    assert.ok(e.expectedValue !== undefined, 'Event must contain expectedValue reference');
  }
});

test('Domain Terminology: Clean domain compliance views contain zero obsolete DMS legal strings', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const srcDir = path.resolve(__dirname, '../src');

  const targetFiles = [
    'components/TrainingCentresView.jsx',
    'components/CasesView.jsx',
    'components/TrainingCentreWorkspace.jsx',
    'components/CaseWorkspace.jsx',
    'components/AuditTrailView.jsx',
    'components/DocumentLibrary.jsx',
    'components/OnboardCentreModal.jsx'
  ];

  const obsoleteLegalTerms = [
    'FIR No',
    'BNS Section',
    'Police Station',
    'Malkhana',
    'Court Docket'
  ];

  for (const relPath of targetFiles) {
    const fullPath = path.join(srcDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8').toLowerCase();

    for (const term of obsoleteLegalTerms) {
      assert.equal(
        content.includes(term.toLowerCase()),
        false,
        `File ${relPath} should not expose obsolete DMS term "${term}"`
      );
    }
  }
});

test('Phase 2 IA & Branding: Wordmark and shell reflect COMPLIANCEGUARD identity', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const srcDir = path.resolve(__dirname, '../src');

  // 1. CaseGuardLogo renders COMPLIANCEGUARD
  const logoContent = fs.readFileSync(path.join(srcDir, 'components/CaseGuardLogo.jsx'), 'utf8');
  assert.ok(logoContent.includes('COMPLIANCEGUARD'), 'CaseGuardLogo must display COMPLIANCEGUARD wordmark');

  // 2. TopHeader displays COMPLIANCEGUARD breadcrumbs and proper search placeholder
  const headerContent = fs.readFileSync(path.join(srcDir, 'components/TopHeader.jsx'), 'utf8');
  assert.ok(headerContent.includes('COMPLIANCEGUARD'), 'TopHeader breadcrumbs must include COMPLIANCEGUARD');
  assert.ok(headerContent.includes('Search centres, batches, or compliance events...'), 'TopHeader must have compliance search placeholder');

  // 3. LoginView contains compliance monitoring persona texts
  const loginContent = fs.readFileSync(path.join(srcDir, 'components/LoginView.jsx'), 'utf8');
  assert.ok(loginContent.includes('Edge-AI Monitoring Online'), 'LoginView must display Edge-AI Monitoring Online badge');
  assert.ok(loginContent.includes('COMPLIANCEGUARD — Edge-AI Training Centre Compliance Monitoring System'), 'LoginView footer must show COMPLIANCEGUARD system title');
  assert.ok(!loginContent.includes('legal and investigation records'), 'LoginView must not describe legal/investigation records');

  // 4. SidebarNav uses text-sm for comfortable legibility while preserving 44px touch targets
  const navContent = fs.readFileSync(path.join(srcDir, 'components/SidebarNav.jsx'), 'utf8');
  assert.match(navContent, /text-sm font-medium transition-colors/, 'SidebarNav buttons must use text-sm font size');
  assert.match(navContent, /min-h-\[44px\]/, 'SidebarNav buttons must maintain 44px min touch target');
});

test('Phase 2 Content Hierarchy: Centre directory and workspace prioritize operational clarity', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const srcDir = path.resolve(__dirname, '../src');

  // 1. CasesView desktop table has streamlined 7 columns with unified Training Centre header
  const casesContent = fs.readFileSync(path.join(srcDir, 'components/CasesView.jsx'), 'utf8');
  assert.ok(casesContent.includes('<th className="py-3 px-4 font-semibold">Training Centre</th>'), 'CasesView must have unified Training Centre column');
  assert.ok(!casesContent.includes('<th className="py-3 px-4 font-semibold">Centre Code</th>'), 'CasesView must not have separate Centre Code column');

  // 2. CaseWorkspace features 3 quick stat summary pills and 4-column infrastructure table
  const workspaceContent = fs.readFileSync(path.join(srcDir, 'components/CaseWorkspace.jsx'), 'utf8');
  assert.ok(workspaceContent.includes('Attendance Compliance Snapshot'), 'Overview tab must provide quick attendance snapshot');
  assert.ok(workspaceContent.includes('Infrastructure & Equipment Summary'), 'Overview tab must provide equipment summary');
  assert.ok(workspaceContent.includes('Camera Feeds'), 'CaseWorkspace header must include Camera Feeds stat pill');

  // 3. Dashboard features REQUIRING ATTENTION operational KPI card
  const dashboardContent = fs.readFileSync(path.join(srcDir, 'components/Dashboard.jsx'), 'utf8');
  assert.ok(dashboardContent.includes("label: 'REQUIRING ATTENTION'"), 'Dashboard must feature REQUIRING ATTENTION KPI');
  assert.ok(!dashboardContent.includes('>Sealed<'), 'Dashboard must not use obsolete DMS Sealed status label');
});

