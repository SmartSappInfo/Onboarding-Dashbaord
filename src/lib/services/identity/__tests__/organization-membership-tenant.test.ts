/**
 * OrganizationMembershipService.isMemberOfOrganization.
 *
 * Server actions that act on another person by id use this to stay inside the caller's
 * organization, so it must be false for people in other organizations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationMembershipService } from '../organization-membership-service';

const store = vi.hoisted(() => ({
  memberships: new Map<string, Record<string, unknown>>(),
  users: new Map<string, Record<string, unknown>>(),
}));

vi.mock('@/lib/firebase-admin', () => {
  const snapshot = (id: string, data: Record<string, unknown> | undefined) => ({
    id,
    exists: Boolean(data),
    data: () => data,
    get: (field: string) => data?.[field],
  });

  return {
    adminDb: {
      collection: (collection: string) => {
        const table =
          collection === 'organization_memberships' ? store.memberships
            : collection === 'users' ? store.users
              : new Map<string, Record<string, unknown>>();

        const query = (filters: Array<[string, unknown]>) => ({
          where: (field: string, _op: string, value: unknown) => query([...filters, [field, value]]),
          limit: () => query(filters),
          get: async () => {
            const docs = [...table.entries()]
              .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
              .map(([id, data]) => snapshot(id, data));
            return { empty: docs.length === 0, docs };
          },
        });

        return { doc: (id: string) => ({ get: async () => snapshot(id, table.get(id)) }), ...query([]) };
      },
    },
  };
});

describe('OrganizationMembershipService.isMemberOfOrganization', () => {
  beforeEach(() => {
    store.memberships.clear();
    store.users.clear();
  });

  it('is true for a person with a membership in the organization', async () => {
    store.memberships.set('mem_org_a_p1', { organizationId: 'org_a', personId: 'p1' });
    await expect(OrganizationMembershipService.isMemberOfOrganization('org_a', 'p1')).resolves.toBe(true);
  });

  it('finds memberships stored under non-standard ids', async () => {
    store.memberships.set('legacy_id', { organizationId: 'org_a', personId: 'p2' });
    await expect(OrganizationMembershipService.isMemberOfOrganization('org_a', 'p2')).resolves.toBe(true);
  });

  it('accepts a legacy profile whose users document names the organization', async () => {
    store.users.set('p3', { organizationId: 'org_a' });
    await expect(OrganizationMembershipService.isMemberOfOrganization('org_a', 'p3')).resolves.toBe(true);
  });

  it('is false for people in another organization', async () => {
    store.memberships.set('mem_org_b_p4', { organizationId: 'org_b', personId: 'p4' });
    store.users.set('p4', { organizationId: 'org_b' });
    await expect(OrganizationMembershipService.isMemberOfOrganization('org_a', 'p4')).resolves.toBe(false);
  });

  it('is false for unknown people and empty ids', async () => {
    await expect(OrganizationMembershipService.isMemberOfOrganization('org_a', 'nobody')).resolves.toBe(false);
    await expect(OrganizationMembershipService.isMemberOfOrganization('', 'p1')).resolves.toBe(false);
    await expect(OrganizationMembershipService.isMemberOfOrganization('org_a', '')).resolves.toBe(false);
  });
});
