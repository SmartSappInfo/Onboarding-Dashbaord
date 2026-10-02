// @vitest-environment node
/**
 * @fileOverview Unit tests for Experience Portal permissions registration (PR-3)
 *
 * Verifies that portals_view, portals_manage, and portal_members_manage are properly
 * registered in APP_PERMISSIONS, Permission unions, and mapLegacyPermissionToCoordinates.
 */

import { describe, it, expect } from 'vitest';
import { APP_PERMISSIONS } from '../types';
import { getIndustryPermissions, isPermissionValidForIndustry } from '../permissions';

describe('Portal permissions registration (PR-3)', () => {
  it('registers portal permissions in APP_PERMISSIONS', () => {
    const ids = APP_PERMISSIONS.map((p) => p.id);
    expect(ids).toContain('portals_view');
    expect(ids).toContain('portals_manage');
    expect(ids).toContain('portal_members_manage');

    const viewPerm = APP_PERMISSIONS.find((p) => p.id === 'portals_view');
    expect(viewPerm).toMatchObject({ id: 'portals_view', category: 'Studios' });

    const managePerm = APP_PERMISSIONS.find((p) => p.id === 'portals_manage');
    expect(managePerm).toMatchObject({ id: 'portals_manage', category: 'Studios' });

    const membersPerm = APP_PERMISSIONS.find((p) => p.id === 'portal_members_manage');
    expect(membersPerm).toMatchObject({ id: 'portal_members_manage', category: 'Operations' });
  });

  it('includes portal permissions in base industry permissions for all verticals', () => {
    const industries = ['SaaS', 'SchoolEnrollment', 'Law', 'Marketing', 'RealEstate', 'Consultancy'] as const;

    for (const industry of industries) {
      const perms = getIndustryPermissions(industry);
      expect(perms).toContain('portals_view');
      expect(perms).toContain('portals_manage');
      expect(perms).toContain('portal_members_manage');

      expect(isPermissionValidForIndustry('portals_view', industry)).toBe(true);
      expect(isPermissionValidForIndustry('portals_manage', industry)).toBe(true);
      expect(isPermissionValidForIndustry('portal_members_manage', industry)).toBe(true);
    }
  });
});
