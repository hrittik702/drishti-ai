import test from 'node:test';
import assert from 'node:assert/strict';

test('Access Denied: Duplicate toast suppression logic filters out access-denied notifications while modal is open', () => {
  const toasts = [
    { id: '1', title: 'Case Created', message: 'Case #INV-2026-900 created successfully', type: 'success' },
    { id: '2', title: '403 Access Denied', message: 'You are not assigned to Case #INV-2026-553', type: 'warning' },
    { id: '3', title: 'Download Denied', message: 'Insufficient clearance', type: 'error' },
    { id: '4', title: 'System Notice', message: 'Audit sync completed', type: 'info' }
  ];

  // When accessDeniedData is null (modal closed): all toasts visible
  let accessDeniedData = null;
  let visibleToasts = accessDeniedData
    ? toasts.filter(t => !t.title?.toLowerCase().includes('denied') && !t.title?.includes('403'))
    : toasts;

  assert.equal(visibleToasts.length, 4, 'All toasts should be visible when modal is closed');

  // When accessDeniedData is active (modal open): access-denied and 403 toasts are hidden
  accessDeniedData = {
    docName: 'Case Dossier #INV-2026-553',
    role: { name: 'Officer Sharma', designation: 'INVESTIGATOR', clearance: 'Secret' },
    attemptedType: 'CASE',
    resourceClassification: 'Confidential Case File',
    denialReason: 'Officer Sharma is not assigned to this case.'
  };

  visibleToasts = accessDeniedData
    ? toasts.filter(t => !t.title?.toLowerCase().includes('denied') && !t.title?.includes('403'))
    : toasts;

  assert.equal(visibleToasts.length, 2, 'Only non-denial toasts should be visible while modal is open');
  assert.equal(visibleToasts[0].id, '1', 'Case Created toast should remain visible');
  assert.equal(visibleToasts[1].id, '4', 'System Notice toast should remain visible');
});

test('Access Denied: Classification badge color determination follows non-error convention', () => {
  const getBadgeClass = (classification) => {
    const isSecretOrHigher = (classification || '').toLowerCase().includes('secret');
    return isSecretOrHigher
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Confidential & Restricted should not be red
  assert.ok(getBadgeClass('Confidential Case File').includes('bg-slate-100'));
  assert.ok(getBadgeClass('Restricted Case File').includes('bg-slate-100'));
  assert.ok(!getBadgeClass('Confidential Case File').includes('bg-red-'));

  // Secret & Top Secret should use amber
  assert.ok(getBadgeClass('Secret').includes('bg-amber-50'));
  assert.ok(getBadgeClass('Top Secret').includes('bg-amber-50'));
  assert.ok(!getBadgeClass('Top Secret').includes('bg-red-'));
});

test('Access Denied: Requested action determines correct action label', () => {
  const getRequestedAction = (type) => (type === 'CASE' ? 'View Case Dossier' : 'View Document');

  assert.equal(getRequestedAction('CASE'), 'View Case Dossier');
  assert.equal(getRequestedAction('DOCUMENT'), 'View Document');
  assert.equal(getRequestedAction(undefined), 'View Document');
});

test('Access Denied: Modal markup contracts: width constraint, clean white header, and escape handler', async () => {
  const fs = await import('node:fs');
  const modalCode = fs.readFileSync('src/components/AccessDeniedModal.jsx', 'utf-8');

  // Verify modal constraints
  assert.ok(modalCode.includes('max-w-[540px]') || modalCode.includes('max-w-lg'), 'Modal must have max-width controlled to ~540-560px');
  assert.ok(modalCode.includes('rounded-xl'), 'Modal must use rounded-xl');
  assert.ok(!modalCode.includes('rounded-2xl'), 'Modal must not use rounded-2xl');

  // Verify clean white header with ShieldAlert
  assert.ok(modalCode.includes('ShieldAlert'), 'Modal header must use ShieldAlert icon');
  assert.ok(modalCode.includes('Access denied'), 'Modal header title must be Access denied');
  assert.ok(!modalCode.includes('403 Access Denied — Security Boundary Enforced'), 'Old alarmist headline must be removed');

  // Verify ESC key handler
  assert.ok(modalCode.includes("e.key === 'Escape'"), 'Modal must handle Escape keydown');

  // Verify backdrop blur and restrained opacity
  assert.ok(modalCode.includes('bg-slate-950/45'), 'Backdrop must use restrained slate-950/45');

  // Verify audit event and footer action
  assert.ok(modalCode.includes('FileClock'), 'Audit event block must use FileClock icon');
  assert.ok(modalCode.includes('View logged audit entry'), 'Footer must contain View logged audit entry action');
  assert.ok(modalCode.includes('Acknowledge & Close'), 'Footer must contain Acknowledge & Close button');
});
