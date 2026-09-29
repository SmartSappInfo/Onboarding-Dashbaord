// @vitest-environment node
/**
 * @fileOverview Regression tests for stored task shapes (PR-0 review, 2026-09-29).
 *
 * The stored-task schema used to fail closed on every field, so a task written by the Tasks UI with
 * `relatedParentId: null` (or a legacy `organizationId: null` / `entityType: 'school'` / `title: null`)
 * could no longer be updated, completed or deleted: "Task not found." Only `workspaceId` — the field
 * authorization depends on — may fail closed. The DocSigning reverse hook must keep firing for tasks
 * that really are linked to an obligation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
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
      doc: (id: string) => ({
        get: async () => ({ exists: col(name).has(id), id, data: () => col(name).get(id) }),
        update: async (patch: Doc) => void col(name).set(id, { ...(col(name).get(id) ?? {}), ...patch }),
        delete: async () => void col(name).delete(id),
      }),
    }),
  },
}));
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn(async (entry: Record<string, unknown>) => void h.activity.push(entry)),
}));
vi.mock('@/lib/contact-adapter', () => ({ resolveContact: vi.fn(async () => null) }));
vi.mock('@/lib/workspace-permissions', () => ({ canUser: vi.fn(async () => ({ granted: true })) }));

const syncTaskCompletionToObligation = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/lib/documents/crm-deal-sync-service', () => ({ syncTaskCompletionToObligation }));

import { deleteTaskCore, getTaskWorkspaceId, updateTaskCore } from '../task-core';

const user = { kind: 'user' as const, uid: 'u1' };

beforeEach(() => {
  h.store.clear();
  h.activity = [];
  syncTaskCompletionToObligation.mockClear();
});

describe('tasks written by the Tasks UI (null links)', () => {
  beforeEach(() => {
    col('tasks').set('t-ui', {
      workspaceId: 'ws-a',
      organizationId: 'org-a',
      title: 'Call back',
      relatedEntityType: null,
      relatedParentId: null,
      relatedEntityId: null,
    });
  });

  it('can be found, updated, completed and deleted', async () => {
    await expect(getTaskWorkspaceId('t-ui')).resolves.toBe('ws-a');
    await expect(updateTaskCore('t-ui', { title: 'Renamed' }, user)).resolves.toEqual({ success: true });
    await expect(updateTaskCore('t-ui', { status: 'done' }, user)).resolves.toEqual({ success: true });
    await expect(deleteTaskCore('t-ui', user)).resolves.toEqual({ success: true });
  });

  it('does not call the obligation hook for unlinked tasks', async () => {
    await updateTaskCore('t-ui', { status: 'done' }, user);
    expect(syncTaskCompletionToObligation).not.toHaveBeenCalled();
  });
});

describe('legacy stored shapes', () => {
  it('tolerates null organization, an old entity type and a null title', async () => {
    col('tasks').set('t-legacy', { workspaceId: 'ws-a', organizationId: null, entityType: 'school', title: null, entityId: '' });
    await expect(updateTaskCore('t-legacy', { status: 'done' }, user)).resolves.toEqual({ success: true });
    expect(h.activity[0]).toMatchObject({ organizationId: '', workspaceId: 'ws-a', entityType: undefined, type: 'task_completed' });
  });

  it('still fails closed when the tenant field is missing or invalid', async () => {
    col('tasks').set('t-orphan', { workspaceId: '', title: 'x' });
    col('tasks').set('t-bad', { workspaceId: 42 });
    await expect(updateTaskCore('t-orphan', { status: 'done' }, user)).resolves.toEqual({ success: false, error: 'Task not found.' });
    await expect(deleteTaskCore('t-bad', user)).resolves.toEqual({ success: false, error: 'Task not found.' });
    await expect(getTaskWorkspaceId('missing')).resolves.toBeNull();
  });
});

describe('DocSigning reverse hook (linked tasks)', () => {
  it('fires with the STORED contract and obligation ids when a linked task is completed', async () => {
    col('tasks').set('t-linked', { workspaceId: 'ws-a', relatedParentId: 'contract-1', relatedEntityId: 'obligation-9' });
    await updateTaskCore('t-linked', { status: 'done', relatedParentId: 'contract-evil', relatedEntityId: 'ob-evil' }, user);
    expect(syncTaskCompletionToObligation).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      taskId: 't-linked',
      contractId: 'contract-1',
      obligationId: 'obligation-9',
      actorUserId: 'u1',
    });
  });
});
