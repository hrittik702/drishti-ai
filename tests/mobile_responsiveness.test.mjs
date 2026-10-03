import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function readFile(relPath) {
  return fs.readFileSync(path.join(srcDir, relPath), 'utf8');
}

test('Mobile Navigation & Header: Touch targets, escape handling, and responsive heights', () => {
  const topHeader = readFile('components/TopHeader.jsx');
  const sidebarNav = readFile('components/SidebarNav.jsx');
  const toast = readFile('components/Toast.jsx');

  // TopHeader responsive height & min 44x44px touch targets
  assert.match(topHeader, /h-14 sm:h-16/, 'TopHeader has responsive height h-14 sm:h-16');
  assert.match(topHeader, /min-h-\[44px\] min-w-\[44px\]/, 'TopHeader menu/user buttons have at least 44x44px touch targets');

  // SidebarNav Escape key listener and 44px min-height buttons
  assert.match(sidebarNav, /e\.key === 'Escape'/, 'SidebarNav contains native Escape key listener for closing mobile drawer');
  assert.match(sidebarNav, /min-h-\[44px\]/, 'SidebarNav buttons adhere to min-h-[44px] touch target requirement');
  assert.match(sidebarNav, /w-11 h-11/, 'SidebarNav mobile close button has 44x44px hit target');

  // Toast responsive containment
  assert.match(toast, /w-\[calc\(100vw-32px\)\] sm:w-auto/, 'Toast container eliminates horizontal overflow on mobile viewports');
});

test('Mobile Table Pattern: Cases, Integrity, Audit, and Access Control provide md:hidden stacked cards', () => {
  const casesView = readFile('components/CasesView.jsx');
  const integrityView = readFile('components/IntegrityVerificationView.jsx');
  const auditView = readFile('components/AuditTrailView.jsx');
  const accessControlView = readFile('components/AccessControlView.jsx');

  // CasesView popover containment and bottom-sheet drawer
  assert.match(casesView, /w-\[calc\(100vw-32px\)\] sm:w-72 max-w-sm/, 'CasesView filter popover constrained to viewport width');
  assert.match(casesView, /items-end sm:items-stretch/, 'CasesView drawer presents as bottom-sheet on mobile');
  assert.match(casesView, /h-\[88vh\] sm:h-full/, 'CasesView drawer has responsive bottom-sheet height on mobile');
  assert.match(casesView, /rounded-t-2xl sm:rounded-none/, 'CasesView drawer has rounded-t-2xl sheet styling');

  // IntegrityVerificationView desktop table separation and mobile stacked cards
  assert.match(integrityView, /hidden md:block/, 'IntegrityVerificationView wraps wide table for md+ screens');
  assert.match(integrityView, /md:hidden/, 'IntegrityVerificationView has md:hidden stacked cards');
  assert.match(integrityView, /rounded-t-2xl sm:rounded-none/, 'IntegrityVerificationView drawer presents as bottom sheet');

  // AuditTrailView desktop table separation and mobile stacked cards
  assert.match(auditView, /hidden md:block/, 'AuditTrailView wraps wide table for md+ screens');
  assert.match(auditView, /md:hidden/, 'AuditTrailView has md:hidden stacked cards');
  assert.match(auditView, /rounded-t-2xl sm:rounded-none/, 'AuditTrailView drawer presents as bottom sheet');

  // AccessControlView desktop table separation, mobile stacked cards, and interactive role selector
  assert.match(accessControlView, /hidden md:block/, 'AccessControlView wraps desktop table and matrix in hidden md:block');
  assert.match(accessControlView, /md:hidden space-y-3/, 'AccessControlView provides mobile stacked cards for roles');
  assert.match(accessControlView, /id="mobile-role-select"/, 'AccessControlView provides interactive Role Selector for Permission Matrix on mobile');
});

test('Mobile Search & Popover Overflow Prevention', () => {
  const globalSearchView = readFile('components/GlobalSearchView.jsx');

  assert.match(
    globalSearchView, 
    /w-\[calc\(100vw-32px\)\] sm:w-72 max-w-sm/, 
    'GlobalSearchView filter popover constrained to avoid viewport overflow on small devices'
  );
});

test('Mobile Document Workspace & Viewers: Bottom-sheet drawer, responsive scaling, and modal containment', () => {
  const docWorkspace = readFile('components/DocumentWorkspace.jsx');
  const pdfViewer = readFile('components/viewers/PdfViewer.jsx');
  const accessDeniedModal = readFile('components/AccessDeniedModal.jsx');

  // DocumentWorkspace drawer bottom sheet
  assert.match(docWorkspace, /fixed sm:absolute inset-x-0 bottom-0/, 'DocumentWorkspace inspector behaves as bottom-sheet on mobile');
  assert.match(docWorkspace, /rounded-t-2xl sm:rounded-none/, 'DocumentWorkspace inspector has rounded-t-2xl styling on mobile');
  assert.match(docWorkspace, /w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden/, 'DocumentWorkspace inspector includes visual drag pill on mobile');

  // PdfViewer responsive scaling
  assert.match(pdfViewer, /getInitialScale/, 'PdfViewer defines dynamic viewport scale calculation');
  assert.match(pdfViewer, /window\.innerWidth < 640/, 'PdfViewer detects mobile viewport for initial scale fitting');

  // AccessDeniedModal containment and responsive actions
  assert.match(accessDeniedModal, /max-h-\[calc\(100vh-24px\)\]/, 'AccessDeniedModal constrained to prevent viewport clipping on mobile');
  assert.match(accessDeniedModal, /flex-col-reverse sm:flex-row/, 'AccessDeniedModal footer stacks buttons cleanly on mobile');
});
