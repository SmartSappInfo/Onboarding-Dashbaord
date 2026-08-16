import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileParkedJobsOnNodeDeletion, getParkedJobsCount } from '../automations/node-deletion-reconciliation';
import { adminDb } from '../firebase-admin';

vi.mock('../firebase-admin', () => {
  const mockJobs = [
    { id: 'job_1', automationId: 'auto_100', targetNodeId: 'node_wait', runId: 'run_1', payload: { workspaceId: 'ws_test' } },
    { id: 'job_2', automationId: 'auto_100', targetNodeId: 'node_wait', runId: 'run_2', payload: { workspaceId: 'ws_test' } },
  ];

  const mockJobUpdate = vi.fn().mockResolvedValue(undefined);
  const mockRunUpdate = vi.fn().mockResolvedValue(undefined);

  return {
    adminDb: {
      collection: vi.fn((colName: string) => {
        if (colName === 'automation_jobs') {
          return {
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              empty: false,
              size: 2,
              docs: mockJobs.map((j) => ({
                id: j.id,
                data: () => j,
              })),
            }),
            doc: vi.fn(() => ({ update: mockJobUpdate })),
          };
        }
        if (colName === 'automation_runs') {
          return {
            doc: vi.fn(() => ({ update: mockRunUpdate })),
          };
        }
        if (colName === 'automations') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                id: 'auto_100',
                data: () => ({ name: 'Test Automation' }),
              }),
            })),
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

describe('node-deletion-reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches parked jobs count correctly for a node', async () => {
    const count = await getParkedJobsCount('auto_100', 'node_wait');
    expect(count).toBe(2);
  });

  it('reconciles parked jobs under fulfill_schedule strategy', async () => {
    const result = await reconcileParkedJobsOnNodeDeletion({
      automationId: 'auto_100',
      deletedNodeId: 'node_wait',
      workspaceId: 'ws_test',
      userId: 'user_admin',
      strategy: 'fulfill_schedule',
      nextStepIds: ['node_next_step'],
    });

    expect(result.success).toBe(true);
    expect(result.totalParked).toBe(2);
    expect(result.processedCount).toBe(2);
    expect(adminDb.collection).toHaveBeenCalledWith('automation_jobs');
  });

  it('reconciles parked jobs under cancel_runs strategy', async () => {
    const result = await reconcileParkedJobsOnNodeDeletion({
      automationId: 'auto_100',
      deletedNodeId: 'node_wait',
      workspaceId: 'ws_test',
      userId: 'user_admin',
      strategy: 'cancel_runs',
      nextStepIds: ['node_next_step'],
    });

    expect(result.success).toBe(true);
    expect(result.totalParked).toBe(2);
    expect(result.processedCount).toBe(2);
    expect(adminDb.collection).toHaveBeenCalledWith('automation_runs');
  });
});
