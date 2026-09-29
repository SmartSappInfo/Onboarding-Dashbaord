// @vitest-environment node
/**
 * @fileOverview Review-fix item 5 (agents_mcp Phase 1 §1.1a, Round 4): `/api/tasks` request bodies are
 * validated against an allowlist of writable Task fields. Tenant and identifier fields can never be
 * set or changed through the REST API; every legitimate writable field still gets through.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const core = vi.hoisted(() => ({
  createTaskCore: vi.fn(async () => ({ success: true as const, id: 't-new' })),
  updateTaskCore: vi.fn(async () => ({ success: true as const })),
  deleteTaskCore: vi.fn(async () => ({ success: true as const })),
  getTaskWorkspaceId: vi.fn(async () => 'ws-a'),
  getTasksForContactCore: vi.fn(async () => []),
}));
vi.mock('@/lib/tasks/task-core', () => core);
vi.mock('@/lib/auth/api-auth-guard', () => ({
  authenticateApiRequest: vi.fn(async () => ({ success: true, user: { uid: 'u1' } })),
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({ get: async () => ({ exists: true, id, data: () => ({ title: 'x' }) }) }),
    }),
  },
}));
vi.mock('@/lib/errors/report-error', () => ({ toClientErrorMessage: (_s: string, _e: unknown, _x: unknown, f: string) => f }));

import { POST } from '../route';
import { PATCH } from '../[taskId]/route';

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

const params = { params: Promise.resolve({ taskId: 't1' }) };

beforeEach(() => Object.values(core).forEach(fn => fn.mockClear()));

describe('POST /api/tasks', () => {
  it('drops tenant and unknown fields but keeps every writable field', async () => {
    const res = await POST(
      jsonRequest('http://x/api/tasks', 'POST', {
        workspaceId: 'ws-a',
        title: 'Call',
        entityId: 'ent-1',
        organizationId: 'org-victim',
        id: 'forged',
        createdAt: '2000-01-01',
        isAdmin: true,
        notes: [{ id: 'n1', content: 'hello', createdAt: '2026-09-01' }],
        dealId: 'deal-9',
        startDate: '2026-10-01',
        source: 'manual',
      })
    );
    expect(res.status).toBe(201);
    const [taskData] = core.createTaskCore.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(taskData).toMatchObject({ workspaceId: 'ws-a', title: 'Call', entityId: 'ent-1', dealId: 'deal-9', startDate: '2026-10-01', source: 'manual' });
    expect(taskData.notes).toEqual([{ id: 'n1', content: 'hello', createdAt: '2026-09-01' }]);
    expect(taskData).not.toHaveProperty('organizationId');
    expect(taskData).not.toHaveProperty('id');
    expect(taskData).not.toHaveProperty('createdAt');
    expect(taskData).not.toHaveProperty('isAdmin');
  });

  it('rejects invalid field types with 400 instead of writing them', async () => {
    const res = await POST(jsonRequest('http://x/api/tasks', 'POST', { workspaceId: 'ws-a', title: 'Call', entityId: 'e', priority: 'nuclear' }));
    expect(res.status).toBe(400);
    expect(core.createTaskCore).not.toHaveBeenCalled();
  });

  it('still requires workspaceId, title and entityId', async () => {
    const res = await POST(jsonRequest('http://x/api/tasks', 'POST', { title: 'Call' }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/tasks/[taskId]', () => {
  it('never changes identifiers or tenant fields (Requirement 3.2)', async () => {
    await PATCH(
      jsonRequest('http://x/api/tasks/t1', 'PATCH', {
        title: 'Renamed',
        status: 'done',
        entityId: 'ent-other',
        entityType: 'family',
        workspaceId: 'ws-b',
        organizationId: 'org-b',
        id: 'x',
        createdAt: 'y',
      }),
      params
    );
    const [, updates] = core.updateTaskCore.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(updates).toEqual({ title: 'Renamed', status: 'done' });
  });

  it('rejects invalid types with 400', async () => {
    const res = await PATCH(jsonRequest('http://x/api/tasks/t1', 'PATCH', { status: 'exploded' }), params);
    expect(res.status).toBe(400);
    expect(core.updateTaskCore).not.toHaveBeenCalled();
  });
});
