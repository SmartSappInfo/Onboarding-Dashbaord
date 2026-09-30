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

    it('should cover all 6 platform sections and all missing tools in the canonical catalog', () => {
      const allPerms = PermissionRegistryService.getAllPermissions();
      const sections = new Set(allPerms.map((p) => p.section));

      expect(sections.has('operations')).toBe(true);
      expect(sections.has('finance')).toBe(true);
      expect(sections.has('studios')).toBe(true);
      expect(sections.has('social')).toBe(true);
      expect(sections.has('workforce')).toBe(true);
      expect(sections.has('management')).toBe(true);

      // Studios completeness
      const studioFeatures = new Set(
        PermissionRegistryService.getPermissionsBySection('studios').map((p) => p.feature)
      );
      expect(studioFeatures.has('landingPages')).toBe(true);
      expect(studioFeatures.has('flipbooks')).toBe(true);
      expect(studioFeatures.has('thumbnails')).toBe(true);
      expect(studioFeatures.has('surveys')).toBe(true);
      expect(studioFeatures.has('docSigning')).toBe(true);

      // Operations completeness
      const opsFeatures = new Set(
        PermissionRegistryService.getPermissionsBySection('operations').map((p) => p.feature)
      );
      expect(opsFeatures.has('leadIntelligence')).toBe(true);
      expect(opsFeatures.has('salesEffort')).toBe(true);
      expect(opsFeatures.has('knowledgeGraph')).toBe(true);

      // Social Hub completeness
      const socialFeatures = new Set(
        PermissionRegistryService.getPermissionsBySection('social').map((p) => p.feature)
      );
      expect(socialFeatures.has('dashboard')).toBe(true);
      expect(socialFeatures.has('composer')).toBe(true);
      expect(socialFeatures.has('calendar')).toBe(true);
      expect(socialFeatures.has('inbox')).toBe(true);
      expect(socialFeatures.has('accounts')).toBe(true);

      // Workforce & Users completeness
      const workforceFeatures = new Set(
        PermissionRegistryService.getPermissionsBySection('workforce').map((p) => p.feature)
      );
      expect(workforceFeatures.has('intelligence')).toBe(true);
      expect(workforceFeatures.has('users')).toBe(true);
      expect(workforceFeatures.has('onboarding')).toBe(true);
      expect(workforceFeatures.has('commandCenter')).toBe(true);
      expect(workforceFeatures.has('advisor')).toBe(true);
      expect(workforceFeatures.has('governance')).toBe(true);
      expect(workforceFeatures.has('crmWorkload')).toBe(true);
      expect(workforceFeatures.has('enterpriseIdentity')).toBe(true);
      expect(workforceFeatures.has('roles')).toBe(true);

      // Management completeness
      const mgtFeatures = new Set(
        PermissionRegistryService.getPermissionsBySection('management').map((p) => p.feature)
      );
      expect(mgtFeatures.has('activities')).toBe(true);
      expect(mgtFeatures.has('leadScores')).toBe(true);
      expect(mgtFeatures.has('messagingSettings')).toBe(true);
      expect(mgtFeatures.has('fields')).toBe(true);
      expect(mgtFeatures.has('aiPrompts')).toBe(true);
      expect(mgtFeatures.has('effortRules')).toBe(true);
      expect(mgtFeatures.has('systemSettings')).toBe(true);
      expect(mgtFeatures.has('developerApi')).toBe(true);
      expect(mgtFeatures.has('webhooks')).toBe(true);
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
