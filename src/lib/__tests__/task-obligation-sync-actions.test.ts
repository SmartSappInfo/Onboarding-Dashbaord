// @vitest-environment node
/**
 * @fileOverview Unit tests for task obligation sync status persistence & retry action (Phase 5 / Roadmap §78).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  tasks: new Map<string, Record<string, unknown>>(),
  updates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  sessionUid: 'user-123',
  granted: true,
  syncSuccess: true,
  syncError: null as string | null,
}));

vi.mock('@/lib/firebase-admin', () => {
  const doc = (id: string) => ({
    get: async () => ({
      exists: h.tasks.has(id),
      id,
      data: () => h.tasks.get(id),
    }),
    update: async (data: Record<string, unknown>) => {
      const existing = h.tasks.get(id) || {};
      h.tasks.set(id, { ...existing, ...data });
      h.updates.push({ id, data });
    },
  });
  return {
    adminDb: {
      collection: () => ({
        doc,
      }),
    },
  };
});

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (wsId: string) => {
    if (wsId !== 'ws-valid') throw new Error('Unauthorized workspace');
    return { uid: h.sessionUid };
  }),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async () =>
    h.granted ? { granted: true } : { granted: false, reason: 'Permission denied.' }
  ),
}));

vi.mock('@/lib/documents/crm-deal-sync-service', () => ({
  syncTaskCompletionToObligation: vi.fn(async () => {
    if (!h.syncSuccess) {
      return { success: false, error: h.syncError || 'Sync failed' };
    }
    return { success: true };
  }),
}));

import { retryTaskObligationSyncAction } from '../task-server-actions';

describe('retryTaskObligationSyncAction (Phase 5 / Roadmap §78)', () => {
  beforeEach(() => {
    h.tasks.clear();
    h.updates.length = 0;
    h.granted = true;
    h.syncSuccess = true;
    h.syncError = null;
  });

  it('rejects unauthenticated or unauthorized workspace', async () => {
    const res = await retryTaskObligationSyncAction('ws-invalid', 'task-1');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it('rejects when user does not have edit permissions', async () => {
    h.granted = false;
    const res = await retryTaskObligationSyncAction('ws-valid', 'task-1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Permission denied.');
  });

  it('rejects non-existent tasks', async () => {
    const res = await retryTaskObligationSyncAction('ws-valid', 'task-missing');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Task not found.');
  });

  it('enforces TOCTOU concurrency check when expectedUpdatedAt mismatches', async () => {
    h.tasks.set('task-1', {
      id: 'task-1',
      workspaceId: 'ws-valid',
      relatedParentId: 'contract-1',
      relatedEntityId: 'obligation-1',
      updatedAt: '2026-10-09T10:00:00.000Z',
    });

    const res = await retryTaskObligationSyncAction(
      'ws-valid',
      'task-1',
      '2026-10-09T09:00:00.000Z'
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/modified concurrently/i);
  });

  it('returns idempotent cached success when task obligation is already synced', async () => {
    h.tasks.set('task-1', {
      id: 'task-1',
      workspaceId: 'ws-valid',
      relatedParentId: 'contract-1',
      relatedEntityId: 'obligation-1',
      obligationSyncStatus: 'synced',
      obligationSyncAt: '2026-10-09T08:00:00.000Z',
      updatedAt: '2026-10-09T08:00:00.000Z',
    });

    const res = await retryTaskObligationSyncAction('ws-valid', 'task-1');
    expect(res.success).toBe(true);
    expect(res.alreadySynced).toBe(true);
    expect(h.updates.length).toBe(0);
  });

  it('performs downstream sync and persists obligationSyncStatus as synced upon success', async () => {
    h.tasks.set('task-1', {
      id: 'task-1',
      workspaceId: 'ws-valid',
      relatedParentId: 'contract-1',
      relatedEntityId: 'obligation-1',
      obligationSyncStatus: 'failed',
      obligationSyncError: 'Network drop',
      updatedAt: '2026-10-09T08:00:00.000Z',
    });

    const res = await retryTaskObligationSyncAction('ws-valid', 'task-1');
    expect(res.success).toBe(true);
    expect(res.alreadySynced).toBe(false);

    const taskData = h.tasks.get('task-1');
    expect(taskData?.obligationSyncStatus).toBe('synced');
    expect(taskData?.obligationSyncError).toBeNull();
    expect(taskData?.obligationSyncAt).toBeDefined();
  });

  it('persists obligationSyncStatus as failed when downstream sync returns error', async () => {
    h.syncSuccess = false;
    h.syncError = 'Contract locked for amendment';

    h.tasks.set('task-1', {
      id: 'task-1',
      workspaceId: 'ws-valid',
      relatedParentId: 'contract-1',
      relatedEntityId: 'obligation-1',
      updatedAt: '2026-10-09T08:00:00.000Z',
    });

    const res = await retryTaskObligationSyncAction('ws-valid', 'task-1');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Contract locked for amendment');

    const taskData = h.tasks.get('task-1');
    expect(taskData?.obligationSyncStatus).toBe('failed');
    expect(taskData?.obligationSyncError).toBe('Contract locked for amendment');
  });
});
