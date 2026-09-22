import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPipelineWithStagesAction } from '@/lib/pipeline-actions';
import type { CreatePipelinePayload } from '@/lib/types';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'user-1' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

let batchSetCalls: Array<{ refId: string; data: Record<string, unknown> }> = [];

vi.mock('@/lib/firebase-admin', () => {
  let idCounter = 0;
  return {
    adminDb: {
      batch: vi.fn(() => ({
        set: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
          batchSetCalls.push({ refId: ref.id, data });
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id?: string) => {
          idCounter++;
          const finalId = id || `${name}-generated-${idCounter}`;
          return {
            id: finalId,
          };
        }),
      })),
    },
  };
});

describe('createPipelineWithStagesAction', () => {
  beforeEach(() => {
    batchSetCalls = [];
    vi.clearAllMocks();
  });

  it('validates pipeline name presence', async () => {
    const payload: CreatePipelinePayload = {
      name: '',
      workspaceIds: ['ws-1'],
    };
    const res = await createPipelineWithStagesAction(payload);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Pipeline name is required.');
    expect(batchSetCalls.length).toBe(0);
  });

  it('validates workspaceIds presence', async () => {
    const payload: CreatePipelinePayload = {
      name: 'Valid Name',
      workspaceIds: [],
    };
    const res = await createPipelineWithStagesAction(payload);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Pipeline must belong to at least one workspace.');
    expect(batchSetCalls.length).toBe(0);
  });

  it('atomically creates pipeline and starter stages in a single batch', async () => {
    const payload: CreatePipelinePayload = {
      name: 'Enterprise School District',
      description: 'Strategic deals for Q4',
      type: 'sales',
      workspaceIds: ['ws-1'],
      columnWidth: 340,
      showDealTotals: true,
      initialStages: [
        { name: 'Lead Qualified', order: 1, color: '#3b82f6', probability: 20 },
        { name: 'Proposal Sent', order: 2, color: '#f59e0b', probability: 60 },
        { name: 'Closed Won', order: 3, color: '#10b981', probability: 100, isWon: true },
      ],
    };

    const res = await createPipelineWithStagesAction(payload);
    expect(res.success).toBe(true);
    expect(res.id).toBeTruthy();

    // 3 stages + 1 pipeline = 4 batch.set calls
    expect(batchSetCalls.length).toBe(4);

    // 3 stage calls
    const stageCalls = batchSetCalls.filter(c => c.refId.startsWith('onboardingStages-'));
    expect(stageCalls.length).toBe(3);
    expect(stageCalls[0].data.name).toBe('Lead Qualified');
    expect(stageCalls[0].data.order).toBe(1);
    expect(stageCalls[0].data.pipelineId).toBe(res.id);
    expect(stageCalls[2].data.isWon).toBe(true);

    // 1 pipeline call
    const pipelineCall = batchSetCalls.find(c => c.refId === res.id);
    expect(pipelineCall).toBeDefined();
    expect(pipelineCall?.data.name).toBe('Enterprise School District');
    expect(pipelineCall?.data.type).toBe('sales');
    expect(pipelineCall?.data.showDealTotals).toBe(true);
    expect((pipelineCall?.data.stageIds as string[])?.length).toBe(3);
  });

  it('validates authorization for all provided workspaceIds', async () => {
    const { requireWorkspace } = await import('@/lib/auth/require-auth');
    const payload: CreatePipelinePayload = {
      name: 'Multi-Workspace Pipeline',
      workspaceIds: ['ws-1', 'ws-2', 'ws-3'],
    };
    const res = await createPipelineWithStagesAction(payload);
    expect(res.success).toBe(true);
    expect(requireWorkspace).toHaveBeenCalledWith('ws-1');
    expect(requireWorkspace).toHaveBeenCalledWith('ws-2');
    expect(requireWorkspace).toHaveBeenCalledWith('ws-3');
  });
});
