import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES } from '../src/data/roles.js';
import { DEMO_USERS } from '../src/data/demoUsers.js';

test('Access Control: All 5 real roles and permissions accurately represented', () => {
  const roles = Object.values(ROLES);
  assert.equal(roles.length, 5, 'Must contain all 5 real system roles');
  
  const expectedRoles = [
    'Investigation Officer',
    'Police Station Officer',
    'Legal Officer',
    'Forensic Analyst',
    'System Administrator'
  ];

  for (const name of expectedRoles) {
    const found = roles.find(r => r.name === name);
    assert.ok(found, `Role ${name} must exist in ROLES`);
    assert.ok(Array.isArray(found.permissions) && found.permissions.length > 0, `Role ${name} must have permissions array`);
    assert.ok(found.clearance, `Role ${name} must have a clearance`);
  }
});

test('Access Control: All 4 real DEMO_USERS exist for account switching', () => {
  assert.equal(DEMO_USERS.length, 4, 'Must preserve all four institutional accounts');

  const emails = DEMO_USERS.map(u => u.email);
  assert.ok(emails.includes('investigator@caseguard.gov'));
  assert.ok(emails.includes('officer@caseguard.gov'));
  assert.ok(emails.includes('legal@caseguard.gov'));
  assert.ok(emails.includes('admin@caseguard.gov'));
});

test('Access Control: Component contracts and code verification', async () => {
  const fs = await import('node:fs');
  const code = fs.readFileSync('src/components/AccessControlView.jsx', 'utf-8');

  // Verify page header
  assert.ok(code.includes('Access Control'), 'Must have page title Access Control');
  assert.ok(code.includes('Manage accounts, roles, clearance, and authorization policies.'), 'Must have requested subtitle');
  assert.ok(!code.includes('Access Control & Identity Governance'), 'Must not use old oversized header title');

  // Verify Current Account section
  assert.ok(code.includes('CURRENT ACCOUNT'), 'Must use CURRENT ACCOUNT label');
  assert.ok(!code.includes('CURRENT SESSION'), 'Must eliminate CURRENT SESSION label');
  assert.ok(code.includes('Change Account'), 'Must have Change Account action');
  assert.ok(code.includes('Sign Out'), 'Must have Sign Out action');

  // Verify System Roles table
  assert.ok(code.includes('SYSTEM ROLES'), 'Must have SYSTEM ROLES section');
  assert.ok(code.includes('Role'), 'Must have Role column');
  assert.ok(code.includes('Clearance'), 'Must have Clearance column');
  assert.ok(code.includes('Permissions'), 'Must have Permissions column');
  assert.ok(code.includes('Status'), 'Must have Status column');

  // Verify Permission Matrix
  assert.ok(code.includes('PERMISSION MATRIX'), 'Must have PERMISSION MATRIX section');
  assert.ok(code.includes('Allowed'), 'Must have Allowed status');
  assert.ok(code.includes('Denied'), 'Must have Denied status');
  assert.ok(code.includes('text-emerald-700'), 'Allowed must use subdued emerald styling');
  assert.ok(code.includes('text-slate-400'), 'Denied must use muted slate styling');

  // Verify Verify Access Policy action
  assert.ok(code.includes('Verify Access Policy'), 'Must have Verify Access Policy button');
  assert.ok(code.includes('ShieldCheck'), 'Must use ShieldCheck icon');

  // Verify zero emojis in AccessControlView
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
  assert.equal(emojiRegex.test(code), false, 'AccessControlView must not contain emojis');
});

test('SidebarNav: Account summary block displays CURRENT ACCOUNT without duplication', async () => {
  const fs = await import('node:fs');
  const sidebarCode = fs.readFileSync('src/components/SidebarNav.jsx', 'utf-8');

  assert.ok(sidebarCode.includes('CURRENT ACCOUNT'), 'Sidebar must use CURRENT ACCOUNT label');
  assert.ok(!sidebarCode.includes('CURRENT SESSION'), 'Sidebar must not use CURRENT SESSION');
  assert.ok(!sidebarCode.includes('Change Account'), 'Sidebar must not duplicate Change Account action');
  assert.ok(!sidebarCode.includes('Sign Out'), 'Sidebar must not duplicate Sign Out action');
});
