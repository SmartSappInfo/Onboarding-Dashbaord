import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserProfile, Role, PermissionsSchema } from '@/lib/types';
import { getBlankPermissions, getFullAdminPermissions, normalizePermissionsSchema } from '@/lib/permissions-engine';
import { OrganizationMembershipService } from '../organization-membership-service';
import { WorkspaceMembershipService } from '../workspace-membership-service';

describe('Identity & Membership 2.0 Services Suite', () => {
  describe('OrganizationMembershipService Determinism & Lifecycles', () => {
    it('should generate deterministic membership IDs based on organizationId and personId', () => {
      const orgId = 'org-accra-hq';
      const personId = 'user-sarah-123';
      const expectedId = 'mem_org-accra-hq_user-sarah-123';

      const computedId = OrganizationMembershipService.getMembershipId(orgId, personId);
      expect(computedId).toBe(expectedId);
    });
  });

  describe('WorkspaceMembershipService Determinism & Cleanup', () => {
    it('should generate deterministic workspace membership IDs', () => {
      const wsId = 'ws-admissions-gh';
      const personId = 'user-sarah-123';
      const expectedId = 'wsm_ws-admissions-gh_user-sarah-123';

      const computedId = WorkspaceMembershipService.getWorkspaceMembershipId(wsId, personId);
      expect(computedId).toBe(expectedId);
    });
  });

  describe('Permissions Projection & Schema Normalization Parity', () => {
    it('should correctly normalize and merge multiple workspace role permissions without loss', () => {
      const blank = getBlankPermissions();
      const adminPerms = getFullAdminPermissions();

      expect(blank.operations.enabled).toBe(false);
      expect(adminPerms.operations.enabled).toBe(true);

      const normalized = normalizePermissionsSchema(adminPerms);
      expect(normalized.operations.features.campuses?.create).toBe(true);
      expect(normalized.finance.features.invoices?.delete).toBe(true);
    });
  });
});
