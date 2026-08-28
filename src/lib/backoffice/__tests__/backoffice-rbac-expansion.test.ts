/**
 * @fileoverview QA Unit Tests for Expanded Backoffice RBAC Matrix (17 Modules)
 */

import { describe, it, expect } from 'vitest';
import { evaluateBackofficePermission, getViewableModules } from '../backoffice-rbac';
import type { BackofficeRole } from '../backoffice-types';

describe('Backoffice Expanded RBAC QA Suite', () => {
  it('allows super_admin full access to all 6 new operational modules', () => {
    const roles: BackofficeRole[] = ['super_admin'];

    expect(evaluateBackofficePermission(roles, 'health', 'view')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'health', 'execute')).toBe(true);

    expect(evaluateBackofficePermission(roles, 'messaging_observatory', 'execute')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'finance_monitor', 'execute')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'meetings_monitor', 'execute')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'survey_governance', 'execute')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'integration_health', 'execute')).toBe(true);
  });

  it('allows support_admin view & edit on health and meetings, view on surveys, but restricts finance mutation', () => {
    const roles: BackofficeRole[] = ['support_admin'];

    expect(evaluateBackofficePermission(roles, 'health', 'view')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'health', 'edit')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'meetings_monitor', 'view')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'survey_governance', 'view')).toBe(true);

    // Should NOT have finance execute permission
    expect(evaluateBackofficePermission(roles, 'finance_monitor', 'execute')).toBe(false);
  });

  it('allows tenant_admin_ops to view operational telemetry', () => {
    const roles: BackofficeRole[] = ['tenant_admin_ops'];

    expect(evaluateBackofficePermission(roles, 'finance_monitor', 'view')).toBe(true);
    expect(evaluateBackofficePermission(roles, 'finance_monitor', 'execute')).toBe(false);
    expect(evaluateBackofficePermission(roles, 'health', 'view')).toBe(true);
  });

  it('correctly aggregates viewable modules for sidebar rendering', () => {
    const supportModules = getViewableModules(['support_admin']);
    expect(supportModules).toContain('health');
    expect(supportModules).toContain('meetings_monitor');
    expect(supportModules).toContain('survey_governance');

    const superAdminModules = getViewableModules(['super_admin']);
    expect(superAdminModules.length).toBeGreaterThanOrEqual(17);
  });
});
