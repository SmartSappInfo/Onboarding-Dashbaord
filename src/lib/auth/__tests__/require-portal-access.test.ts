// @vitest-environment node
/**
 * @fileOverview Portal auth guard tests (auth hotfix, agents_mcp Phase 1 §1.1a).
 * Staff: session + same organization. Members: verified ID token + active membership (or staff).
 * Records: must belong to the portal being acted on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  session: null as null | {
    uid: string;
    isSystemAdmin: boolean;
    profile: {
      organizationId?: string;
      permissions?: string[];
      role?: string;
      roles?: string[];
      roleNames?: string[];
    };
  },
  tokens: new Map<string, { uid: string; email?: string }>(),
  portals: new Map<string, { id: string; organizationId: string }>(),
  memberships: new Map<string, { status: string }>(),
  docs: new Map<string, Record<string, unknown>>(),
}));

vi.mock('@/lib/auth/require-auth', () => {
  class UnauthorizedError extends Error {}
  class ForbiddenError extends Error {}
  return {
    UnauthorizedError,
    ForbiddenError,
    requireAuth: vi.fn(async () => {
      if (!h.session) throw new UnauthorizedError('Not signed in.');
      return h.session;
    }),
    requireOrganization: vi.fn(async (orgId: string) => {
      if (!h.session) throw new UnauthorizedError('Not signed in.');
      if (!h.session.isSystemAdmin && h.session.profile.organizationId !== orgId) throw new ForbiddenError('No access to this organization.');
      return { ...h.session, organizationId: orgId };
    }),
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(async (token: string) => {
      const t = h.tokens.get(token);
      if (!t) throw new Error('invalid token');
      return t;
    }),
  },
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = h.docs.get(`${name}/${id}`);
          return { exists: data !== undefined, data: () => data };
        },
      }),
    }),
  },
}));

vi.mock('@/lib/services/portal-service', () => ({
  PortalService: { getPortalById: vi.fn(async (id: string) => h.portals.get(id) ?? null) },
}));
vi.mock('@/lib/services/portal-membership-service', () => ({
  PortalMembershipService: {
    getMembership: vi.fn(async (portalId: string, uid: string) => h.memberships.get(`${portalId}:${uid}`) ?? null),
  },
}));

import {
  assertRecordInPortal,
  isPortalAdminCaller,
  portalIdOfRecord,
  requirePortalAdmin,
  requirePortalMember,
  requirePortalOrganizationAdmin,
  requirePortalUser,
} from '@/lib/auth/require-portal-access';

beforeEach(() => {
  h.session = null;
  h.tokens.clear();
  h.portals.clear();
  h.memberships.clear();
  h.docs.clear();
  h.portals.set('p1', { id: 'p1', organizationId: 'org-1' });
});

describe('requirePortalAdmin', () => {
  it('refuses anonymous callers', async () => {
    await expect(requirePortalAdmin('p1')).rejects.toThrow('Not signed in.');
  });

  it('refuses staff of another organization', async () => {
    h.session = { uid: 'u2', isSystemAdmin: false, profile: { organizationId: 'org-2' } };
    await expect(requirePortalAdmin('p1')).rejects.toThrow('No access to this portal.');
  });

  it('allows staff of the portal organization and system admins', async () => {
    h.session = { uid: 'u1', isSystemAdmin: false, profile: { organizationId: 'org-1' } };
    await expect(requirePortalAdmin('p1')).resolves.toMatchObject({ auth: { uid: 'u1' }, portal: { id: 'p1' } });
    h.session = { uid: 'root', isSystemAdmin: true, profile: {} };
    await expect(requirePortalAdmin('p1')).resolves.toMatchObject({ auth: { uid: 'root' } });
  });

  it('refuses unknown portals', async () => {
    h.session = { uid: 'u1', isSystemAdmin: false, profile: { organizationId: 'org-1' } };
    await expect(requirePortalAdmin('missing')).rejects.toThrow('Portal not found.');
  });

  describe('granular portal permissions (PR-3)', () => {
    it('enforces view vs manage vs members permissions for staff', async () => {
      // User with view only
      h.session = {
        uid: 'u-view',
        isSystemAdmin: false,
        profile: { organizationId: 'org-1', permissions: ['portals_view'] },
      };
      await expect(requirePortalAdmin('p1', 'view')).resolves.toMatchObject({ portal: { id: 'p1' } });
      await expect(requirePortalAdmin('p1', 'manage')).rejects.toThrow(/Insufficient permissions/);
      await expect(requirePortalAdmin('p1', 'members')).rejects.toThrow(/Insufficient permissions/);

      // User with members only
      h.session = {
        uid: 'u-members',
        isSystemAdmin: false,
        profile: { organizationId: 'org-1', permissions: ['portal_members_manage'] },
      };
      await expect(requirePortalAdmin('p1', 'members')).resolves.toMatchObject({ portal: { id: 'p1' } });
      await expect(requirePortalAdmin('p1', 'manage')).rejects.toThrow(/Insufficient permissions/);

      // User with manage (grants view, manage, and members)
      h.session = {
        uid: 'u-manage',
        isSystemAdmin: false,
        profile: { organizationId: 'org-1', permissions: ['portals_manage'] },
      };
      await expect(requirePortalAdmin('p1', 'view')).resolves.toMatchObject({ portal: { id: 'p1' } });
      await expect(requirePortalAdmin('p1', 'manage')).resolves.toMatchObject({ portal: { id: 'p1' } });
      await expect(requirePortalAdmin('p1', 'members')).resolves.toMatchObject({ portal: { id: 'p1' } });

      // User with no portal permissions
      h.session = {
        uid: 'u-none',
        isSystemAdmin: false,
        profile: { organizationId: 'org-1', permissions: ['contacts_view'] },
      };
      await expect(requirePortalAdmin('p1', 'view')).rejects.toThrow(/Insufficient permissions/);
      await expect(requirePortalAdmin('p1', 'manage')).rejects.toThrow(/Insufficient permissions/);
    });

    it('allows admin role or system admin regardless of explicit permissions', async () => {
      h.session = {
        uid: 'admin-1',
        isSystemAdmin: false,
        profile: { organizationId: 'org-1', role: 'admin', permissions: [] },
      };
      await expect(requirePortalAdmin('p1', 'manage')).resolves.toMatchObject({ portal: { id: 'p1' } });

      h.session = {
        uid: 'sysadmin',
        isSystemAdmin: true,
        profile: { organizationId: 'other-org', permissions: [] },
      };
      await expect(requirePortalAdmin('p1', 'manage')).resolves.toMatchObject({ portal: { id: 'p1' } });
    });

    it('enforces permissions in requirePortalOrganizationAdmin', async () => {
      h.session = {
        uid: 'u-view',
        isSystemAdmin: false,
        profile: { organizationId: 'org-1', permissions: ['portals_view'] },
      };
      await expect(requirePortalOrganizationAdmin('org-1', 'view')).resolves.toMatchObject({ uid: 'u-view' });
      await expect(requirePortalOrganizationAdmin('org-1', 'manage')).rejects.toThrow(/Insufficient permissions/);
    });
  });
});

describe('requirePortalUser / requirePortalMember', () => {
  it('rejects missing or invalid tokens', async () => {
    await expect(requirePortalUser('')).rejects.toThrow('Not signed in.');
    await expect(requirePortalUser('forged')).rejects.toThrow(/expired or invalid/);
  });

  it('takes identity from the token', async () => {
    h.tokens.set('t1', { uid: 'learner-1', email: 'a@x.com' });
    await expect(requirePortalUser('t1')).resolves.toEqual({ uid: 'learner-1', email: 'a@x.com' });
  });

  it('admits active members and refuses suspended or non-members', async () => {
    h.tokens.set('t1', { uid: 'learner-1' });
    h.memberships.set('p1:learner-1', { status: 'active' });
    await expect(requirePortalMember('t1', 'p1')).resolves.toMatchObject({ uid: 'learner-1', isPortalStaff: false });

    h.memberships.set('p1:learner-1', { status: 'suspended' });
    await expect(requirePortalMember('t1', 'p1')).rejects.toThrow('Membership is suspended.');

    h.memberships.clear();
    await expect(requirePortalMember('t1', 'p1')).rejects.toThrow('Not a member of this portal.');
  });

  it('admits approved staff of the portal organization as staff', async () => {
    h.tokens.set('t2', { uid: 'staff-1' });
    h.docs.set('users/staff-1', { isAuthorized: true, organizationId: 'org-1' });
    await expect(requirePortalMember('t2', 'p1')).resolves.toMatchObject({ uid: 'staff-1', isPortalStaff: true });

    h.docs.set('users/staff-1', { isAuthorized: false, organizationId: 'org-1' });
    await expect(requirePortalMember('t2', 'p1')).rejects.toThrow('Not a member of this portal.');
  });
});

describe('assertRecordInPortal', () => {
  it('refuses records of another portal or missing records', async () => {
    h.docs.set('portal_memberships/m1', { portalId: 'p1' });
    h.docs.set('portal_memberships/m2', { portalId: 'p-other' });
    await expect(assertRecordInPortal('portal_memberships', 'm1', 'p1')).resolves.toBeUndefined();
    await expect(assertRecordInPortal('portal_memberships', 'm2', 'p1')).rejects.toThrow('Record not found in this portal.');
    await expect(assertRecordInPortal('portal_memberships', 'nope', 'p1')).rejects.toThrow('Record not found in this portal.');
  });
});

describe('isPortalAdminCaller / portalIdOfRecord', () => {
  it('reports staff without throwing', async () => {
    await expect(isPortalAdminCaller('p1')).resolves.toBe(false);
    h.session = { uid: 'u1', isSystemAdmin: false, profile: { organizationId: 'org-1' } };
    await expect(isPortalAdminCaller('p1')).resolves.toBe(true);
  });

  it('resolves the owning portal of a record and refuses unknown records', async () => {
    h.docs.set('course_cohorts/c1', { portalId: 'p1' });
    await expect(portalIdOfRecord('course_cohorts', 'c1')).resolves.toBe('p1');
    await expect(portalIdOfRecord('course_cohorts', 'missing')).rejects.toThrow('Record not found.');
  });
});
