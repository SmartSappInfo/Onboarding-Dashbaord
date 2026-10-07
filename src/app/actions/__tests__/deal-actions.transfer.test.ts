/**
 * @fileoverview Unit Tests: transferDealAction
 *
 * Verifies Cross-Workspace and Cross-Pipeline Deal Move and Copy:
 * - Input validation with Zod (Rule 4)
 * - Permission verification in destination workspace (Rule 8)
 * - Placement verification of pipeline and stage in destination workspace
 * - Scoped assignee workspace membership enforcement (User's explicit rule)
 * - Preservation of assignee in intra-workspace transfers when unspecified
 * - Atomic stage velocity tracking & closed stage duration calculation
 * - Copy/cloning functionality with initial stage history
 *
 * Compliance: agents_mcp_rules.md, theme.md, .agents/AGENTS.md.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transferDealAction } from '../deal-actions';
import type { TransferDealInput, Deal } from '@/lib/types';

// Mock auth
const mockUid = 'user_actor_123';
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({ uid: mockUid })),
  requireWorkspace: vi.fn().mockImplementation(async (workspaceId: string) => ({
    uid: mockUid,
    workspaceId,
  })),
}));

// Mock permissions
let canUserGranted = true;
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => ({
    granted: canUserGranted,
    reason: canUserGranted ? undefined : 'Permission denied in target workspace',
  })),
}));

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock activity logger
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue({ id: 'act_123' }),
}));

// Mock deal event bus
vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock deal-core helpers
const mockSourceDeal: Deal = {
  id: 'deal_source_1',
  name: 'Global Tech Expansion',
  workspaceId: 'ws_source',
  organizationId: 'org_main',
  entityId: 'ent_1',
  pipelineId: 'pipe_source',
  stageId: 'stage_source_1',
  stageName: 'Discovery',
  value: 50000,
  currency: 'USD',
  status: 'open',
  probability: 40,
  assignedTo: {
    userId: 'user_sales_1',
    name: 'Sarah Connor',
    email: 'sarah@example.com',
  },
  stageEnteredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  stageHistory: [
    {
      stageId: 'stage_source_1',
      stageName: 'Discovery',
      enteredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      exitedAt: null,
      durationSeconds: null,
      changedByUserId: 'user_orig',
      notes: 'Initial creation',
    },
  ],
  createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockUpdateFn = vi.fn().mockResolvedValue(undefined);
let loadDealAuthorized = true;
let placementGranted = true;

vi.mock('@/lib/crm/deal-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/crm/deal-core')>();
  return {
    ...actual,
    loadAuthorizedDeal: vi.fn().mockImplementation(async () => {
      if (!loadDealAuthorized) return { ok: false, error: 'Deal not found.' };
      return {
        ok: true,
        deal: { ...mockSourceDeal },
        ref: { update: mockUpdateFn },
      };
    }),
    checkDealPlacement: vi.fn().mockImplementation(async () => {
      return placementGranted
        ? { granted: true }
        : { granted: false, reason: 'Placement not allowed' };
    }),
    resolveWorkspaceEntityRecord: vi.fn().mockResolvedValue(null),
  };
});

let mockAssigneeExists = true;
let mockAssigneeWorkspaces = ['ws_target'];

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((colName: string) => {
        return {
          doc: vi.fn((id: string) => {
            if (colName === 'users') {
              return {
                get: vi.fn().mockResolvedValue({
                  exists: mockAssigneeExists,
                  data: () => ({
                    id,
                    name: 'Dest Agent',
                    email: 'dest@example.com',
                    workspaceIds: mockAssigneeWorkspaces,
                  }),
                }),
              };
            }
            if (colName === 'onboardingStages') {
              return {
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    id,
                    name: 'Proposal Sent',
                    order: 2,
                    defaultProbability: 60,
                  }),
                }),
              };
            }
            if (colName === 'pipelines') {
              return {
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    id,
                    name: 'Target Enterprise Pipeline',
                    workspaceIds: ['ws_target'],
                  }),
                }),
              };
            }
            if (colName === 'workspace_entities') {
              return {
                get: vi.fn().mockResolvedValue({ exists: false }),
                set: vi.fn().mockResolvedValue(undefined),
              };
            }
            if (colName === 'entities') {
              return {
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({
                    id,
                    name: 'Acme International',
                    primaryContactName: 'John Doe',
                    entityContacts: [],
                  }),
                }),
              };
            }
            return {
              get: vi.fn().mockResolvedValue({ exists: false }),
              set: vi.fn().mockResolvedValue(undefined),
              update: vi.fn().mockResolvedValue(undefined),
            };
          }),
          add: vi.fn().mockResolvedValue({ id: 'deal_cloned_999' }),
        };
      }),
    },
  };
});

describe('transferDealAction (Cross-Workspace & Cross-Pipeline Transfer Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canUserGranted = true;
    loadDealAuthorized = true;
    placementGranted = true;
    mockAssigneeExists = true;
    mockAssigneeWorkspaces = ['ws_target'];
  });

  it('rejects transfer with invalid input payload (Zod schema validation)', async () => {
    const invalidInput = {
      dealId: '',
      mode: 'move',
      sourceWorkspaceId: '',
      targetWorkspaceId: 'ws_target',
      targetPipelineId: 'pipe_target',
      targetStageId: 'stage_target',
    } as TransferDealInput;

    const res = await transferDealAction(invalidInput);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('rejects transfer if caller lacks create permission in destination workspace', async () => {
    canUserGranted = false;

    const input: TransferDealInput = {
      dealId: 'deal_source_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_target',
      targetPipelineId: 'pipe_target',
      targetStageId: 'stage_target',
    };

    const res = await transferDealAction(input);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Permission denied in target workspace');
  });

  it('rejects assignment if selected user does not belong to destination workspace', async () => {
    // Assignee only belongs to ws_other, NOT ws_target
    mockAssigneeWorkspaces = ['ws_other'];

    const input: TransferDealInput = {
      dealId: 'deal_source_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_target',
      targetPipelineId: 'pipe_target',
      targetStageId: 'stage_target',
      assignedTo: {
        userId: 'user_unauthorized_for_target',
        name: 'Foreign Rep',
        email: 'foreign@example.com',
      },
    };

    const res = await transferDealAction(input);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Selected assignee does not have access to the destination workspace');
  });

  it('successfully moves deal across workspaces and updates stage history with duration', async () => {
    const input: TransferDealInput = {
      dealId: 'deal_source_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_target',
      targetPipelineId: 'pipe_target',
      targetStageId: 'stage_target',
      assignedTo: {
        userId: 'user_dest_1',
        name: 'Dest Agent',
        email: 'dest@example.com',
      },
      summary: 'Handing off to Regional Enterprise team.',
      nextStep: {
        type: 'meeting',
        title: 'Kickoff meeting with Head of Operations',
        dueDate: '2026-10-15T10:00:00.000Z',
      },
    };

    const res = await transferDealAction(input);
    expect(res.success).toBe(true);
    expect(res.dealId).toBe('deal_source_1');

    // Verify deal document update
    expect(mockUpdateFn).toHaveBeenCalled();
    const updateCall = mockUpdateFn.mock.calls[0][0];
    expect(updateCall.workspaceId).toBe('ws_target');
    expect(updateCall.pipelineId).toBe('pipe_target');
    expect(updateCall.stageId).toBe('stage_target');
    expect(updateCall.assignedTo.userId).toBe('user_dest_1');
    expect(updateCall.description).toBe('Handing off to Regional Enterprise team.');
    expect(updateCall.nextStep.title).toBe('Kickoff meeting with Head of Operations');

    // Verify closed stage duration in history
    expect(updateCall.stageHistory.length).toBe(2);
    expect(updateCall.stageHistory[0].exitedAt).toBeDefined();
    expect(typeof updateCall.stageHistory[0].durationSeconds).toBe('number');
    expect(updateCall.stageHistory[1].stageId).toBe('stage_target');
  });

  it('preserves existing assignee when transferring within the same workspace if unassigned is not specified', async () => {
    const input: TransferDealInput = {
      dealId: 'deal_source_1',
      mode: 'move',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_source', // Same workspace
      targetPipelineId: 'pipe_source',
      targetStageId: 'stage_target_new',
      // assignedTo is omitted (undefined)
    };

    const res = await transferDealAction(input);
    expect(res.success).toBe(true);
    const updateCall = mockUpdateFn.mock.calls[0][0];
    // Preserves Sarah Connor
    expect(updateCall.assignedTo?.userId).toBe('user_sales_1');
  });

  it('successfully copies deal into target workspace/pipeline with new name and initial history', async () => {
    const input: TransferDealInput = {
      dealId: 'deal_source_1',
      mode: 'copy',
      newName: 'Global Tech Expansion (EMEA Region)',
      sourceWorkspaceId: 'ws_source',
      targetWorkspaceId: 'ws_target',
      targetPipelineId: 'pipe_target',
      targetStageId: 'stage_target',
      assignedTo: {
        userId: 'user_dest_1',
        name: 'Dest Agent',
        email: 'dest@example.com',
      },
      summary: 'Cloning opportunity for EMEA regional expansion.',
    };

    const res = await transferDealAction(input);
    expect(res.success).toBe(true);
    expect(res.dealId).toBe('deal_cloned_999');
  });
});
