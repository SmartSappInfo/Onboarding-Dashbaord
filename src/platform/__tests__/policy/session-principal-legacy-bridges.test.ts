/**
 * @fileOverview Legacy flat permissions → RBAC scopes in the session principal (Phase 11 M1 · T1
 * meetings bridge; M2 · T6 tasks bridge). The task bridge mirrors `migrateToPermissionsSchema`:
 * view; manage = create + edit; never delete.
 */
import { describe, it, expect } from 'vitest';
import { principalFromProfile } from '@/platform/capabilities/policy/session-principal-resolver';
import { migrateToPermissionsSchema } from '@/lib/permissions-engine';

const scopes = (permissions: string[]) =>
  principalFromProfile({ uid: 'u-1', workspaceId: 'ws-a', isSystemAdmin: false, profile: { organizationId: 'org-1', permissions } }).grantedScopes;

describe('legacy flat permission bridges', () => {
  it('tasks_manage grants task view, create and edit, never delete', () => {
    const s = scopes(['tasks_manage']);
    expect(s).toEqual(expect.arrayContaining(['rbac:operations.tasks.view', 'rbac:operations.tasks.create', 'rbac:operations.tasks.edit']));
    expect(s).not.toContain('rbac:operations.tasks.delete');
  });

  it('tasks_view grants view only', () => {
    const s = scopes(['tasks_view']);
    expect(s).toContain('rbac:operations.tasks.view');
    expect(s).not.toContain('rbac:operations.tasks.create');
  });

  it('matches what migrateToPermissionsSchema says the flat list means', () => {
    const tasks = migrateToPermissionsSchema(['tasks_manage']).operations.features.tasks;
    expect(tasks).toMatchObject({ view: true, create: true, edit: true, delete: false });
  });

  it('no task permission, no task scopes; the meetings bridge is unchanged', () => {
    const s = scopes(['meetings_manage']);
    expect(s.some((x) => x.startsWith('rbac:operations.tasks.'))).toBe(false);
    expect(s).toEqual(expect.arrayContaining(['rbac:operations.meetings.view', 'rbac:operations.meetings.edit']));
  });
});
