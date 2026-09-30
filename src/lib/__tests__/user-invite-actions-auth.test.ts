/**
 * user-invite-actions: authorization.
 *
 * These server actions used to run for anyone. inviteUserAction created approved users in any
 * organization with caller-chosen roles; adminResetUserPasswordAction returned a new password for
 * any user id; adminUpdateUserAccessAction toggled any account; remove/decline trusted a
 * caller-supplied "admin user id". Each now requires a signed-in user manager (see
 * require-user-manager.ts). These tests stub that guard and assert that a refusal stops the
 * action before any side effect, and that the invite stays inside the organization.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  inviteUserAction,
  adminResetUserPasswordAction,
  adminUpdateUserAccessAction,
  declineJoinRequestAction,
  removeUserFromOrgAction,
} from '../user-invite-actions';

interface Session { uid: string; isSystemAdmin: boolean; organizationId: string }

const h = vi.hoisted(() => ({
  session: null as Session | null,
  docs: new Map<string, Record<string, unknown>>(),
  writes: [] as Array<{ op: string; path: string }>,
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  createInvitation: vi.fn(),
  requireUserManagerForUser: vi.fn(),
}));

vi.mock('@/lib/auth/require-user-manager', () => ({
  requireUserManager: vi.fn(async (organizationId: string) => {
    if (!h.session) throw new Error('Not signed in.');
    if (!h.session.isSystemAdmin && h.session.organizationId !== organizationId) {
      throw new Error('No access to this organization.');
    }
    return { uid: h.session.uid, isSystemAdmin: h.session.isSystemAdmin, organizationId, profile: {} };
  }),
  requireUserManagerForUser: h.requireUserManagerForUser,
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    createUser: h.createUser,
    getUserByEmail: h.getUserByEmail,
    updateUser: h.updateUser,
    revokeRefreshTokens: h.revokeRefreshTokens,
  }),
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (col: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = h.docs.get(`${col}/${id}`);
          return { id, exists: Boolean(data), data: () => data };
        },
        set: async () => { h.writes.push({ op: 'set', path: `${col}/${id}` }); },
        update: async () => { h.writes.push({ op: 'update', path: `${col}/${id}` }); },
      }),
    }),
  },
}));
vi.mock('@/lib/services/workforce/invitation-lifecycle-service', () => ({
  InvitationLifecycleService: { createInvitation: h.createInvitation },
}));
vi.mock('@/lib/services/workforce/invitation-dispatch-service', () => ({
  InvitationDispatchService: {
    dispatchUserCredentials: vi.fn(async () => ({ success: true, channels: {}, warnings: [] })),
    dispatchPasswordReset: vi.fn(async () => ({ channels: {}, warnings: [] })),
  },
}));
vi.mock('@/lib/services/identity/identity-migration-service', () => ({
  IdentityMigrationService: { getOrMigratePerson: vi.fn(async () => ({ id: 'person' })) },
}));
vi.mock('@/lib/services/crypto/invite-crypto-service', () => ({
  InviteCryptoService: { encryptInvitePayload: vi.fn(() => 'encrypted-token') },
}));
vi.mock('@/lib/resend-service', () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock('@/lib/mnotify-service', () => ({ sendSms: vi.fn(async () => undefined) }));
vi.mock('@/lib/template-resolver', () => ({
  resolveAndRender: vi.fn(async () => { throw new Error('no template'); }),
}));
vi.mock('@/lib/utils/url-helpers', () => ({ getBaseUrl: () => 'https://example.test' }));

const MANAGER_A: Session = { uid: 'manager_a', isSystemAdmin: false, organizationId: 'org_a' };
const ROOT: Session = { uid: 'root', isSystemAdmin: true, organizationId: 'hq' };

const invite = (overrides: Partial<Parameters<typeof inviteUserAction>[0]> = {}) =>
  inviteUserAction({
    fullName: 'New Hire',
    email: 'new@example.com',
    workspaceIds: ['ws_a'],
    workspaceRoles: { ws_a: ['role_a'] },
    organizationId: 'org_a',
    sendMethods: ['email'],
    ...overrides,
  });

describe('user-invite-actions authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.session = null;
    h.writes.length = 0;
    h.docs.clear();
    h.docs.set('organizations/org_a', { name: 'Org A' });
    h.docs.set('workspaces/ws_a', { organizationId: 'org_a' });
    h.docs.set('workspaces/ws_b', { organizationId: 'org_b' });
    h.docs.set('roles/role_a', { organizationId: 'org_a', permissions: ['view_deals'] });
    h.docs.set('roles/role_b', { organizationId: 'org_b', permissions: [] });
    h.docs.set('roles/role_root', { organizationId: 'org_a', permissions: ['system_admin'] });
    h.docs.set('users/target_a', { organizationId: 'org_a', name: 'Target', email: 't@example.com', workspaceIds: ['ws_a'] });

    h.getUserByEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    h.createUser.mockResolvedValue({ uid: 'new_user' });
    h.updateUser.mockResolvedValue(undefined);
    h.revokeRefreshTokens.mockResolvedValue(undefined);
    h.createInvitation.mockResolvedValue({ invitation: { id: 'inv_1' } });
    h.requireUserManagerForUser.mockImplementation(async (userId: string) => {
      if (!h.session) throw new Error('Not signed in.');
      return { caller: { uid: h.session.uid, isSystemAdmin: h.session.isSystemAdmin, profile: {} }, target: { id: userId } };
    });
  });

  it('refuses every user-admin action without a signed-in user manager, before any side effect', async () => {
    const results = [
      await invite(),
      await adminResetUserPasswordAction('target_a'),
      await adminUpdateUserAccessAction('target_a', true),
      await declineJoinRequestAction('target_a'),
      await removeUserFromOrgAction('target_a'),
    ];

    for (const result of results) {
      expect(result).toMatchObject({ success: false, error: 'Not signed in.' });
    }
    expect(h.createUser).not.toHaveBeenCalled();
    expect(h.updateUser).not.toHaveBeenCalled();
    expect(h.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(h.writes).toEqual([]);
  });

  it('does not return a temporary password to an unauthorized caller', async () => {
    const result = await adminResetUserPasswordAction({ userId: 'target_a' });
    expect(result.success).toBe(false);
    expect(result.tempPassword).toBeUndefined();
  });

  it('refuses to invite into another organization', async () => {
    h.session = MANAGER_A;
    const result = await invite({ organizationId: 'org_b', workspaceIds: ['ws_b'], workspaceRoles: { ws_b: [] } });

    expect(result).toMatchObject({ success: false, error: 'No access to this organization.' });
    expect(h.createUser).not.toHaveBeenCalled();
  });

  it('refuses workspaces or roles that belong to another organization', async () => {
    h.session = MANAGER_A;

    const foreignWorkspace = await invite({ workspaceIds: ['ws_a', 'ws_b'], workspaceRoles: { ws_a: ['role_a'] } });
    expect(foreignWorkspace.success).toBe(false);
    expect(foreignWorkspace.error).toMatch(/every workspace must belong/);

    const foreignRole = await invite({ workspaceRoles: { ws_a: ['role_b'] } });
    expect(foreignRole.success).toBe(false);
    expect(foreignRole.error).toMatch(/every role must belong/);

    expect(h.createUser).not.toHaveBeenCalled();
  });

  it('lets only a platform administrator grant a role that carries system_admin', async () => {
    h.session = MANAGER_A;
    const byManager = await invite({ workspaceRoles: { ws_a: ['role_root'] } });
    expect(byManager.success).toBe(false);
    expect(byManager.error).toMatch(/only a platform administrator/);
    expect(h.createUser).not.toHaveBeenCalled();

    h.session = ROOT;
    const byRoot = await invite({ workspaceRoles: { ws_a: ['role_root'] } });
    expect(byRoot.success).toBe(true);
  });

  it('invites within the organization and records the signed-in manager as the inviter', async () => {
    h.session = MANAGER_A;
    const result = await invite();

    expect(result.success).toBe(true);
    expect(h.createUser).toHaveBeenCalledTimes(1);
    expect(h.createInvitation).toHaveBeenCalledWith('org_a', expect.objectContaining({ invitedBy: 'manager_a' }));
  });

  it('identifies the acting admin from the session when removing a user', async () => {
    h.session = MANAGER_A;
    const result = await removeUserFromOrgAction('target_a');

    expect(result.success).toBe(true);
    expect(h.requireUserManagerForUser).toHaveBeenCalledWith('target_a');
    expect(h.writes).toContainEqual({ op: 'update', path: 'users/target_a' });
  });
});
