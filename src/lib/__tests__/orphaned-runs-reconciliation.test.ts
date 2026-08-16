import { describe, it, expect, vi, beforeEach } from 'vitest';
import { forceAdvanceRun } from '../automations/run-management';
import { adminDb } from '../firebase-admin';

vi.mock('../automations/nodes/traverse', () => ({
  traverseNodes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../firebase-admin', () => {
  const mockRun = {
    id: 'run_orphan_1',
    automationId: 'auto_100',
    workspaceId: 'ws_test',
    status: 'running',
    currentNodeId: 'node_deleted_wait',
    currentNodeLabel: 'Wait 5 Weeks (Step #1)',
    entityId: 'entity_1',
    entityType: 'person',
  };

  const mockAutomation = {
    id: 'auto_100',
    workspaceIds: ['ws_test'],
    name: 'Test Blueprint',
    nodes: [
      { id: 'node_trigger', type: 'triggerNode' },
      { id: 'node_next_action', type: 'actionNode', data: { label: 'Send Email' } },
    ],
    edges: [{ id: 'e1', source: 'node_trigger', target: 'node_next_action' }],
  };

  const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  return {
    adminDb: {
      batch: vi.fn(() => mockBatch),
      collection: vi.fn((colName: string) => {
        if (colName === 'automation_runs') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'run_orphan_1',
                data: () => mockRun,
              }),
              update: vi.fn().mockResolvedValue(undefined),
            })),
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              size: 1,
              docs: [{ id: 'run_orphan_1', data: () => mockRun }],
            }),
          };
        }
        if (colName === 'automations') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'auto_100',
                data: () => mockAutomation,
              }),
            })),
          };
        }
        if (colName === 'automation_jobs') {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          };
        }
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        };
      }),
    },
  };
});

vi.mock('../automation-permissions', () => ({
  assertAutomationManagePermission: vi.fn().mockResolvedValue(undefined),
}));

describe('orphaned-runs-reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resiliently advances orphaned run when pending job is missing', async () => {
    const result = await forceAdvanceRun('run_orphan_1', 'user_admin');
    expect(result.success).toBe(true);
  });
});
