// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processScheduledJobsAction } from '../automation-processor';

const mockClaimJob = vi.fn();
const mockFinalizeJob = vi.fn().mockResolvedValue(undefined);
const mockFindDue = vi.fn();
const mockGetAutomation = vi.fn();

vi.mock('../automations/repository', () => ({
  findDuePendingJobs: (...args: unknown[]) => mockFindDue(...args),
  claimAutomationJob: (...args: unknown[]) => mockClaimJob(...args),
  finalizeAutomationJob: (...args: unknown[]) => mockFinalizeJob(...args),
  getAutomationById: (...args: unknown[]) => mockGetAutomation(...args),
  findActiveAutomationsByTrigger: vi.fn(),
  getWorkspaceOrganizationId: vi.fn(),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: { collection: vi.fn() },
}));

vi.mock('next/server', () => ({
  after: vi.fn(),
}));

describe('Delay job resume (P5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resumes a delayed run and completes when no pending jobs remain', async () => {
    const delayNodeId = 'delay-1';
    const automation = {
      id: 'auto-1',
      name: 'Delayed Note',
      trigger: 'ENTITY_CREATED',
      isActive: true,
      workspaceIds: ['ws-1'],
      nodes: [
        { id: 't1', type: 'triggerNode', data: { trigger: 'ENTITY_CREATED' } },
        { id: delayNodeId, type: 'delayNode', data: { config: { value: 1, unit: 'Minutes' } } },
        {
          id: 'a1',
          type: 'actionNode',
          data: { actionType: 'ADD_NOTE', config: { content: 'After delay' } },
        },
      ],
      edges: [
        { id: 'e1', source: 't1', target: delayNodeId },
        { id: 'e2', source: delayNodeId, target: 'a1' },
      ],
    };

    const job = {
      id: 'job-delay-1',
      automationId: 'auto-1',
      runId: 'run-1',
      targetNodeId: delayNodeId,
      payload: { workspaceId: 'ws-1', entityId: 'ent-1', organizationId: 'org-1' },
      executeAt: new Date().toISOString(),
      status: 'pending',
    };

    mockFindDue.mockResolvedValue([job]);
    mockClaimJob.mockResolvedValue(job);
    mockGetAutomation.mockResolvedValue(automation);

    const runUpdate = vi.fn();
    const { adminDb } = await import('../firebase-admin');

    (adminDb.collection as any).mockImplementation((name: string) => {
      if (name === 'automations') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: true, id: 'auto-1', data: () => automation }),
          })),
        };
      }
      if (name === 'automation_runs') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'running' }) }),
            update: runUpdate,
          })),
        };
      }
      if (name === 'notes') {
        return { add: vi.fn().mockResolvedValue({ id: 'note-1' }) };
      }
      if (name === 'automation_jobs') {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        };
      }
      return {
        where: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        doc: vi.fn(() => ({ get: vi.fn(), update: vi.fn() })),
      };
    });

    const result = await processScheduledJobsAction();

    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
    expect(mockFinalizeJob).toHaveBeenCalledWith('job-delay-1', 'completed');
    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );
  });
});
