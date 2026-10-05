// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@/lib/types';

const mockState = {
  tasks: new Map<string, Record<string, unknown>>(),
  workspaceMembers: new Map<string, string>(), // workspaceId -> uid
  permissionGranted: true,
  batchUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  batchDeletes: [] as string[],
  obligationSyncs: [] as Array<{ taskId: string; contractId: string; obligationId: string }>,
};

vi.mock('@/lib/firebase-admin', () => {
  const workspaceDoc = (id: string) => ({
    get: async () => ({ exists: true, data: () => ({ organizationId: `org-${id}` }) }),
  });
  const doc = (id: string) => ({
    get: async () => ({
      exists: mockState.tasks.has(id),
      id,
      data: () => mockState.tasks.get(id),
    }),
    update: async (data: Record<string, unknown>) => {
      mockState.batchUpdates.push({ id, data });
    },
    delete: async () => {
      mockState.batchDeletes.push(id);
    },
  });

  return {
    adminDb: {
      collection: (name: string) => ({
        doc: name === 'workspaces' ? workspaceDoc : doc,
        add: async () => ({ id: 'new-task' }),
      }),
      batch: () => ({
        update: vi.fn((docRef: { id?: string }, data: Record<string, unknown>) => {
          mockState.batchUpdates.push({ id: (docRef as unknown as { id: string }).id || 'mock-doc', data });
        }),
        delete: vi.fn((docRef: { id?: string }) => {
          mockState.batchDeletes.push((docRef as unknown as { id: string }).id || 'mock-doc');
        }),
        commit: vi.fn(async () => undefined),
      }),
    },
  };
});

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (workspaceId: string) => {
    const allowedUid = mockState.workspaceMembers.get(workspaceId);
    if (!allowedUid) throw new Error('WORKSPACE_ACCESS_DENIED');
    return { uid: allowedUid };
  }),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async () =>
    mockState.permissionGranted ? { granted: true } : { granted: false, reason: 'Permission denied.' }
  ),
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(async () => undefined),
}));

vi.mock('@/lib/documents/crm-deal-sync-service', () => ({
  syncTaskCompletionToObligation: vi.fn(async (args: { taskId: string; contractId: string; obligationId: string }) => {
    mockState.obligationSyncs.push(args);
  }),
}));

import { bulkUpdateTasksAction, bulkDeleteTasksAction } from '@/lib/task-server-actions';

describe('Bulk Task Actions Security & Batch Engine (Phase 1)', () => {
  beforeEach(() => {
    mockState.tasks.clear();
    mockState.workspaceMembers.clear();
    mockState.batchUpdates = [];
    mockState.batchDeletes = [];
    mockState.obligationSyncs = [];
    mockState.permissionGranted = true;

    mockState.workspaceMembers.set('ws-alpha', 'usr-alice');
    mockState.tasks.set('task-1', {
      id: 'task-1',
      title: 'Task 1',
      status: 'todo',
      workspaceId: 'ws-alpha',
    });
    mockState.tasks.set('task-linked', {
      id: 'task-linked',
      title: 'Task Linked to Contract',
      status: 'in_progress',
      workspaceId: 'ws-alpha',
      relatedParentId: 'contract-deal-7',
      relatedEntityId: 'obligation-3',
    });
    mockState.tasks.set('task-foreign', {
      id: 'task-foreign',
      title: 'Foreign Task',
      status: 'todo',
      workspaceId: 'ws-bravo',
    });
  });

  it('rejects bulk update when user lacks workspace access', async () => {
    const res = await bulkUpdateTasksAction(['task-1'], { status: 'done' }, 'ws-unknown');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/WORKSPACE_ACCESS_DENIED/);
  });

  it('rejects bulk update when user lacks operations:tasks:edit permission', async () => {
    mockState.permissionGranted = false;
    const res = await bulkUpdateTasksAction(['task-1'], { status: 'done' }, 'ws-alpha');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Permission denied/);
  });

  it('rejects bulk update if any task is outside the verified workspace', async () => {
    const res = await bulkUpdateTasksAction(['task-1', 'task-foreign'], { status: 'done' }, 'ws-alpha');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Some tasks are not in this workspace.');
  });

  it('executes atomic batch update within workspace and strips immutable fields', async () => {
    const res = await bulkUpdateTasksAction(
      ['task-1'],
      {
        status: 'in_progress',
        priority: 'urgent',
        workspaceId: 'ws-evil', // must be stripped by editableTaskFields
        relatedParentId: 'contract-evil', // must be stripped
      } as unknown as Partial<Task>,
      'ws-alpha'
    );

    expect(res.success).toBe(true);
    expect(mockState.batchUpdates).toHaveLength(1);
    const update = mockState.batchUpdates[0];
    expect(update.data.status).toBe('in_progress');
    expect(update.data.priority).toBe('urgent');
    expect(update.data).not.toHaveProperty('workspaceId');
    expect(update.data).not.toHaveProperty('relatedParentId');
  });

  it('triggers contract obligation sync hook when marking linked tasks done in bulk', async () => {
    const res = await bulkUpdateTasksAction(['task-1', 'task-linked'], { status: 'done' }, 'ws-alpha');
    expect(res.success).toBe(true);

    // Only task-linked has relatedParentId & relatedEntityId
    expect(mockState.obligationSyncs).toHaveLength(1);
    expect(mockState.obligationSyncs[0]).toMatchObject({
      taskId: 'task-linked',
      contractId: 'contract-deal-7',
      obligationId: 'obligation-3',
    });
  });

  it('rejects bulk delete if any task is outside workspace', async () => {
    const res = await bulkDeleteTasksAction(['task-1', 'task-foreign'], 'ws-alpha');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Some tasks are not in this workspace.');
  });

  it('executes bulk delete on tasks inside workspace', async () => {
    const res = await bulkDeleteTasksAction(['task-1', 'task-linked'], 'ws-alpha');
    expect(res.success).toBe(true);
    expect(mockState.batchDeletes).toHaveLength(2);
  });
});
