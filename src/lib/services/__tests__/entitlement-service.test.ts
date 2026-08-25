import { describe, it, expect } from 'vitest';
import { EntitlementService } from '../entitlement-service';
import type { AccessGrant } from '@/lib/types/membership';

describe('EntitlementService', () => {
  describe('Grant Validity Checks', () => {
    it('returns true for grants without an expiration timestamp (lifetime)', () => {
      const grant: AccessGrant = {
        id: 'grant-1',
        organizationId: 'org-1',
        portalId: 'portal-1',
        membershipId: 'mem-1',
        userId: 'user-1',
        grantType: 'manual_admin_grant',
        resourceType: 'course',
        resourceId: 'course-101',
        grantedAt: new Date().toISOString(),
        grantedBy: 'admin',
        createdAt: new Date().toISOString(),
      };

      expect(EntitlementService.isGrantValid(grant)).toBe(true);
    });

    it('returns true for future expiration timestamps', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const grant: AccessGrant = {
        id: 'grant-2',
        organizationId: 'org-1',
        portalId: 'portal-1',
        membershipId: 'mem-1',
        userId: 'user-1',
        grantType: 'membership_plan',
        resourceType: 'course',
        resourceId: 'course-102',
        grantedAt: new Date().toISOString(),
        expiresAt: futureDate.toISOString(),
        grantedBy: 'admin',
        createdAt: new Date().toISOString(),
      };

      expect(EntitlementService.isGrantValid(grant)).toBe(true);
    });

    it('returns false for past expiration timestamps', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const grant: AccessGrant = {
        id: 'grant-3',
        organizationId: 'org-1',
        portalId: 'portal-1',
        membershipId: 'mem-1',
        userId: 'user-1',
        grantType: 'membership_plan',
        resourceType: 'course',
        resourceId: 'course-103',
        grantedAt: new Date().toISOString(),
        expiresAt: pastDate.toISOString(),
        grantedBy: 'admin',
        createdAt: new Date().toISOString(),
      };

      expect(EntitlementService.isGrantValid(grant)).toBe(false);
    });
  });

  describe('Admin Bypass Evaluation', () => {
    it('returns hasAccess: true and reason: admin_bypass when isOrgAdmin is true', async () => {
      const result = await EntitlementService.evaluateEntitlement(
        'portal-1',
        'admin-user',
        'course',
        'protected-course-id',
        true // isOrgAdmin
      );

      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBe('admin_bypass');
    });

    it('returns hasAccess: false and reason: no_entitlement for unauthenticated visitors', async () => {
      const result = await EntitlementService.evaluateEntitlement(
        'portal-1',
        null, // visitor
        'course',
        'protected-course-id',
        false
      );

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('no_entitlement');
    });
  });
});
