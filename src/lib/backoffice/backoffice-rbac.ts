/**
 * @fileoverview Platform Control Plane RBAC Engine
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - This is a pure, client-safe leaf module with zero Node.js/Firebase Admin dependencies.
 * - Single source of truth: client-side UI gating (`can(module, action)`) mirrors server verification (`authorizeBackoffice`).
 * - Uses Set<BackofficeAction> for O(1) performance lookups (js-set-map-lookups).
 *
 * @testability Exported pure functions (`evaluateBackofficePermission`, `canViewModule`) have zero external state.
 * @trustBoundary Evaluates assigned roles against the immutable ROLE_MATRIX.
 */

import type {
  BackofficeRole,
  BackofficeModule,
  BackofficeAction,
} from './backoffice-types';

// ─────────────────────────────────────────────────
// Role → Module → Allowed Actions Matrix
// ─────────────────────────────────────────────────

const ROLE_MATRIX: Record<BackofficeRole, Record<BackofficeModule, Set<BackofficeAction>>> = {
  super_admin: {
    dashboard:             new Set(['view', 'create', 'edit', 'delete', 'execute']),
    health:                new Set(['view', 'create', 'edit', 'delete', 'execute']),
    organizations:         new Set(['view', 'create', 'edit', 'delete', 'execute']),
    workspaces:            new Set(['view', 'create', 'edit', 'delete', 'execute']),
    features:              new Set(['view', 'create', 'edit', 'delete', 'execute']),
    templates:             new Set(['view', 'create', 'edit', 'delete', 'execute']),
    survey_governance:     new Set(['view', 'create', 'edit', 'delete', 'execute']),
    fields:                new Set(['view', 'create', 'edit', 'delete', 'execute']),
    assets:                new Set(['view', 'create', 'edit', 'delete', 'execute']),
    operations:            new Set(['view', 'create', 'edit', 'delete', 'execute']),
    messaging_observatory: new Set(['view', 'create', 'edit', 'delete', 'execute']),
    finance_monitor:       new Set(['view', 'create', 'edit', 'delete', 'execute']),
    meetings_monitor:      new Set(['view', 'create', 'edit', 'delete', 'execute']),
    integration_health:    new Set(['view', 'create', 'edit', 'delete', 'execute']),
    audit:                 new Set(['view', 'create', 'edit', 'delete', 'execute']),
    settings:              new Set(['view', 'create', 'edit', 'delete', 'execute']),
    approvals:             new Set(['view', 'create', 'edit', 'delete', 'execute']),
  },

  tenant_admin_ops: {
    dashboard:             new Set(['view']),
    health:                new Set(['view', 'edit']),
    organizations:         new Set(['view', 'create', 'edit']),
    workspaces:            new Set(['view', 'create', 'edit']),
    features:              new Set(['view']),
    templates:             new Set(['view']),
    survey_governance:     new Set(['view']),
    fields:                new Set(['view']),
    assets:                new Set(['view']),
    operations:            new Set(['view']),
    messaging_observatory: new Set(['view']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view']),
    integration_health:    new Set(['view']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view']),
  },

  release_admin: {
    dashboard:             new Set(['view']),
    health:                new Set(['view']),
    organizations:         new Set(['view']),
    workspaces:            new Set(['view']),
    features:              new Set(['view', 'create', 'edit', 'delete', 'execute']),
    templates:             new Set(['view']),
    survey_governance:     new Set(['view']),
    fields:                new Set(['view']),
    assets:                new Set(['view']),
    operations:            new Set(['view']),
    messaging_observatory: new Set(['view']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view']),
    integration_health:    new Set(['view']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view']),
  },

  template_admin: {
    dashboard:             new Set(['view']),
    health:                new Set(['view']),
    organizations:         new Set(['view']),
    workspaces:            new Set(['view']),
    features:              new Set(['view']),
    templates:             new Set(['view', 'create', 'edit', 'delete']),
    survey_governance:     new Set(['view', 'create', 'edit', 'delete']),
    fields:                new Set(['view', 'create', 'edit']),
    assets:                new Set(['view', 'create', 'edit', 'delete']),
    operations:            new Set(['view']),
    messaging_observatory: new Set(['view']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view']),
    integration_health:    new Set(['view']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view']),
  },

  support_admin: {
    dashboard:             new Set(['view']),
    health:                new Set(['view', 'create', 'edit', 'execute']),
    organizations:         new Set(['view', 'edit']),
    workspaces:            new Set(['view', 'edit']),
    features:              new Set(['view']),
    templates:             new Set(['view']),
    survey_governance:     new Set(['view']),
    fields:                new Set(['view']),
    assets:                new Set(['view']),
    operations:            new Set(['view', 'execute']),
    messaging_observatory: new Set(['view', 'execute']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view', 'edit', 'execute']),
    integration_health:    new Set(['view', 'edit']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view']),
  },

  security_auditor: {
    dashboard:             new Set(['view']),
    health:                new Set(['view']),
    organizations:         new Set(['view']),
    workspaces:            new Set(['view']),
    features:              new Set(['view']),
    templates:             new Set(['view']),
    survey_governance:     new Set(['view']),
    fields:                new Set(['view']),
    assets:                new Set(['view']),
    operations:            new Set(['view']),
    messaging_observatory: new Set(['view']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view']),
    integration_health:    new Set(['view']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view', 'execute']),
  },

  migration_admin: {
    dashboard:             new Set(['view']),
    health:                new Set(['view']),
    organizations:         new Set(['view']),
    workspaces:            new Set(['view']),
    features:              new Set(['view']),
    templates:             new Set(['view']),
    survey_governance:     new Set(['view']),
    fields:                new Set(['view']),
    assets:                new Set(['view']),
    operations:            new Set(['view', 'create', 'edit', 'execute']),
    messaging_observatory: new Set(['view', 'execute']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view']),
    integration_health:    new Set(['view']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view']),
  },

  readonly_auditor: {
    dashboard:             new Set(['view']),
    health:                new Set(['view']),
    organizations:         new Set(['view']),
    workspaces:            new Set(['view']),
    features:              new Set(['view']),
    templates:             new Set(['view']),
    survey_governance:     new Set(['view']),
    fields:                new Set(['view']),
    assets:                new Set(['view']),
    operations:            new Set(['view']),
    messaging_observatory: new Set(['view']),
    finance_monitor:       new Set(['view']),
    meetings_monitor:      new Set(['view']),
    integration_health:    new Set(['view']),
    audit:                 new Set(['view']),
    settings:              new Set(['view']),
    approvals:             new Set(['view']),
  },
};

/**
 * Evaluates whether a user with given backoffice roles can perform
 * an action on a specific module.
 *
 * Uses OR logic: if ANY role grants the action, access is granted.
 * Early-exit on first match (js-early-exit).
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
 * Convenience helper — check view access for a module.
 */
export function canViewModule(
  roles: BackofficeRole[] | undefined,
  module: BackofficeModule
): boolean {
  return evaluateBackofficePermission(roles, module, 'view');
}

/**
 * Check if the user has any backoffice access at all.
 */
export function hasBackofficeAccess(roles: BackofficeRole[] | undefined): boolean {
  return Array.isArray(roles) && roles.length > 0;
}

/**
 * Check if the user is a super admin.
 */
export function isBackofficeSuperAdmin(roles: BackofficeRole[] | undefined): boolean {
  return Array.isArray(roles) && roles.includes('super_admin');
}

/**
 * Get the list of modules a user can view (for sidebar rendering).
 */
export function getViewableModules(roles: BackofficeRole[] | undefined): BackofficeModule[] {
  if (!roles || roles.length === 0) return [];

  const allModules: BackofficeModule[] = [
    'dashboard',
    'health',
    'organizations',
    'workspaces',
    'features',
    'templates',
    'survey_governance',
    'fields',
    'assets',
    'operations',
    'messaging_observatory',
    'finance_monitor',
    'meetings_monitor',
    'integration_health',
    'audit',
    'settings',
    'approvals',
  ];

  return allModules.filter((mod) => canViewModule(roles, mod));
}

/**
 * Human-readable labels for backoffice roles.
 */
export const BACKOFFICE_ROLE_LABELS: Record<BackofficeRole, string> = {
  super_admin: 'Super Admin',
  tenant_admin_ops: 'Tenant Admin Ops',
  release_admin: 'Release Admin',
  template_admin: 'Template Admin',
  support_admin: 'Support Admin',
  security_auditor: 'Security Auditor',
  migration_admin: 'Migration Admin',
  readonly_auditor: 'Read-Only Auditor',
};

/**
 * Human-readable labels for backoffice modules.
 */
export const BACKOFFICE_MODULE_LABELS: Record<BackofficeModule, string> = {
  dashboard: 'Dashboard',
  health: 'Tenant Health',
  organizations: 'Organizations',
  workspaces: 'Workspaces',
  features: 'Features & Rollouts',
  templates: 'Templates',
  survey_governance: 'Survey Governance',
  fields: 'Fields & Variables',
  assets: 'Assets',
  operations: 'Operations & Jobs',
  messaging_observatory: 'Messaging Observatory',
  finance_monitor: 'Financial Monitor',
  meetings_monitor: 'Meetings Monitor',
  integration_health: 'Integration Health',
  audit: 'Audit Logs',
  settings: 'Settings',
  approvals: 'Approvals',
};
