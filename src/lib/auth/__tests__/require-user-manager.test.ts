/**
 * require-user-manager: the guard for server actions that manage other users.
 *
 * The session is stubbed with the same organization rule as `requireOrganization` (members of
 * the organization, or system admins), so these tests exercise the permission and target rules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile } from '@/lib/types';
import type { AuthContext } from '../require-auth';
import { canManageUsers, requireUserManager, requireUserManagerForUser } from '../require-user-manager';

const h = vi.hoisted(() => ({
  caller: null as AuthContext | null,
  users: new Map<string, Record<string, unknown>>(),
  requireSystemAdmin: vi.fn(),
}));

vi.mock('../require-auth', async () => {
  const actual = await vi.importActual<typeof import('../require-auth')>('../require-auth');
  return {
    ...actual,
    requireOrganization: vi.fn(async (organizationId: string) => {
      if (!h.caller) throw new actual.UnauthorizedError('Not signed in.');
      if (!h.caller.isSystemAdmin && h.caller.profile.organizationId !== organizationId) {
        throw new actual.ForbiddenError('No access to this organization.');
      }
      return { ...h.caller, organizationId };
    }),
    requireSystemAdmin: h.requireSystemAdmin,
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ id, exists: h.users.has(id), data: () => h.users.get(id) }),
      }),
    }),
  },
}));

const profile = (overrides: Partial<UserProfile>): UserProfile =>
  ({ id: 'u', isAuthorized: true, organizationId: 'org_a', ...overrides }) as UserProfile;

const signIn = (p: UserProfile) => {
  h.caller = { uid: p.id, profile: p, isSystemAdmin: (p.permissions ?? []).includes('system_admin') };
};

const manager = profile({ id: 'manager_a', roles: ['administrator'] });
const member = profile({ id: 'member_a' });
const sysAdmin = profile({ id: 'root', organizationId: 'hq', permissions: ['system_admin'] });

describe('canManageUsers', () => {
  it('accepts every way the app grants user management', () => {
    expect(canManageUsers({ permissions: ['system_admin'] })).toBe(true);
    expect(canManageUsers({ permissions: ['users_manage'] })).toBe(true);
    expect(canManageUsers({ permissions: ['management_users'] })).toBe(true);
    expect(canManageUsers({ roles: ['administrator'] })).toBe(true);
    expect(canManageUsers({ permissionsSchema: { management: { features: { users: { edit: true } } } } })).toBe(true);
    expect(canManageUsers({ permissionsSchema: { management: { features: { users: { create: true } } } } })).toBe(true);
    expect(canManageUsers({ permissions: ['management.users.edit'] })).toBe(true);
    expect(canManageUsers({ permissions: ['management.users.create'] })).toBe(true);
    for (const role of ['admin', 'Administrator', 'ORG_ADMIN', 'super_admin']) {
      expect(canManageUsers({ roles: [role] })).toBe(true);
    }
    expect(canManageUsers(manager)).toBe(true);
  });

  it('refuses ordinary members, including view-only access to users', () => {
    expect(canManageUsers(member)).toBe(false);
    expect(canManageUsers({ roles: ['member'], permissions: ['view_deals'] })).toBe(false);
    expect(canManageUsers({ permissionsSchema: { management: { features: { users: { edit: false } } } } })).toBe(false);
    // Read-only access never grants management (workforce-actions once accepted it: H1).
    expect(canManageUsers({ permissions: ['management.users.view'] })).toBe(false);
    // An approved member with no admin signal: `isAuthorized` alone must not count.
    expect(member.isAuthorized).toBe(true);
    expect(canManageUsers(member)).toBe(false);
  });
});

describe('requireUserManager', () => {
  beforeEach(() => { h.caller = null; });

  it('refuses when nobody is signed in', async () => {
    await expect(requireUserManager('org_a')).rejects.toThrow('Not signed in.');
  });

  it('refuses another organization, and members without the permission', async () => {
    signIn(manager);
    await expect(requireUserManager('org_b')).rejects.toThrow('No access to this organization.');
    signIn(member);
    await expect(requireUserManager('org_a')).rejects.toThrow(/permission to manage users/);
  });

  it('refuses an empty organization id', async () => {
    signIn(manager);
    await expect(requireUserManager('')).rejects.toThrow(/organization is required/);
  });

  it('accepts a user manager of the organization and a system admin', async () => {
    signIn(manager);
    await expect(requireUserManager('org_a')).resolves.toMatchObject({ uid: 'manager_a', organizationId: 'org_a' });
    signIn(sysAdmin);
    await expect(requireUserManager('org_a')).resolves.toMatchObject({ uid: 'root' });
  });
});

describe('requireUserManagerForUser', () => {
  beforeEach(() => {
    h.caller = null;
    h.users.clear();
    h.requireSystemAdmin.mockReset();
    h.users.set('target_a', { isAuthorized: true, organizationId: 'org_a' });
    h.users.set('target_b', { isAuthorized: true, organizationId: 'org_b' });
    h.users.set('root', { isAuthorized: true, organizationId: 'org_a', permissions: ['system_admin'] });
    h.users.set('orphan', { isAuthorized: false });
  });

  it('lets a manager act on a user in their organization', async () => {
    signIn(manager);
    const { target } = await requireUserManagerForUser('target_a');
    expect(target.id).toBe('target_a');
  });

  it('refuses users in another organization and unknown users', async () => {
    signIn(manager);
    await expect(requireUserManagerForUser('target_b')).rejects.toThrow('No access to this organization.');
    await expect(requireUserManagerForUser('nobody')).rejects.toThrow('User not found.');
  });

  it('never lets an organization manager act on a platform system admin', async () => {
    signIn(manager);
    await expect(requireUserManagerForUser('root')).rejects.toThrow(/Only a platform administrator/);
    signIn(sysAdmin);
    await expect(requireUserManagerForUser('root')).resolves.toMatchObject({ target: { id: 'root' } });
  });

  it('requires a system admin for a user with no organization yet', async () => {
    signIn(manager);
    h.requireSystemAdmin.mockRejectedValue(new Error('Platform admin required.'));
    await expect(requireUserManagerForUser('orphan')).rejects.toThrow('Platform admin required.');
    expect(h.requireSystemAdmin).toHaveBeenCalledTimes(1);
  });
});
