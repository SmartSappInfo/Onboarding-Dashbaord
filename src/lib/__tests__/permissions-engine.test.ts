import { describe, it, expect } from 'vitest';
import {
  evaluatePermission,
  getBlankPermissions,
  getFullAdminPermissions,
  normalizePermissionsSchema,
  flattenPermissionsSchema,
  mergePermissionsSchemas,
  migrateToPermissionsSchema,
} from '../permissions-engine';
import type { PermissionsSchema } from '../types';

describe('permissions-engine', () => {
  describe('normalizePermissionsSchema', () => {
    it('should return a blank schema for null, undefined, or non-object values', () => {
      const blank = getBlankPermissions();
      expect(normalizePermissionsSchema(null)).toEqual(blank);
      expect(normalizePermissionsSchema(undefined)).toEqual(blank);
      expect(normalizePermissionsSchema('invalid-string')).toEqual(blank);
      expect(normalizePermissionsSchema(12345)).toEqual(blank);
      expect(normalizePermissionsSchema([])).toEqual(blank);
    });

    it('should normalize a partial schema and backfill missing sections with defaults', () => {
      const partial = {
        operations: {
          enabled: true,
          features: {
            tasks: { view: true, create: true },
          },
        },
      };

      const normalized = normalizePermissionsSchema(partial);
      expect(normalized.operations.enabled).toBe(true);
      expect(normalized.operations.features.tasks).toEqual({ view: true, create: true });
      expect(normalized.finance.enabled).toBe(false);
      expect(normalized.studios.enabled).toBe(false);
      expect(normalized.management.enabled).toBe(false);
    });

    it('should sanitize malformed feature attributes into booleans', () => {
      const dirty = {
        finance: {
          enabled: 'true' as unknown as boolean,
          features: {
            invoices: {
              view: 1 as unknown as boolean,
              create: 'yes' as unknown as boolean,
              delete: 0 as unknown as boolean,
            },
          },
        },
      };

      const normalized = normalizePermissionsSchema(dirty);
      expect(normalized.finance.enabled).toBe(true);
      expect(normalized.finance.features.invoices.view).toBe(true);
      expect(normalized.finance.features.invoices.create).toBe(true);
      expect(normalized.finance.features.invoices.delete).toBe(false);
    });
  });

  describe('evaluatePermission', () => {
    it('should return false if schema is undefined', () => {
      expect(evaluatePermission(undefined, 'operations', 'tasks', 'view')).toBe(false);
    });

    it('should default to view action when action is omitted', () => {
      const schema: PermissionsSchema = {
        ...getBlankPermissions(),
        operations: {
          enabled: true,
          features: {
            tasks: { view: true },
          },
        },
      };
      expect(evaluatePermission(schema, 'operations', 'tasks')).toBe(true);
    });

    it('should return false if section is disabled even if feature has view=true', () => {
      const schema: PermissionsSchema = {
        ...getBlankPermissions(),
        operations: {
          enabled: false,
          features: {
            tasks: { view: true, create: true },
          },
        },
      };

      expect(evaluatePermission(schema, 'operations', 'tasks', 'view')).toBe(false);
      expect(evaluatePermission(schema, 'operations', 'tasks', 'create')).toBe(false);
    });

    it('should return false for CRUD actions if view is false', () => {
      const schema: PermissionsSchema = {
        ...getBlankPermissions(),
        operations: {
          enabled: true,
          features: {
            tasks: { view: false, create: true },
          },
        },
      };

      expect(evaluatePermission(schema, 'operations', 'tasks', 'create')).toBe(false);
    });

    it('should grant access when section is enabled, feature has view, and action is granted', () => {
      const adminSchema = getFullAdminPermissions();
      expect(evaluatePermission(adminSchema, 'operations', 'campuses', 'view')).toBe(true);
      expect(evaluatePermission(adminSchema, 'operations', 'campuses', 'create')).toBe(true);
      expect(evaluatePermission(adminSchema, 'finance', 'invoices', 'delete')).toBe(true);
      expect(evaluatePermission(adminSchema, 'studios', 'messaging', 'edit')).toBe(true);
    });
  });

  describe('flattenPermissionsSchema', () => {
    it('should convert a full admin schema into legacy permission strings', () => {
      const adminSchema = getFullAdminPermissions();
      const flat = flattenPermissionsSchema(adminSchema);

      expect(flat).toContain('schools_view');
      expect(flat).toContain('schools_edit');
      expect(flat).toContain('prospects_view');
      expect(flat).toContain('tasks_manage');
      expect(flat).toContain('finance_view');
      expect(flat).toContain('finance_manage');
      expect(flat).toContain('contracts_delete');
      expect(flat).toContain('studios_view');
      expect(flat).toContain('users_manage');
    });

    it('should NOT grant manage permissions for read-only user and task viewers', () => {
      const readOnlySchema: PermissionsSchema = {
        ...getBlankPermissions(),
        operations: {
          enabled: true,
          features: {
            tasks: { view: true, create: false, edit: false, delete: false },
          },
        },
        management: {
          enabled: true,
          features: {
            users: { view: true, create: false, edit: false, delete: false },
            fields: { view: true, create: false, edit: false, delete: false },
          },
        },
      };

      const flat = flattenPermissionsSchema(readOnlySchema);

      expect(flat).toContain('tasks_view');
      expect(flat).not.toContain('tasks_manage');
      expect(flat).toContain('users_view');
      expect(flat).not.toContain('users_manage');
      expect(flat).toContain('fields_view');
      expect(flat).not.toContain('fields_manage');
    });

    it('should return an empty array for a blank schema', () => {
      const blank = getBlankPermissions();
      expect(flattenPermissionsSchema(blank)).toEqual([]);
    });
  });

  describe('mergePermissionsSchemas', () => {
    it('should merge multiple schemas using union logic', () => {
      const opsRole: PermissionsSchema = {
        ...getBlankPermissions(),
        operations: {
          enabled: true,
          features: {
            tasks: { view: true, create: true },
          },
        },
      };

      const finRole: PermissionsSchema = {
        ...getBlankPermissions(),
        finance: {
          enabled: true,
          features: {
            invoices: { view: true, edit: true },
          },
        },
      };

      const merged = mergePermissionsSchemas([opsRole, finRole]);
      expect(merged.operations.enabled).toBe(true);
      expect(merged.operations.features.tasks.create).toBe(true);
      expect(merged.finance.enabled).toBe(true);
      expect(merged.finance.features.invoices.edit).toBe(true);
      expect(merged.studios.enabled).toBe(false);
    });
  });

  describe('migrateToPermissionsSchema', () => {
    it('should correctly map legacy string permissions to hierarchical schema', () => {
      const legacyPerms = ['schools_view', 'schools_edit', 'users_manage', 'finance_view'];
      const migrated = migrateToPermissionsSchema(legacyPerms);

      expect(migrated.operations.enabled).toBe(true);
      expect(migrated.operations.features.campuses.view).toBe(true);
      expect(migrated.operations.features.campuses.edit).toBe(true);
      expect(migrated.finance.enabled).toBe(true);
      expect(migrated.finance.features.invoices.view).toBe(true);
      expect(migrated.management.enabled).toBe(true);
      expect(migrated.management.features.users.edit).toBe(true);
      expect(migrated.studios.enabled).toBe(false);
    });

    it('should return a blank schema when given an empty permissions array', () => {
      const migrated = migrateToPermissionsSchema([]);
      expect(migrated).toEqual(getBlankPermissions());
    });
  });
});
