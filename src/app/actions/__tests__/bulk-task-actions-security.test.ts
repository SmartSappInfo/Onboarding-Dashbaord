// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = {
  currentUser: null as { uid: string; email: string } | null,
  userWorkspaces: ['ws-authorized'],
  canUserResult: { granted: true, reason: undefined as string | undefined },
  bulkCreateCoreInvoked: false,
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => {
    if (!mockState.currentUser) {
      throw new Error('UNAUTHENTICATED');
    }
    return mockState.currentUser;
  }),
  requireWorkspace: vi.fn(async (workspaceId: string) => {
    if (!mockState.currentUser) {
      throw new Error('UNAUTHENTICATED');
    }
    if (!mockState.userWorkspaces.includes(workspaceId)) {
      throw new Error(`WORKSPACE_ACCESS_DENIED: User lacks membership in ${workspaceId}`);
    }
    return { uid: mockState.currentUser.uid, workspaceId };
  }),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async (_uid: string, _res: string, _mod: string, _act: string, _ws: string) => {
    return mockState.canUserResult;
  }),
}));

vi.mock('@/lib/tasks/task-bulk-core', () => ({
  bulkCreateTasksCore: vi.fn(async () => {
    mockState.bulkCreateCoreInvoked = true;
    return { success: true, count: 5, message: 'Created 5 tasks.' };
  }),
}));

import * as bulkTaskActionsModule from '../bulk-task-actions';

describe('Server Action Security: bulk-task-actions.ts (VULN-01)', () => {
  beforeEach(() => {
    mockState.currentUser = { uid: 'user-123', email: 'test@smartsapp.com' };
    mockState.userWorkspaces = ['ws-authorized'];
    mockState.canUserResult = { granted: true, reason: undefined };
    mockState.bulkCreateCoreInvoked = false;
  });

  it('prohibits export of unauthenticated bulkCreateTasksActionCore as a server action', () => {
    // Audit VULN-01: Every top-level export of a 'use server' file becomes an open HTTP endpoint.
    // bulkCreateTasksActionCore MUST NOT be exported from bulk-task-actions.ts.
    expect((bulkTaskActionsModule as Record<string, unknown>).bulkCreateTasksActionCore).toBeUndefined();
  });

  it('rejects unauthenticated anonymous callers', async () => {
    mockState.currentUser = null;

    const res = await bulkTaskActionsModule.bulkCreateTasksAction({
      entityIds: ['ent-1'],
      workspaceId: 'ws-authorized',
      organizationId: 'org-1',
      title: 'Action Item',
      description: '',
      priority: 'medium',
      category: 'call',
      dueDaysOffset: 1,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/UNAUTHENTICATED/i);
    expect(mockState.bulkCreateCoreInvoked).toBe(false);
  });

  it('rejects cross-workspace requests targeting unauthorized foreign workspace', async () => {
    mockState.currentUser = { uid: 'user-tenant-A', email: 'tenantA@smartsapp.com' };
    mockState.userWorkspaces = ['ws-tenant-A']; // Caller only belongs to Tenant A

    const res = await bulkTaskActionsModule.bulkCreateTasksAction({
      entityIds: ['ent-1'],
      workspaceId: 'ws-tenant-B', // Target is Tenant B!
      organizationId: 'org-B',
      title: 'Cross-Tenant Exploit Attempt',
      description: '',
      priority: 'high',
      category: 'general',
      dueDaysOffset: 1,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/WORKSPACE_ACCESS_DENIED/i);
    expect(mockState.bulkCreateCoreInvoked).toBe(false);
  });

  it('rejects callers without operations:tasks:create permission', async () => {
    mockState.canUserResult = { granted: false, reason: 'Read-only staff cannot create bulk tasks.' };

    const res = await bulkTaskActionsModule.bulkCreateTasksAction({
      entityIds: ['ent-1'],
      workspaceId: 'ws-authorized',
      organizationId: 'org-1',
      title: 'Perm-denied task',
      description: '',
      priority: 'medium',
      category: 'general',
      dueDaysOffset: 2,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Read-only staff cannot create bulk tasks.');
    expect(mockState.bulkCreateCoreInvoked).toBe(false);
  });

  it('allows authorized workspace members with create permissions to invoke bulk creation', async () => {
    const res = await bulkTaskActionsModule.bulkCreateTasksAction({
      entityIds: ['ent-1'],
      workspaceId: 'ws-authorized',
      organizationId: 'org-1',
      title: 'Authorized Task',
      description: '',
      priority: 'medium',
      category: 'call',
      dueDaysOffset: 2,
    });

    expect(res.success).toBe(true);
    expect(mockState.bulkCreateCoreInvoked).toBe(true);
  });
});
