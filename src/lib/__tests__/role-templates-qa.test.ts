import { describe, it, expect } from 'vitest';
import {
  evaluatePermission,
  getBlankPermissions,
  getMarketingPermissions,
  getOperationsPermissions,
  normalizePermissionsSchema,
  flattenPermissionsSchema,
  migrateToPermissionsSchema,
  mergePermissionsSchemas,
} from '../permissions-engine';
import { 
  CANONICAL_ROLE_BLUEPRINTS,
  groupBlueprintsByIndustry 
} from '../role-blueprint-presets';
import type { PermissionsSchema } from '../types';

describe('Role Templates QA End-to-End Suite', () => {
  describe('Canonical Multi-Industry Role Blueprints Integrity', () => {
    it('should export all 22 canonical platform blueprint presets', () => {
      expect(CANONICAL_ROLE_BLUEPRINTS).toHaveLength(22);

      const ids = CANONICAL_ROLE_BLUEPRINTS.map(b => b.id);
      // Universal
      expect(ids).toContain('builtin-super-admin');
      expect(ids).toContain('builtin-operations-lead');
      expect(ids).toContain('builtin-finance-officer');
      expect(ids).toContain('builtin-studio-manager');

      // SaaS
      expect(ids).toContain('role-saas-customer-success');
      expect(ids).toContain('role-saas-sales-growth');
      expect(ids).toContain('role-saas-billing-specialist');

      // School Admissions
      expect(ids).toContain('role-school-admissions-officer');
      expect(ids).toContain('role-school-academic-registrar');
      expect(ids).toContain('role-school-bursar');

      // Marketing
      expect(ids).toContain('role-mktg-creative-director');
      expect(ids).toContain('role-mktg-account-executive');
      expect(ids).toContain('role-mktg-analytics-lead');

      // Law
      expect(ids).toContain('role-law-managing-partner');
      expect(ids).toContain('role-law-paralegal-intake');
      expect(ids).toContain('role-law-billing-clerk');

      // Real Estate
      expect(ids).toContain('role-realestate-lead-broker');
      expect(ids).toContain('role-realestate-marketing-specialist');
      expect(ids).toContain('role-realestate-escrow-coordinator');

      // Consultancy
      expect(ids).toContain('role-consultancy-engagement-principal');
      expect(ids).toContain('role-consultancy-operations-specialist');
      expect(ids).toContain('role-consultancy-contracts-officer');
    });

    it('should cover all 6 platform industry verticals with at least 3 roles each', () => {
      const verticals = ['SaaS', 'SchoolEnrollment', 'Marketing', 'Law', 'RealEstate', 'Consultancy'];
      for (const vertical of verticals) {
        const verticalRoles = CANONICAL_ROLE_BLUEPRINTS.filter(
          b => b.category.toLowerCase() === vertical.toLowerCase() ||
               b.visibilityRules?.workspaceTypes?.includes(vertical)
        );
        expect(verticalRoles.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should ensure all 22 presets pass strict schema normalization', () => {
      for (const blueprint of CANONICAL_ROLE_BLUEPRINTS) {
        expect(blueprint.status).toBe('published');
        expect(blueprint.type).toBe('role_architecture');

        const normalized = normalizePermissionsSchema(blueprint.content);
        expect(normalized).toBeDefined();
        expect(typeof normalized.operations.enabled).toBe('boolean');
        expect(typeof normalized.finance.enabled).toBe('boolean');
        expect(typeof normalized.studios.enabled).toBe('boolean');
        expect(typeof normalized.management.enabled).toBe('boolean');
      }
    });

    it('should verify super admin preset has full administrative privileges', () => {
      const superAdmin = CANONICAL_ROLE_BLUEPRINTS.find(b => b.id === 'builtin-super-admin');
      expect(superAdmin).toBeDefined();
      const schema = normalizePermissionsSchema(superAdmin!.content);

      expect(evaluatePermission(schema, 'operations', 'campuses', 'create')).toBe(true);
      expect(evaluatePermission(schema, 'finance', 'invoices', 'delete')).toBe(true);
      expect(evaluatePermission(schema, 'studios', 'messaging', 'edit')).toBe(true);
      expect(evaluatePermission(schema, 'management', 'users', 'delete')).toBe(true);
    });

    it('should verify operations lead preset does not grant management or finance deletion', () => {
      const opsLead = CANONICAL_ROLE_BLUEPRINTS.find(b => b.id === 'builtin-operations-lead');
      expect(opsLead).toBeDefined();
      const schema = normalizePermissionsSchema(opsLead!.content);

      expect(evaluatePermission(schema, 'operations', 'tasks', 'view')).toBe(true);
      expect(evaluatePermission(schema, 'finance', 'invoices', 'delete')).toBe(false);
      expect(evaluatePermission(schema, 'management', 'users', 'delete')).toBe(false);
    });
  });

  describe('Industry Grouping & Prioritization QA', () => {
    it('should partition recommended roles first for RealEstate vertical', () => {
      const grouped = groupBlueprintsByIndustry(CANONICAL_ROLE_BLUEPRINTS, 'RealEstate');
      expect(grouped.recommended).toHaveLength(3);
      expect(grouped.recommended.map(r => r.id)).toContain('role-realestate-lead-broker');
      expect(grouped.universal).toHaveLength(4);
      expect(grouped.otherVerticals.length).toBe(5); // SaaS, SchoolEnrollment, Marketing, Law, Consultancy
    });

    it('should partition recommended roles first for SchoolEnrollment vertical', () => {
      const grouped = groupBlueprintsByIndustry(CANONICAL_ROLE_BLUEPRINTS, 'SchoolEnrollment');
      expect(grouped.recommended).toHaveLength(3);
      expect(grouped.recommended.map(r => r.id)).toContain('role-school-admissions-officer');
      expect(grouped.universal).toHaveLength(4);
    });
  });

  describe('Security & Privilege Escalation Boundary QA', () => {
    it('should never emit *_manage when user has view-only on sensitive entities', () => {
      const readOnlyUsersRole: PermissionsSchema = {
        ...getBlankPermissions(),
        management: {
          enabled: true,
          features: {
            users: { view: true, create: false, edit: false, delete: false },
            fields: { view: true, create: false, edit: false, delete: false },
          },
        },
      };

      const flat = flattenPermissionsSchema(readOnlyUsersRole);
      expect(flat).toContain('users_view');
      expect(flat).not.toContain('users_manage');
      expect(flat).toContain('fields_view');
      expect(flat).not.toContain('fields_manage');
    });

    it('should resist prototype pollution and malicious keys in raw content', () => {
      const maliciousPayload = JSON.parse(
        '{"__proto__": {"polluted": true}, "operations": {"enabled": true, "features": {"tasks": {"view": true}}}}'
      );

      const normalized = normalizePermissionsSchema(maliciousPayload);
      expect(normalized.operations.enabled).toBe(true);
      expect(normalized.operations.features.tasks.view).toBe(true);
      expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe('Dual-Storage & Legacy Parity QA', () => {
    it('should roundtrip from legacy flat permissions through migration back to flattened strings', () => {
      const legacyPerms = ['schools_view', 'schools_edit', 'prospects_view', 'tasks_view', 'finance_view'];
      const schema = migrateToPermissionsSchema(legacyPerms);
      const regeneratedFlat = flattenPermissionsSchema(schema);

      for (const perm of legacyPerms) {
        expect(regeneratedFlat).toContain(perm);
      }
    });

    it('should properly merge preset roles with custom overrides', () => {
      const ops = getOperationsPermissions();
      const mktg = getMarketingPermissions();
      const merged = mergePermissionsSchemas([ops, mktg]);

      expect(merged.operations.enabled).toBe(true);
      expect(merged.studios.enabled).toBe(true);
      expect(evaluatePermission(merged, 'operations', 'tasks', 'view')).toBe(true);
      expect(evaluatePermission(merged, 'studios', 'publicPortals', 'view')).toBe(true);
      expect(merged.finance.enabled).toBe(false);
    });
  });
});
