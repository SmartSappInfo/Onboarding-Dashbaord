/**
 * BulkWorkforceService tenant isolation.
 *
 * Person ids and department ids come from the caller. Every bulk action writes people with the
 * caller's organization id and re-projects their profiles, so ids from another organization
 * must never be written.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkWorkforceService } from '../bulk-workforce-service';
import { DEPARTMENT_NOT_IN_ORGANIZATION } from '../department-service';

const h = vi.hoisted(() => ({
  commit: vi.fn(),
  isMemberOfOrganization: vi.fn(),
  updateMembershipStatus: vi.fn(),
  upsertWorkspaceMembership: vi.fn(),
  getPerson: vi.fn(),
  upsertPerson: vi.fn(),
  syncUserProjection: vi.fn(),
  getDepartmentForOrganization: vi.fn(),
  recalculateMemberCount: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: { batch: () => ({ commit: h.commit }) },
}));
vi.mock('@/lib/services/identity/person-service', () => ({
  PersonService: { getPerson: h.getPerson, upsertPerson: h.upsertPerson },
}));
vi.mock('@/lib/services/identity/organization-membership-service', () => ({
  OrganizationMembershipService: {
    isMemberOfOrganization: h.isMemberOfOrganization,
    updateMembershipStatus: h.updateMembershipStatus,
  },
}));
vi.mock('@/lib/services/identity/workspace-membership-service', () => ({
  WorkspaceMembershipService: { upsertWorkspaceMembership: h.upsertWorkspaceMembership },
}));
vi.mock('@/lib/services/identity/identity-projection-service', () => ({
  IdentityProjectionService: { syncUserProjection: h.syncUserProjection },
}));
vi.mock('../department-service', () => ({
  DEPARTMENT_NOT_IN_ORGANIZATION: 'That department does not exist in this organization.',
  DepartmentService: {
    getDepartmentForOrganization: h.getDepartmentForOrganization,
    recalculateMemberCount: h.recalculateMemberCount,
  },
}));

const ORG = 'org_a';

describe('BulkWorkforceService tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.commit.mockResolvedValue(undefined);
    h.isMemberOfOrganization.mockImplementation(async (org: string, personId: string) =>
      org === ORG && personId === 'person-a'
    );
    h.updateMembershipStatus.mockResolvedValue(undefined);
    h.getPerson.mockResolvedValue(null);
    h.upsertPerson.mockResolvedValue(undefined);
    h.syncUserProjection.mockResolvedValue(null);
    h.getDepartmentForOrganization.mockImplementation(async (org: string, id: string) =>
      org === ORG && id === 'dept_a'
        ? { id: 'dept_a', organizationId: ORG, name: 'Sales', code: 'SALE', memberCount: 0, createdAt: '2026-09-30' }
        : null
    );
    h.recalculateMemberCount.mockResolvedValue(1);
  });

  it('skips people who are not members of the organization', async () => {
    const result = await BulkWorkforceService.executeBulkAction({
      organizationId: ORG,
      personIds: ['person-a', 'person-b'],
      action: 'suspend',
    });

    expect(result).toMatchObject({ totalProcessed: 2, succeeded: 1, failed: 1 });
    expect(result.errors).toEqual([{ id: 'person-b', error: 'Not a member of this organization.' }]);
    expect(h.updateMembershipStatus).toHaveBeenCalledTimes(1);
    expect(h.updateMembershipStatus).toHaveBeenCalledWith(ORG, 'person-a', 'suspended', expect.anything());
    expect(h.syncUserProjection).toHaveBeenCalledTimes(1);
    expect(h.syncUserProjection).toHaveBeenCalledWith(ORG, 'person-a');
  });

  it('rejects assigning a department from another organization before writing anything', async () => {
    await expect(
      BulkWorkforceService.executeBulkAction({
        organizationId: ORG,
        personIds: ['person-a'],
        action: 'assign_department',
        payload: { departmentId: 'dept_b', departmentName: 'Finance' },
      })
    ).rejects.toThrow(DEPARTMENT_NOT_IN_ORGANIZATION);

    expect(h.upsertPerson).not.toHaveBeenCalled();
    expect(h.recalculateMemberCount).not.toHaveBeenCalled();
  });

  it('assigns the organization\'s department with its canonical name', async () => {
    const result = await BulkWorkforceService.executeBulkAction({
      organizationId: ORG,
      personIds: ['person-a'],
      action: 'assign_department',
      payload: { departmentId: 'dept_a', departmentName: 'Spoofed Name' },
    });

    expect(result).toMatchObject({ succeeded: 1, failed: 0 });
    expect(h.upsertPerson).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'person-a', organizationId: ORG, departmentId: 'dept_a', departmentName: 'Sales' }),
      expect.anything()
    );
    expect(h.recalculateMemberCount).toHaveBeenCalledWith(ORG, 'dept_a');
  });
});
