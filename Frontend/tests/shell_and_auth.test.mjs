import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLES } from '../src/data/roles.js';
import { DEMO_USERS, authenticateDemoUser, findUserByEmail } from '../src/data/demoUsers.js';
import { getRoleIconComponent } from '../src/components/RoleIcon.js';
import { SharingService } from '../src/services/sharingService.js';
import { AuditRepository } from '../src/services/auditRepository.js';

test('Global Shell & Auth: Zero emojis in roles and valid iconName tokens', () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

  for (const [key, role] of Object.entries(ROLES)) {
    assert.ok(role.id, `Role ${key} must have an id`);
    assert.ok(role.name, `Role ${key} must have a name`);
    assert.ok(role.clearance, `Role ${key} must have a clearance`);
    assert.ok(role.iconName, `Role ${key} must have an iconName`);
    assert.ok(Array.isArray(role.permissions), `Role ${key} must have permissions array`);

    // Verify zero emojis in role definition values
    for (const [prop, val] of Object.entries(role)) {
      if (typeof val === 'string') {
        assert.equal(emojiRegex.test(val), false, `Role ${key}.${prop} should not contain emojis: ${val}`);
      }
    }
  }
});

test('Global Shell & Auth: RoleIcon mapping resolves valid icon components for all roles', () => {
  const roles = Object.values(ROLES);
  for (const r of roles) {
    const Component = getRoleIconComponent(r);
    assert.ok(Component, `getRoleIconComponent should resolve component for role ${r.id}`);
    assert.ok(
      typeof Component === 'function' || typeof Component === 'object',
      'Component should be valid React component'
    );
  }

  // Fallback for null or unknown role
  const Fallback = getRoleIconComponent(null);
  assert.ok(Fallback, 'Fallback component should exist for null role');
});

test('Global Shell & Auth: Four real credentials authenticate and reject invalid inputs', () => {
  assert.equal(DEMO_USERS.length, 4, 'Must preserve all four institutional accounts');

  const expectedEmails = [
    'investigator@caseguard.gov',
    'officer@caseguard.gov',
    'legal@caseguard.gov',
    'admin@caseguard.gov'
  ];

  for (const email of expectedEmails) {
    const user = findUserByEmail(email);
    assert.ok(user, `User ${email} must exist in DEMO_USERS`);
    assert.ok(user.password, `User ${email} must have a password`);

    // Valid authentication
    const authResult = authenticateDemoUser(email, user.password);
    assert.equal(authResult.success, true, `Authentication should succeed for ${email}`);
    assert.equal(authResult.user.id, user.id);

    // Invalid password authentication
    const failResult = authenticateDemoUser(email, 'incorrect-password-test');
    assert.equal(failResult.success, false, `Authentication should fail with incorrect password for ${email}`);
    assert.ok(failResult.error);
  }

  // Non-existent email authentication
  const unknownResult = authenticateDemoUser('unknown@caseguard.gov', 'password123');
  assert.equal(unknownResult.success, false);
  assert.ok(unknownResult.error);
});

test('Global Shell & Auth: RBAC case access validation across all four real credentials', () => {
  const investigator = findUserByEmail('investigator@caseguard.gov');
  const officer = findUserByEmail('officer@caseguard.gov');
  const legal = findUserByEmail('legal@caseguard.gov');
  const admin = findUserByEmail('admin@caseguard.gov');

  const homicideCase = { caseNumber: 'INV-2026-0189', title: 'Homicide Investigation' };
  const fraudCase = { caseNumber: 'INV-2026-0142', title: 'Financial Fraud' };

  // Investigator has access to both cases
  assert.equal(SharingService.canUserAccessCase(investigator, homicideCase), true);
  assert.equal(SharingService.canUserAccessCase(investigator, fraudCase), true);

  // Officer has access only to homicide case
  assert.equal(SharingService.canUserAccessCase(officer, homicideCase), true);
  assert.equal(SharingService.canUserAccessCase(officer, fraudCase), false);

  // Legal prosecutor has access only to financial fraud, denied access to homicide without share
  assert.equal(SharingService.canUserAccessCase(legal, fraudCase), true);
  assert.equal(SharingService.canUserAccessCase(legal, homicideCase), false);

  // Administrator has wildcard access to all cases
  assert.equal(SharingService.canUserAccessCase(admin, homicideCase), true);
  assert.equal(SharingService.canUserAccessCase(admin, fraudCase), true);
});

test('Global Shell & Auth: Audit trail records authentication and security policy events', async () => {
  const admin = findUserByEmail('admin@caseguard.gov');

  // Verify AuditRepository logs LOGIN event
  const loginEvent = await AuditRepository.logAuditEvent({
    actor: admin,
    role: admin.designation,
    action: 'LOGIN',
    targetType: 'SYSTEM',
    targetId: admin.email,
    caseId: 'PORTAL',
    result: 'SUCCESS',
    details: `Officer "${admin.name}" authenticated with ${admin.clearance} clearance.`
  });

  assert.ok(loginEvent.id);
  assert.equal(loginEvent.action, 'LOGIN');
  assert.equal(loginEvent.result, 'SUCCESS');
  assert.equal(loginEvent.actorName, admin.name);

  // Verify AuditRepository logs UNAUTHORIZED_ACCESS_DENIED policy verification event
  const policyEvent = await AuditRepository.logAuditEvent({
    actor: admin,
    role: admin.designation,
    action: 'UNAUTHORIZED_ACCESS_DENIED',
    targetType: 'DOCUMENT',
    targetId: 'DOC-RESTRICTED',
    caseId: 'INV-2026-0189',
    result: 'DENIED',
    details: 'Access policy verification: simulated unauthorized decryption blocked.'
  });

  assert.ok(policyEvent.id);
  assert.equal(policyEvent.action, 'UNAUTHORIZED_ACCESS_DENIED');
  assert.equal(policyEvent.result, 'DENIED');
});
