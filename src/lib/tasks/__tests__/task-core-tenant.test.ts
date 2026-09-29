// @vitest-environment node
/**
 * @fileOverview Review-fix item 5 (agents_mcp Phase 1 §1.1a, Round 4).
 * A task's organization is ALWAYS its workspace's organization, never the caller's; activity for
 * updates is logged against the STORED task. Legacy automation paths without a workspace doc still work.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  seq: 0,
  activity: [] as Array<Record<string, unknown>>,
}));

function col(name: string): Map<string, Doc> {
  let c = h.store.get(name);
  if (!c) {
    c = new Map();
    h.store.set(name, c);
  }
  return c;
}

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => ({
      add: async (data: Doc) => {
        const id = `task-${++h.seq}`;
        col(name).set(id, { ...data });
        return { id };
      },
      doc: (id: string) => ({
        get: async () => ({ exists: col(name).has(id), id, data: () => col(name).get(id) }),
        update: async (patch: Doc) => void col(name).set(id, { ...(col(name).get(id) ?? {}), ...patch }),
      }),
    }),
  },
}));
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(async (entry: Record<string, unknown>) => void h.activity.push(entry)),
}));
vi.mock('@/lib/contact-adapter', () => ({ resolveContact: vi.fn(async () => null) }));
vi.mock('@/lib/workspace-permissions', () => ({ canUser: vi.fn(async () => ({ granted: true })) }));

import { createTaskCore, createTaskFromAutomation, updateTaskCore, type NewTaskInput } from '../task-core';

const base: NewTaskInput = {
  workspaceId: 'ws-a',
  title: 'Call back',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: 'general',
  dueDate: '2026-10-01',
  assignedTo: 'u1',
  reminders: [],
  reminderSent: false,
};

beforeEach(() => {
  h.store.clear();
  h.activity = [];
  col('workspaces').set('ws-a', { organizationId: 'org-a' });
});

describe('task organization is derived from the workspace', () => {
  it('ignores a caller-supplied foreign organization on create (user actor)', async () => {
    const res = await createTaskCore({ ...base, organizationId: 'org-victim' }, { kind: 'user', uid: 'u1' });
    expect(res.success).toBe(true);
    const stored = col('tasks').get(res.id ?? '');
    expect(stored?.organizationId).toBe('org-a');
    expect(h.activity[0]).toMatchObject({ organizationId: 'org-a', type: 'task_created' });
  });

  it('refuses a user actor on a workspace that does not exist', async () => {
    const res = await createTaskCore({ ...base, workspaceId: 'ws-missing' }, { kind: 'user', uid: 'u1' });
    expect(res).toEqual({ success: false, error: 'Workspace not found.' });
    expect(col('tasks').size).toBe(0);
  });

  it('keeps legacy system paths working when the workspace doc is missing', async () => {
    const res = await createTaskCore({ ...base, workspaceId: 'legacy', organizationId: 'org-l' }, { kind: 'system', source: 'form:f1' });
    expect(res.success).toBe(true);
    expect(col('tasks').get(res.id ?? '')?.organizationId).toBe('org-l');
  });

  it('automation tasks use the workspace organization over the supplied one', async () => {
    const id = await createTaskFromAutomation(base, 'org-wrong');
    expect(col('tasks').get(id)?.organizationId).toBe('org-a');
    expect(h.activity[0]).toMatchObject({ organizationId: 'org-a' });
  });
});

describe('update logs against the stored task', () => {
  it('logs completion with the stored organization and entity, not the payload', async () => {
    col('tasks').set('t1', { workspaceId: 'ws-a', organizationId: 'org-a', entityId: 'ent-1', entityType: 'person', title: 'Stored' });
    await updateTaskCore('t1', { status: 'done', organizationId: 'org-victim', entityId: 'ent-x' }, { kind: 'user', uid: 'u1' });

    expect(h.activity[0]).toMatchObject({ organizationId: 'org-a', entityId: 'ent-1', type: 'task_completed' });
    expect(h.activity[0].description).toContain('Stored');
    expect(col('tasks').get('t1')?.organizationId).toBe('org-a');
  });
});
