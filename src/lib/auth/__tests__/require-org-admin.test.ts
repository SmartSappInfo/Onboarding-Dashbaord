import { describe, it, expect } from 'vitest';
import { canManageOrgIntegrations, isSystemAdmin } from '../require-org-admin';
import type { UserProfile } from '@/lib/types';
import { getFullAdminPermissions, getBlankPermissions } from '@/lib/permissions-engine';

/**
 * Phase 1 — authorization decision for WhatsApp credential management.
 *
 * The async `requireOrgAdmin` verifies the Firebase ID token and loads the
 * profile (I/O); this pure helper holds the *decision* so it is unit-testable
 * without Firebase. Mirrors how `/admin/settings` is gated:
 * management → systemSettings (spec R1, `vercel:server-auth-actions`).
 */

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u1',
    organizationId: 'org_123',
    workspaceIds: ['ws1'],
    name: 'Test',
    email: 't@example.com',
    phone: '',
    isAuthorized: true,
    ...overrides,
  } as UserProfile;
}

describe('canManageOrgIntegrations', () => {
  it('denies when the profile belongs to a different org', () => {
    const p = profile({ permissions: ['system_admin'] });
    expect(canManageOrgIntegrations(p, 'someone_else')).toBe(false);
  });

  it('allows a system_admin within their org', () => {
    const p = profile({ permissions: ['system_admin'] });
    expect(canManageOrgIntegrations(p, 'org_123')).toBe(true);
  });

  it('allows a user with management→systemSettings edit permission', () => {
    const schema = getFullAdminPermissions();
    const p = profile({ permissionsSchema: schema });
    expect(canManageOrgIntegrations(p, 'org_123')).toBe(true);
  });

  it('denies a user with no admin permissions', () => {
    const p = profile({ permissionsSchema: getBlankPermissions(), permissions: [] });
    expect(canManageOrgIntegrations(p, 'org_123')).toBe(false);
  });

  it('denies an unauthorized user even with the right org', () => {
    const p = profile({ permissions: ['system_admin'], isAuthorized: false });
    expect(canManageOrgIntegrations(p, 'org_123')).toBe(false);
  });
});

describe('isSystemAdmin', () => {
  it('is true only for an authorized system_admin (org-agnostic)', () => {
    expect(isSystemAdmin(profile({ permissions: ['system_admin'] }))).toBe(true);
  });
  it('is false without the permission', () => {
    expect(isSystemAdmin(profile({ permissions: [] }))).toBe(false);
  });
  it('is false when unauthorized', () => {
    expect(isSystemAdmin(profile({ permissions: ['system_admin'], isAuthorized: false }))).toBe(false);
  });
});
