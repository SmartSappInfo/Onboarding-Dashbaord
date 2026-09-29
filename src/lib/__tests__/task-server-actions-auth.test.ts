// @vitest-environment node
/**
 * @fileOverview Task auth hotfix tests (agents_mcp Phase 1 §1.1a / audit F2).
 * - Server Actions take identity from the session and authorize the task's STORED workspace.
 * - The `'system-'` userId bypass is gone from the public surface; only the core accepts a system actor.
 * - Tenant fields are immutable on update; bulk operations refuse tasks from other workspaces.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  tasks: new Map<string, Record<string, unknown>>(),
  members: new Map<string, string>(), // workspaceId -> uid allowed
  sessionUid: 'staff-1',
  granted: true,
  updates: [] as Array<{ id: string; data: Record<string, unknown> }>,
}));

vi.mock('@/lib/firebase-admin', () => {
  // `workspaces/*` exist with their org so the task core can derive the task organization.
  const workspaceDoc = (id: string) => ({ get: async () => ({ exists: true, data: () => ({ organizationId: `org-${id}` }) }) });
  const doc = (id: string) => ({
    get: async () => ({ exists: h.tasks.has(id), data: () => h.tasks.get(id) }),
    update: async (data: Record<string, unknown>) => void h.updates.push({ id, data }),
    delete: async () => void h.tasks.delete(id),
  });
  return {
    adminDb: {
      collection: (name: string) => ({ doc: name === 'workspaces' ? workspaceDoc : doc, add: async () => ({ id: 'new-task' }) }),
      batch: () => ({ update: vi.fn(), delete: vi.fn(), commit: async () => undefined }),
    },
  };
});

const requireWorkspace = vi.hoisted(() =>
  vi.fn(async (workspaceId: string) => {
    if (h.members.get(workspaceId) !== h.sessionUid) throw new Error('No access to this workspace.');
    return { uid: h.sessionUid };
  })
);
vi.mock('@/lib/auth/require-auth', () => ({ requireWorkspace }));

const canUser = vi.hoisted(() => vi.fn(async () => (h.granted ? { granted: true } : { granted: false, reason: 'Denied.' })));
vi.mock('@/lib/workspace-permissions', () => ({ canUser }));
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock('@/lib/contact-adapter', () => ({ resolveContact: vi.fn(async () => null) }));

import { bulkDeleteTasksAction, createTaskAction, updateTaskAction } from '../task-server-actions';
import { createTaskCore, type NewTaskInput } from '../tasks/task-core';

const newTask: NewTaskInput = {
  workspaceId: 'ws-a',
  title: 'Call back',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: 'general',
  dueDate: '2026-10-01',
  assignedTo: 'x',
  reminders: [],
  reminderSent: false,
};

beforeEach(() => {
  h.tasks.clear();
  h.members.clear();
  h.updates = [];
  h.sessionUid = 'staff-1';
  h.granted = true;
  h.members.set('ws-a', 'staff-1');
  h.tasks.set('t-a', { workspaceId: 'ws-a', organizationId: 'org-a' });
  h.tasks.set('t-b', { workspaceId: 'ws-b', organizationId: 'org-b' });
  canUser.mockClear();
  requireWorkspace.mockClear();
});

describe('task server actions', () => {
  it('create checks permission as the session user', async () => {
    await expect(createTaskAction(newTask)).resolves.toEqual({ success: true, id: 'new-task' });
    expect(canUser).toHaveBeenCalledWith('staff-1', 'operations', 'tasks', 'create', 'ws-a');
  });

  it('create refuses a workspace the session does not belong to', async () => {
    const res = await createTaskAction({ ...newTask, workspaceId: 'ws-b' });
    expect(res.success).toBe(false);
    expect(canUser).not.toHaveBeenCalled();
  });

  it('update authorizes the stored workspace, not the one in the payload', async () => {
    const res = await updateTaskAction('t-b', { title: 'x', workspaceId: 'ws-a' });
    expect(res.success).toBe(false);
    expect(requireWorkspace).toHaveBeenCalledWith('ws-b');
    expect(h.updates).toHaveLength(0);
  });

  it('update never rewrites tenant fields', async () => {
    await updateTaskAction('t-a', { title: 'x', workspaceId: 'ws-b', organizationId: 'org-b' });
    expect(h.updates[0].data).not.toHaveProperty('workspaceId');
    expect(h.updates[0].data).not.toHaveProperty('organizationId');
  });

  it('bulk delete refuses tasks outside the verified workspace', async () => {
    await expect(bulkDeleteTasksAction(['t-a', 't-b'], 'ws-a')).resolves.toEqual({
      success: false,
      error: 'Some tasks are not in this workspace.',
    });
    expect(h.tasks.has('t-a')).toBe(true);
  });
});

describe('task core actors', () => {
  it('system actors skip the user permission gate; user actors do not', async () => {
    h.granted = false;
    await expect(createTaskCore(newTask, { kind: 'system', source: 'form:f1' })).resolves.toMatchObject({ success: true });
    await expect(createTaskCore(newTask, { kind: 'user', uid: 'u1' })).resolves.toEqual({ success: false, error: 'Denied.' });
  });
});
