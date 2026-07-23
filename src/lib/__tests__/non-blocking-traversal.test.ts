import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traverseNodes } from '../automations/nodes/traverse';
import { healStrandedMessageContacts } from '../automations/healing';
import type { Automation } from '../types';
import type { ExecutionContext } from '../automations/execution-types';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'automations') {
        return {
          doc: (id: string) => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              id,
              data: () => ({
                id,
                name: 'Test Automation',
                workspaceIds: ['ws-123'],
                triggers: [],
                triggerTypes: ['MANUAL'],
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                nodes: [
                  { id: 'node-trigger', type: 'triggerNode' },
                  { id: 'node-email', type: 'actionNode', data: { actionType: 'SEND_EMAIL' } },
                  { id: 'node-delay', type: 'delayNode', data: { config: { waitType: 'period', duration: 1, unit: 'days' } } },
                ],
                edges: [
                  { id: 'e1', source: 'node-trigger', target: 'node-email' },
                  { id: 'e2', source: 'node-email', target: 'node-delay' },
                ],
              }),
            }),
          }),
        };
      }
      if (colName === 'automation_jobs') {
        return {
          where: () => ({
            where: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    {
                      id: 'job-stranded-1',
                      data: () => ({
                        automationId: 'auto-123',
                        runId: 'run-123',
                        targetNodeId: 'node-email',
                        sourceNodeId: 'node-email',
                        status: 'pending',
                        workspaceId: 'ws-123',
                        payload: { entityId: 'ent-1' },
                      }),
                    },
                  ],
                }),
              }),
            }),
          }),
          doc: () => ({
            set: vi.fn().mockResolvedValue(true),
            update: vi.fn().mockResolvedValue(true),
          }),
        };
      }
      if (colName === 'automation_runs') {
        return {
          doc: () => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ status: 'running' }),
            }),
            update: vi.fn().mockResolvedValue(true),
          }),
        };
      }
      return {
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue(true),
          update: vi.fn().mockResolvedValue(true),
        }),
      };
    },
    runTransaction: async (cb: (tx: any) => Promise<any>) => {
      return cb({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'pending' }) }),
        update: vi.fn(),
      });
    },
  },
}));

vi.mock('../automations/actions', () => ({
  processActionNode: vi.fn().mockResolvedValue({ status: 'sent', messageId: 'msg-123' }),
}));

vi.mock('../automations/nodes/delay', () => ({
  calculateExecuteAt: vi.fn().mockResolvedValue(new Date('2026-07-30T10:00:00Z')),
  handleDelayNode: vi.fn().mockResolvedValue(true),
}));

describe('Non-Blocking Traversal & Healing Protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('immediately traverses from an action node to the downstream delay node without halting', async () => {
    const automation: Automation = {
      id: 'auto-123',
      name: 'Test Flow',
      workspaceIds: ['ws-123'],
      triggers: [],
      triggerTypes: ['MANUAL'],
      isActive: true,
      createdBy: 'user-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'node-trigger', type: 'triggerNode' },
        { id: 'node-email', type: 'actionNode', data: { actionType: 'SEND_EMAIL' } },
        { id: 'node-delay', type: 'delayNode', data: { config: { waitType: 'period', duration: 1, unit: 'days' } } },
      ],
      edges: [
        { id: 'e1', source: 'node-trigger', target: 'node-email' },
        { id: 'e2', source: 'node-email', target: 'node-delay' },
      ],
    };

    const context: ExecutionContext = {
      entityId: 'ent-123',
      entityType: 'institution',
      workspaceId: 'ws-123',
      automationId: 'auto-123',
      runId: 'run-123',
      payload: {},
    };

    await traverseNodes('node-email', automation, context, true);

    const { handleDelayNode } = await import('../automations/nodes/delay');
    expect(handleDelayNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'node-delay' }),
      context
    );
  });

  it('runs the Fetch, Enrich & Restore protocol to advance stranded action jobs', async () => {
    const res = await healStrandedMessageContacts('ws-123');
    expect(res.success).toBe(true);
    expect(res.totalFound).toBe(1);
    expect(res.healedCount).toBe(1);
    expect(res.failedCount).toBe(0);
  });
});
