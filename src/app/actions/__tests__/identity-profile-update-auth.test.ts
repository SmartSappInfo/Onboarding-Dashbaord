/**
 * updatePersonProfileAction: tenant and department safety.
 *
 * verifyCallerContext proves who the CALLER is and that they belong to `organizationId`. These
 * tests cover what it does not: the person being edited must be in that organization too, and a
 * department id or name from the request must stay inside it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePersonProfileAction } from '../identity-actions';
import { DEPARTMENT_NOT_IN_ORGANIZATION } from '@/lib/services/workforce/department-service';

const h = vi.hoisted(() => ({
  profiles: new Map<string, Record<string, unknown>>(),
  isMemberOfOrganization: vi.fn(),
  getPerson: vi.fn(),
  updatePerson: vi.fn(),
  syncUserProjection: vi.fn(),
  getDepartmentForOrganization: vi.fn(),
  findDepartmentByName: vi.fn(),
  findOrCreateDepartmentByName: vi.fn(),
  recalculateMemberCount: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', () => ({
  // The test passes the caller's uid as the ID token.
  adminAuth: { verifyIdToken: vi.fn(async (token: string) => ({ uid: token, email: `${token}@example.com` })) },
  adminDb: {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = collection === 'users' ? h.profiles.get(id) : undefined;
          return { id, exists: Boolean(data), data: () => data };
        },
      }),
    }),
  },
}));
vi.mock('@/lib/services/identity/person-service', () => ({
  PersonService: { getPerson: h.getPerson, updatePerson: h.updatePerson },
}));
vi.mock('@/lib/services/identity/organization-membership-service', () => ({
  OrganizationMembershipService: { isMemberOfOrganization: h.isMemberOfOrganization },
}));
vi.mock('@/lib/services/identity/identity-projection-service', () => ({
  IdentityProjectionService: { syncUserProjection: h.syncUserProjection },
}));
vi.mock('@/lib/services/workforce/department-service', () => ({
  DEPARTMENT_NOT_IN_ORGANIZATION: 'That department does not exist in this organization.',
  DepartmentService: {
    getDepartmentForOrganization: h.getDepartmentForOrganization,
    findDepartmentByName: h.findDepartmentByName,
    findOrCreateDepartmentByName: h.findOrCreateDepartmentByName,
    recalculateMemberCount: h.recalculateMemberCount,
  },
}));
// Not used by this action; stubbed so importing identity-actions has no side effects.
vi.mock('@/lib/services/identity/identity-account-service', () => ({ IdentityAccountService: {} }));
vi.mock('@/lib/services/identity/workspace-membership-service', () => ({ WorkspaceMembershipService: {} }));
vi.mock('@/lib/services/identity/identity-migration-service', () => ({ IdentityMigrationService: {} }));
vi.mock('@/lib/resend-service', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/mnotify-service', () => ({ sendSms: vi.fn() }));
vi.mock('@/lib/template-resolver', () => ({ resolveAndRender: vi.fn() }));
vi.mock('@/lib/utils/url-helpers', () => ({ getBaseUrl: vi.fn(() => 'https://example.test') }));

const ORG = 'org_a';
const SALES = { id: 'dept_a', organizationId: ORG, name: 'Sales', code: 'SALE', memberCount: 0, createdAt: '2026-09-30' };

const update = (caller: string, personId: string, updates: Record<string, string>) =>
  updatePersonProfileAction({ idToken: caller, organizationId: ORG, personId, updates });

describe('updatePersonProfileAction tenant and department safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.profiles.clear();
    h.profiles.set('manager-a', { isAuthorized: true, organizationId: ORG, permissions: ['users_manage'] });
    h.profiles.set('member-a', { isAuthorized: true, organizationId: ORG, permissions: [] });

    h.isMemberOfOrganization.mockImplementation(async (org: string, personId: string) =>
      org === ORG && ['member-a', 'person-a'].includes(personId)
    );
    h.getPerson.mockResolvedValue({ id: 'person-a', departmentId: 'dept_old' });
    h.updatePerson.mockResolvedValue(undefined);
    h.syncUserProjection.mockImplementation(async (_org: string, personId: string) => ({ id: personId }));
    h.getDepartmentForOrganization.mockImplementation(async (org: string, id: string) =>
      org === ORG && id === 'dept_a' ? SALES : null
    );
    h.findDepartmentByName.mockImplementation(async (org: string, name: string) =>
      org === ORG && name.toLowerCase() === 'sales' ? SALES : null
    );
    h.findOrCreateDepartmentByName.mockImplementation(async (org: string, name: string) => ({
      ...SALES, id: 'dept_new', organizationId: org, name,
    }));
    h.recalculateMemberCount.mockResolvedValue(1);
  });

  it('refuses to edit a person outside the caller\'s organization', async () => {
    const result = await update('manager-a', 'person-b', { displayName: 'Hijacked' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a member of your organization/);
    expect(h.updatePerson).not.toHaveBeenCalled();
    expect(h.syncUserProjection).not.toHaveBeenCalled();
  });

  it('lets a user manager edit a member of their organization', async () => {
    const result = await update('manager-a', 'person-a', { displayName: 'New Name' });

    expect(result.success).toBe(true);
    expect(h.updatePerson).toHaveBeenCalledWith('person-a', { displayName: 'New Name' });
  });

  it('rejects a department id from another organization', async () => {
    const result = await update('manager-a', 'person-a', { departmentId: 'dept_b', departmentName: 'Finance' });

    expect(result).toMatchObject({ success: false, error: DEPARTMENT_NOT_IN_ORGANIZATION });
    expect(h.updatePerson).not.toHaveBeenCalled();
    expect(h.recalculateMemberCount).not.toHaveBeenCalled();
  });

  it('writes the canonical name for a valid department id', async () => {
    await update('manager-a', 'person-a', { departmentId: 'dept_a', departmentName: 'Anything' });

    expect(h.updatePerson).toHaveBeenCalledWith('person-a', { departmentId: 'dept_a', departmentName: 'Sales' });
  });

  it('does not let a regular member create a department by typing a new name', async () => {
    const result = await update('member-a', 'member-a', { departmentName: 'Brand New Team' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Only administrators can add new departments/);
    expect(h.findOrCreateDepartmentByName).not.toHaveBeenCalled();
    expect(h.updatePerson).not.toHaveBeenCalled();
  });

  it('links an existing department by name for a regular member', async () => {
    const result = await update('member-a', 'member-a', { departmentName: 'sales' });

    expect(result.success).toBe(true);
    expect(h.updatePerson).toHaveBeenCalledWith('member-a', { departmentId: 'dept_a', departmentName: 'Sales' });
  });

  it('lets a user manager create a department by name', async () => {
    await update('manager-a', 'person-a', { departmentName: 'Brand New Team' });

    expect(h.findOrCreateDepartmentByName).toHaveBeenCalledWith(ORG, 'Brand New Team');
    expect(h.updatePerson).toHaveBeenCalledWith('person-a', { departmentId: 'dept_new', departmentName: 'Brand New Team' });
  });

  it('refreshes member counts for the department joined and the one left', async () => {
    await update('manager-a', 'person-a', { departmentId: 'dept_a' });

    expect(h.recalculateMemberCount).toHaveBeenCalledWith(ORG, 'dept_a');
    expect(h.recalculateMemberCount).toHaveBeenCalledWith(ORG, 'dept_old');
    expect(h.recalculateMemberCount).toHaveBeenCalledTimes(2);
  });
});
