import { describe, it, expect } from 'vitest';
import { isUserWorkspaceAdmin } from '../workspace-admin-utils';
import type { UserProfile, PermissionsSchema } from '../types';

describe('isUserWorkspaceAdmin', () => {
  it('returns true if isSuperAdmin is true', () => {
    expect(isUserWorkspaceAdmin(null, 'ws_1', null, true)).toBe(true);
  });

  it('returns true if user has system_admin permission', () => {
    const profile = { permissions: ['system_admin'] } as unknown as UserProfile;
    expect(isUserWorkspaceAdmin(profile, 'ws_1')).toBe(true);
  });

  it('returns true if user has global admin or owner role', () => {
    const adminProfile = { role: 'admin' } as unknown as UserProfile;
    const ownerProfile = { role: 'owner' } as unknown as UserProfile;
    const rolesArrayProfile = { roles: ['admin'] } as unknown as UserProfile;

    expect(isUserWorkspaceAdmin(adminProfile, 'ws_1')).toBe(true);
    expect(isUserWorkspaceAdmin(ownerProfile, 'ws_1')).toBe(true);
    expect(isUserWorkspaceAdmin(rolesArrayProfile, 'ws_1')).toBe(true);
  });

  it('returns true if user has workspace-specific admin role in workspaceRoles', () => {
    const profile = {
      workspaceRoles: {
        ws_1: ['workspace_admin'],
        ws_2: ['member'],
      },
    } as unknown as UserProfile;

    expect(isUserWorkspaceAdmin(profile, 'ws_1')).toBe(true);
    expect(isUserWorkspaceAdmin(profile, 'ws_2')).toBe(false);
  });

  it('returns true if user has management systemSettings edit permission in schema', () => {
    const profile = { role: 'member' } as unknown as UserProfile;
    const schema = {
      management: {
        systemSettings: { edit: true },
      },
    } as unknown as PermissionsSchema;

    expect(isUserWorkspaceAdmin(profile, 'ws_1', schema)).toBe(true);
  });

  it('returns false for standard member without any admin indicators', () => {
    const profile = {
      role: 'member',
      roles: ['member'],
      workspaceRoles: { ws_1: ['member'] },
    } as unknown as UserProfile;

    expect(isUserWorkspaceAdmin(profile, 'ws_1')).toBe(false);
  });
});
