import { describe, it, expect } from 'vitest';
import { PermissionRegistryService } from '../permission-registry-service';
import { PolicyEngineService, EvaluationContext } from '../policy-engine-service';
import { getBlankPermissions } from '@/lib/permissions-engine';
import type { PolicyRule, PermissionsSchema } from '@/lib/types';

describe('Authorization 2.0 Canonical Services Suite', () => {
  describe('PermissionRegistryService & DAG Dependency Cascades', () => {
    it('should export all canonical permissions with strictly typed metadata', () => {
      const allPerms = PermissionRegistryService.getAllPermissions();
      expect(allPerms.length).toBeGreaterThanOrEqual(40);

      const deleteCampuses = PermissionRegistryService.getPermissionById('operations.campuses.delete');
      expect(deleteCampuses).toBeDefined();
      expect(deleteCampuses?.riskLevel).toBe('critical');
      expect(deleteCampuses?.dependencies).toContain('operations.campuses.view');
    });

    it('should automatically cascade view: true and section.enabled: true when mutate actions are enabled', () => {
      const rawSchema: PermissionsSchema = {
        ...getBlankPermissions(),
        finance: {
          enabled: false,
          features: {
            invoices: { view: false, delete: true },
          },
        },
      };

      const resolved = PermissionRegistryService.resolveDependencies(rawSchema);

      expect(resolved.finance.enabled).toBe(true);
      expect(resolved.finance.features.invoices?.view).toBe(true);
      expect(resolved.finance.features.invoices?.delete).toBe(true);
    });

    it('should calculate accurate risk metrics across all active permissions', () => {
      const schema: PermissionsSchema = {
        ...getBlankPermissions(),
        operations: {
          enabled: true,
          features: {
            campuses: { view: true, delete: true }, // 1 low (view), 1 critical (delete)
          },
        },
      };

      const metrics = PermissionRegistryService.calculateRiskMetrics(schema);
      expect(metrics.totalActive).toBe(2);
      expect(metrics.riskBreakdown.low).toBe(1);
      expect(metrics.riskBreakdown.critical).toBe(1);
      expect(metrics.capabilitySummary.operations).toBe(2);
    });
  });

  describe('PolicyEngineService ABAC Evaluation & Explicit Deny Priority', () => {
    it('should evaluate matching conditions successfully', () => {
      const context: EvaluationContext = {
        actor: {
          uid: 'user-sarah-123',
          organizationId: 'org-accra-hq',
          workspaceId: 'ws-admissions-gh',
          department: 'Admissions',
        },
        resource: {
          type: 'deal',
          workspaceId: 'ws-admissions-gh',
          department: 'Admissions',
        },
        action: 'operations.pipeline.edit',
      };

      const allowPolicy: PolicyRule = {
        id: 'pol-allow-dept',
        organizationId: 'org-accra-hq',
        name: 'Allow Department Staff',
        effect: 'allow',
        actions: ['operations.pipeline.*'],
        resources: ['deal'],
        conditions: [
          {
            field: 'actor.department',
            operator: 'equals',
            value: 'Admissions',
          },
        ],
        priority: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const result = PolicyEngineService.evaluatePolicies([allowPolicy], context, false);
      expect(result.isAllowed).toBe(true);
      expect(result.matchedPolicies).toContain('pol-allow-dept');
    });

    it('should allow explicit deny to take absolute precedence over allow grants', () => {
      const context: EvaluationContext = {
        actor: {
          uid: 'user-sarah-123',
          organizationId: 'org-accra-hq',
          workspaceId: 'ws-admissions-gh',
        },
        resource: {
          type: 'invoice',
          status: 'locked',
        },
        action: 'finance.invoices.delete',
      };

      const allowPolicy: PolicyRule = {
        id: 'pol-allow-invoices',
        organizationId: 'org-accra-hq',
        name: 'Allow Invoice Managers',
        effect: 'allow',
        actions: ['finance.invoices.*'],
        resources: ['invoice'],
        conditions: [],
        priority: 10,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const denyLockedPolicy: PolicyRule = {
        id: 'pol-deny-locked-invoices',
        organizationId: 'org-accra-hq',
        name: 'Deny Modifying Locked Invoices',
        effect: 'deny',
        actions: ['finance.invoices.delete'],
        resources: ['invoice'],
        conditions: [
          {
            field: 'resource.status',
            operator: 'equals',
            value: 'locked',
          },
        ],
        priority: 100, // Higher priority
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const result = PolicyEngineService.evaluatePolicies(
        [allowPolicy, denyLockedPolicy],
        context,
        true
      );
      expect(result.isAllowed).toBe(false);
      expect(result.matchedPolicies).toContain('pol-deny-locked-invoices');
      expect(result.reasons[0]).toContain('Explicitly denied by policy');
    });
  });
});
