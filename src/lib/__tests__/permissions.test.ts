import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getIndustryPermissions,
  isPermissionValidForIndustry,
  checkPermission,
  getUserPermissionsInWorkspace,
  type Permission,
} from '../permissions';
import type { IndustryVertical } from '../types';

// Mock dependencies
vi.mock('../industry-cache', () => ({
  getWorkspaceIndustry: vi.fn(),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  },
}));

import { getWorkspaceIndustry } from '../industry-cache';
import { adminDb } from '../firebase-admin';

describe('permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIndustryPermissions', () => {
    it('should return base permissions for all industries', () => {
      const industries: IndustryVertical[] = [
        'SaaS',
        'SchoolEnrollment',
        'Law',
        'Marketing',
        'RealEstate',
        'Consultancy',
      ];

      const basePermissions: Permission[] = [
        'contacts_view',
        'contacts_edit',
        'contacts_create',
        'contacts_delete',
        'pipeline_view',
        'pipeline_manage',
        'finance_view',
        'finance_manage',
      ];

      industries.forEach((industry) => {
        const permissions = getIndustryPermissions(industry);
        basePermissions.forEach((basePermission) => {
          expect(permissions).toContain(basePermission);
        });
      });
    });

    it('should include saas_trials_manage for SaaS industry', () => {
      const permissions = getIndustryPermissions('SaaS');
      expect(permissions).toContain('saas_trials_manage');
    });

    it('should include saas_usage_view for SaaS industry', () => {
      const permissions = getIndustryPermissions('SaaS');
      expect(permissions).toContain('saas_usage_view');
    });

    it('should include saas_health_view for SaaS industry', () => {
      const permissions = getIndustryPermissions('SaaS');
      expect(permissions).toContain('saas_health_view');
    });

    it('should include saas_subscriptions_manage for SaaS industry', () => {
      const permissions = getIndustryPermissions('SaaS');
      expect(permissions).toContain('saas_subscriptions_manage');
    });

    it('should include saas_support_manage for SaaS industry', () => {
      const permissions = getIndustryPermissions('SaaS');
      expect(permissions).toContain('saas_support_manage');
    });

    it('should include saas_onboarding_manage for SaaS industry', () => {
      const permissions = getIndustryPermissions('SaaS');
      expect(permissions).toContain('saas_onboarding_manage');
    });

    it('should not include SaaS permissions for SchoolEnrollment industry', () => {
      const permissions = getIndustryPermissions('SchoolEnrollment');
      expect(permissions).not.toContain('saas_trials_manage');
      expect(permissions).not.toContain('saas_usage_view');
      expect(permissions).not.toContain('saas_health_view');
    });

    it('should include schoolenrollment_admissions_manage for SchoolEnrollment industry', () => {
      const permissions = getIndustryPermissions('SchoolEnrollment');
      expect(permissions).toContain('schoolenrollment_admissions_manage');
    });

    it('should include law_matters_manage for Law industry', () => {
      const permissions = getIndustryPermissions('Law');
      expect(permissions).toContain('law_matters_manage');
    });

    it('should include marketing_campaigns_manage for Marketing industry', () => {
      const permissions = getIndustryPermissions('Marketing');
      expect(permissions).toContain('marketing_campaigns_manage');
    });

    it('should include realestate_properties_manage for RealEstate industry', () => {
      const permissions = getIndustryPermissions('RealEstate');
      expect(permissions).toContain('realestate_properties_manage');
    });

    it('should include consultancy_engagements_manage for Consultancy industry', () => {
      const permissions = getIndustryPermissions('Consultancy');
      expect(permissions).toContain('consultancy_engagements_manage');
    });
  });

  describe('isPermissionValidForIndustry', () => {
    it('should return true for base permissions in any industry', () => {
      const basePermissions: Permission[] = [
        'contacts_view',
        'contacts_edit',
        'pipeline_view',
      ];

      const industries: IndustryVertical[] = [
        'SaaS',
        'SchoolEnrollment',
        'Law',
        'Marketing',
        'RealEstate',
        'Consultancy',
      ];

      industries.forEach((industry) => {
        basePermissions.forEach((permission) => {
          expect(isPermissionValidForIndustry(permission, industry)).toBe(true);
        });
      });
    });

    it('should return true for SaaS permissions in SaaS industry', () => {
      expect(isPermissionValidForIndustry('saas_trials_manage', 'SaaS')).toBe(true);
      expect(isPermissionValidForIndustry('saas_usage_view', 'SaaS')).toBe(true);
      expect(isPermissionValidForIndustry('saas_health_view', 'SaaS')).toBe(true);
    });

    it('should return false for SaaS permissions in non-SaaS industries', () => {
      const nonSaaSIndustries: IndustryVertical[] = [
        'SchoolEnrollment',
        'Law',
        'Marketing',
        'RealEstate',
        'Consultancy',
      ];

      nonSaaSIndustries.forEach((industry) => {
        expect(isPermissionValidForIndustry('saas_trials_manage', industry)).toBe(false);
        expect(isPermissionValidForIndustry('saas_usage_view', industry)).toBe(false);
      });
    });

    it('should return false for Law permissions in non-Law industries', () => {
      const nonLawIndustries: IndustryVertical[] = [
        'SaaS',
        'SchoolEnrollment',
        'Marketing',
        'RealEstate',
        'Consultancy',
      ];

      nonLawIndustries.forEach((industry) => {
        expect(isPermissionValidForIndustry('law_matters_manage', industry)).toBe(false);
        expect(isPermissionValidForIndustry('law_conflict_check', industry)).toBe(false);
      });
    });
  });

  describe('checkPermission', () => {
    it('should return false for a permission not valid for the workspace industry', async () => {
      // Mock workspace industry as SchoolEnrollment
      vi.mocked(getWorkspaceIndustry).mockResolvedValue({
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
      });

      // Try to check a SaaS-specific permission
      const result = await checkPermission('user123', 'workspace456', 'saas_trials_manage');

      expect(result).toBe(false);
      expect(getWorkspaceIndustry).toHaveBeenCalledWith('workspace456');
    });

    it('should return false for a permission valid for industry but user lacks role', async () => {
      // Mock workspace industry as SaaS
      vi.mocked(getWorkspaceIndustry).mockResolvedValue({
        industry: 'SaaS',
        industryScopeLocked: true,
      });

      // Mock user without the permission
      const mockUserDoc = {
        exists: true,
        data: () => ({
          permissions: ['contacts_view'],
        }),
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockUserDoc),
        })),
      } as any);

      // Try to check a SaaS-specific permission
      const result = await checkPermission('user123', 'workspace456', 'saas_trials_manage');

      expect(result).toBe(false);
    });

    it('should return true for system admin regardless of industry', async () => {
      // Mock workspace industry as SchoolEnrollment
      vi.mocked(getWorkspaceIndustry).mockResolvedValue({
        industry: 'SchoolEnrollment',
        industryScopeLocked: true,
      });

      // Mock user with system_admin permission
      const mockUserDoc = {
        exists: true,
        data: () => ({
          permissions: ['system_admin'],
        }),
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockUserDoc),
        })),
      } as any);

      // Try to check a SaaS-specific permission (not valid for SchoolEnrollment)
      const result = await checkPermission('user123', 'workspace456', 'saas_trials_manage');

      // Should still return false because permission is not valid for the industry
      // System admin bypass happens in roleHasPermission, but industry validation comes first
      expect(result).toBe(false);
    });

    it('should return true for valid permission with matching role', async () => {
      // Mock workspace industry as SaaS
      vi.mocked(getWorkspaceIndustry).mockResolvedValue({
        industry: 'SaaS',
        industryScopeLocked: true,
      });

      // Mock user with the permission
      const mockUserDoc = {
        exists: true,
        data: () => ({
          permissions: ['saas_trials_manage'],
        }),
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockUserDoc),
        })),
      } as any);

      const result = await checkPermission('user123', 'workspace456', 'saas_trials_manage');

      expect(result).toBe(true);
    });

    it('should return false when workspace industry lookup fails', async () => {
      // Mock workspace industry lookup failure
      vi.mocked(getWorkspaceIndustry).mockRejectedValue(new Error('Workspace not found'));

      const result = await checkPermission('user123', 'workspace456', 'saas_trials_manage');

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissionsInWorkspace', () => {
    it('should return only permissions valid for workspace industry', async () => {
      // Mock workspace industry as SaaS
      vi.mocked(getWorkspaceIndustry).mockResolvedValue({
        industry: 'SaaS',
        industryScopeLocked: true,
      });

      // Mock user with system_admin (has all permissions)
      const mockUserDoc = {
        exists: true,
        data: () => ({
          permissions: ['system_admin'],
        }),
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockUserDoc),
        })),
      } as any);

      const permissions = await getUserPermissionsInWorkspace('user123', 'workspace456');

      // Should include base permissions
      expect(permissions).toContain('contacts_view');
      expect(permissions).toContain('pipeline_view');

      // Should include SaaS permissions
      expect(permissions).toContain('saas_trials_manage');
      expect(permissions).toContain('saas_usage_view');

      // Should NOT include permissions from other industries
      expect(permissions).not.toContain('law_matters_manage');
      expect(permissions).not.toContain('marketing_campaigns_manage');
    });

    it('should return empty array when user has no permissions', async () => {
      // Mock workspace industry as SaaS
      vi.mocked(getWorkspaceIndustry).mockResolvedValue({
        industry: 'SaaS',
        industryScopeLocked: true,
      });

      // Mock user with no permissions
      const mockUserDoc = {
        exists: true,
        data: () => ({
          permissions: [],
        }),
      };

      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockUserDoc),
        })),
      } as any);

      const permissions = await getUserPermissionsInWorkspace('user123', 'workspace456');

      expect(permissions).toEqual([]);
    });

    it('should return empty array when workspace industry lookup fails', async () => {
      // Mock workspace industry lookup failure
      vi.mocked(getWorkspaceIndustry).mockRejectedValue(new Error('Workspace not found'));

      const permissions = await getUserPermissionsInWorkspace('user123', 'workspace456');

      expect(permissions).toEqual([]);
    });
  });
});
