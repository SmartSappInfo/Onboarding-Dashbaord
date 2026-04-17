

import type {
  BackofficeRole,
  BackofficeModule,
  BackofficeAction,
} from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice RBAC Engine
// Governs access to the /backoffice control plane.
// Separate from workspace-level RBAC in permissions-engine.ts.
// ─────────────────────────────────────────────────

/**
 * Role → Module → Allowed Actions matrix.
 * This is the source of truth for what each backoffice role can do.
 *
 * Design: Uses a Set<BackofficeAction> for O(1) lookups (js-set-map-lookups).
 */
const ROLE_MATRIX: Record<BackofficeRole, Record<BackofficeModule, Set<BackofficeAction>>> = {
  super_admin: {
    dashboard:     new Set(['view', 'create', 'edit', 'delete', 'execute']),
    organizations: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    workspaces:    new Set(['view', 'create', 'edit', 'delete', 'execute']),
    features:      new Set(['view', 'create', 'edit', 'delete', 'execute']),
    templates:     new Set(['view', 'create', 'edit', 'delete', 'execute']),
    fields:        new Set(['view', 'create', 'edit', 'delete', 'execute']),
    assets:        new Set(['view', 'create', 'edit', 'delete', 'execute']),
    operations:    new Set(['view', 'create', 'edit', 'delete', 'execute']),
    audit:         new Set(['view', 'create', 'edit', 'delete', 'execute']),
    settings:      new Set(['view', 'create', 'edit', 'delete', 'execute']),
  },

  tenant_admin_ops: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view', 'create', 'edit']),
    workspaces:    new Set(['view', 'create', 'edit']),
    features:      new Set(['view']),
    templates:     new Set(['view']),
    fields:        new Set(['view']),
    assets:        new Set(['view']),
    operations:    new Set(['view']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },

  release_admin: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view']),
    workspaces:    new Set(['view']),
    features:      new Set(['view', 'create', 'edit', 'delete', 'execute']),
    templates:     new Set(['view']),
    fields:        new Set(['view']),
    assets:        new Set(['view']),
    operations:    new Set(['view']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },

  template_admin: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view']),
    workspaces:    new Set(['view']),
    features:      new Set(['view']),
    templates:     new Set(['view', 'create', 'edit', 'delete']),
    fields:        new Set(['view', 'create', 'edit']),
    assets:        new Set(['view', 'create', 'edit', 'delete']),
    operations:    new Set(['view']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },

  support_admin: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view', 'edit']),
    workspaces:    new Set(['view', 'edit']),
    features:      new Set(['view']),
    templates:     new Set(['view']),
    fields:        new Set(['view']),
    assets:        new Set(['view']),
    operations:    new Set(['view', 'execute']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },

  security_auditor: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view']),
    workspaces:    new Set(['view']),
    features:      new Set(['view']),
    templates:     new Set(['view']),
    fields:        new Set(['view']),
    assets:        new Set(['view']),
    operations:    new Set(['view']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },

  migration_admin: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view']),
    workspaces:    new Set(['view']),
    features:      new Set(['view']),
    templates:     new Set(['view']),
    fields:        new Set(['view']),
    assets:        new Set(['view']),
    operations:    new Set(['view', 'create', 'edit', 'execute']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },

  readonly_auditor: {
    dashboard:     new Set(['view']),
    organizations: new Set(['view']),
    workspaces:    new Set(['view']),
    features:      new Set(['view']),
    templates:     new Set(['view']),
    fields:        new Set(['view']),
    assets:        new Set(['view']),
    operations:    new Set(['view']),
    audit:         new Set(['view']),
    settings:      new Set(['view']),
  },
};

/**
 * Evaluates whether a user with given backoffice roles can perform
 * an action on a specific module.
 *
 * Uses OR logic: if ANY role grants the action, access is granted.
 * Early-exit on first match (js-early-exit).
 *
 * @param roles - User's backoffice roles
 * @param module - The backoffice module being accessed
 * @param action - The action being attempted
 * @returns boolean
 */
export function evaluateBackofficePermission(
  roles: BackofficeRole[] | undefined,
  module: BackofficeModule,
  action: BackofficeAction = 'view'
): boolean {
  if (!roles || roles.length === 0) return false;

  for (const role of roles) {
    const modulePerms = ROLE_MATRIX[role]?.[module];
    if (modulePerms?.has(action)) return true;
  }

  return false;
}

/**
 * Checks if any of the user's backoffice roles has access to view
 * the specified module (used for sidebar visibility).
 */
export function canViewModule(
  roles: BackofficeRole[] | undefined,
  module: BackofficeModule
): boolean {
  return evaluateBackofficePermission(roles, module, 'view');
}

/**
 * Checks if a user has any backoffice role at all (i.e., can access /backoffice).
 */
export function hasBackofficeAccess(roles: BackofficeRole[] | undefined): boolean {
  return !!roles && roles.length > 0;
}

/**
 * Checks if a user is a backoffice super admin (full access).
 */
export function isBackofficeSuperAdmin(roles: BackofficeRole[] | undefined): boolean {
  return !!roles && roles.includes('super_admin');
}

/**
 * Returns all modules a user can view, given their roles.
 * Used for generating the sidebar navigation.
 */
export function getViewableModules(roles: BackofficeRole[] | undefined): BackofficeModule[] {
  if (!roles || roles.length === 0) return [];

  const ALL_MODULES: BackofficeModule[] = [
    'dashboard', 'organizations', 'workspaces', 'features',
    'templates', 'fields', 'assets', 'operations', 'audit', 'settings',
  ];

  return ALL_MODULES.filter(mod => canViewModule(roles, mod));
}

/**
 * Returns all actions a user can perform on a specific module.
 * Used for conditional rendering of action buttons.
 */
export function getModuleActions(
  roles: BackofficeRole[] | undefined,
  module: BackofficeModule
): Set<BackofficeAction> {
  if (!roles || roles.length === 0) return new Set();

  const actions = new Set<BackofficeAction>();

  for (const role of roles) {
    const modulePerms = ROLE_MATRIX[role]?.[module];
    if (modulePerms) {
      for (const action of modulePerms) {
        actions.add(action);
      }
    }
  }

  return actions;
}

/**
 * Human-readable labels for backoffice roles.
 */
export const BACKOFFICE_ROLE_LABELS: Record<BackofficeRole, string> = {
  super_admin: 'Super Administrator',
  tenant_admin_ops: 'Tenant Operations Admin',
  release_admin: 'Release Manager',
  template_admin: 'Template Administrator',
  support_admin: 'Support Administrator',
  security_auditor: 'Security Auditor',
  migration_admin: 'Migration Administrator',
  readonly_auditor: 'Read-Only Auditor',
};

/**
 * Module labels for UI display.
 */
export const BACKOFFICE_MODULE_LABELS: Record<BackofficeModule, string> = {
  dashboard: 'Dashboard',
  organizations: 'Organizations',
  workspaces: 'Workspaces',
  features: 'Features & Rollouts',
  templates: 'Templates',
  fields: 'Fields & Variables',
  assets: 'Assets',
  operations: 'Operations',
  audit: 'Audit Logs',
  settings: 'Settings',
};
