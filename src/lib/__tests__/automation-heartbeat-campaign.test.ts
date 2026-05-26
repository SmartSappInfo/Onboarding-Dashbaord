// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processScheduledJobsAction } from '../automation-processor';

const mockDispatchCampaign = vi.fn().mockResolvedValue(undefined);
const mockClaimJob = vi.fn();
const mockFinalizeJob = vi.fn().mockResolvedValue(undefined);
const mockFindDue = vi.fn();

vi.mock('../campaign-automation-dispatch', () => ({
  dispatchCampaignBlueprintTriggers: (...args: unknown[]) => mockDispatchCampaign(...args),
}));

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
  after: vi.fn((fn: () => void) => fn()),
}));

describe('Campaign job → heartbeat (P5-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims job transactionally and dispatches blueprint triggers', async () => {
    const campaignJob = {
      id: 'job-1',
      automationId: 'auto-hook',
      runId: '',
      targetNodeId: '__campaign_trigger__',
      payload: {
        entityId: 'ent-1',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        event: 'campaign_opened',
        campaignId: 'camp-1',
      },
      executeAt: new Date().toISOString(),
      status: 'pending',
    };

    const mockAutomation = {
      id: 'auto-hook',
      name: 'Hook Flow',
      trigger: 'CAMPAIGN_OPENED',
      isActive: true,
      workspaceIds: ['ws-1'],
      nodes: [
        { id: 't1', type: 'triggerNode', data: { trigger: 'CAMPAIGN_OPENED' } },
        { id: 'a1', type: 'actionNode', data: { actionType: 'ADD_NOTE', config: { content: 'ok' } } },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'a1' }],
    };

    mockFindDue.mockResolvedValue([campaignJob]);
    mockClaimJob.mockResolvedValue(campaignJob);
    mockGetAutomation.mockResolvedValue(mockAutomation);

    const { adminDb } = await import('../firebase-admin');
    (adminDb.collection as any).mockImplementation((name: string) => {
      if (name === 'automations') {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              id: 'auto-hook',
              data: () => mockAutomation,
            }),
          })),
        };
      }
      if (name === 'automation_runs') {
        return { add: vi.fn().mockResolvedValue({ id: 'run-1', update: vi.fn() }) };
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
    expect(mockClaimJob).toHaveBeenCalledWith('job-1');
    expect(mockFinalizeJob).toHaveBeenCalledWith('job-1', 'completed');
    expect(mockDispatchCampaign).toHaveBeenCalledWith({
      hookEvent: 'campaign_opened',
      payload: campaignJob.payload,
      excludeAutomationIds: ['auto-hook'],
    });
  });
});
