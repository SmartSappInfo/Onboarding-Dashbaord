import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../automations/execution-types';
import type { TransferDealAutomationConfig } from '../types';

const mockTransferDealCore = vi.fn();

vi.mock('../deals/deal-transfer-core', () => ({
  transferDealCore: (...args: unknown[]) => mockTransferDealCore(...args),
}));

const mockResolveTemplateVariables = vi.fn().mockImplementation((str: string, ctx?: { extraVars?: Record<string, unknown> }) => {
  if (str.includes('{{deal_name}}')) {
    return str.replace('{{deal_name}}', String(ctx?.extraVars?.deal_name || ''));
  }
  return str;
});

vi.mock('../services/fields-variables-service-impl', () => ({
  FieldsVariablesService: {
    resolveTemplateVariables: (str: string, ctx: unknown) => mockResolveTemplateVariables(str, ctx),
  },
}));

vi.mock('../automations/workspace-resolver', () => ({
  resolveWorkspaceGuid: vi.fn().mockImplementation(async (wsId: string) => ({
    workspaceId: wsId === '__current__' ? 'ws_source_1' : wsId,
  })),
}));

const mockDocGet = vi.fn();
const mockCollectionGet = vi.fn();

const createMockQuery = () => {
  const queryObj: {
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  } = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: vi.fn().mockImplementation(() => mockCollectionGet()),
  };
  queryObj.where.mockReturnValue(queryObj);
  queryObj.orderBy.mockReturnValue(queryObj);
  queryObj.limit.mockReturnValue(queryObj);
  return queryObj;
};

const mockCollection = vi.fn().mockImplementation(() => {
  const queryObj = createMockQuery();
  return {
    ...queryObj,
    doc: vi.fn().mockImplementation((id: string) => ({
      id,
      get: vi.fn().mockImplementation(async () => {
        const res = await mockDocGet(id);
        return { id, ...res };
      }),
    })),
  };
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (...args: unknown[]) => mockCollection(...args),
  },
}));

import { handleTransferDeal } from '../automations/actions/deal-automation-actions';

describe('handleTransferDeal Automation Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransferDealCore.mockResolvedValue({
      success: true,
      dealId: 'deal_transferred_123',
    });
  });

  const baseConfig: TransferDealAutomationConfig = {
    mode: 'move',
    sourceWorkspaceId: '__current__',
    sourcePipelineId: '__all__',
    sourceStageId: '__all__',
    targetWorkspaceId: 'ws_target_2',
    targetPipelineId: 'pipe_target_1',
    targetStageId: 'stage_target_1',
    assignmentMode: 'preserve_or_unassigned',
    copyLineItems: true,
    copyContacts: true,
    copyCustomFields: true,
  };

  const baseContext: ExecutionContext = {
    automationId: 'auto_123',
    workspaceId: 'ws_source_1',
    organizationId: 'org_123',
    runId: 'run_abc',
    stepId: 'step_xyz',
    entityId: 'entity_456',
    payload: {
      dealId: 'deal_payload_1',
      contactId: 'contact_789',
    },
  };

  it('1. should resolve deal from context.payload.dealId when matching filters', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        workspaceId: 'ws_source_1',
        pipelineId: 'pipe_1',
        stageId: 'stage_1',
        name: 'Enterprise Contract',
      }),
    });

    const result = await handleTransferDeal(baseConfig, baseContext);

    expect(result.success).toBe(true);
    expect(result.dealId).toBe('deal_transferred_123');
    expect(result.mode).toBe('move');
    expect(result.targetWorkspaceId).toBe('ws_target_2');

    expect(mockTransferDealCore).toHaveBeenCalledTimes(1);
    const [actor, input] = mockTransferDealCore.mock.calls[0];
    expect(actor.kind).toBe('service');
    expect(actor.service).toBe('automations');
    expect(actor.allowedWorkspaceIds).toEqual(['ws_source_1', 'ws_target_2']);
    expect(input.dealId).toBe('deal_payload_1');
    expect(input.mode).toBe('move');
    expect(input.targetWorkspaceId).toBe('ws_target_2');
    expect(input.targetPipelineId).toBe('pipe_target_1');
    expect(input.targetStageId).toBe('stage_target_1');
    expect(input.idempotencyKey).toBe('auto_run_abc_step_xyz');
  });

  it('2. should fallback to querying context.entityId if payload.dealId is not provided', async () => {
    mockCollectionGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'deal_entity_open_1',
          data: () => ({
            workspaceId: 'ws_source_1',
            pipelineId: 'pipe_1',
            stageId: 'stage_1',
            name: 'Mid-Market Deal',
          }),
        },
      ],
    });

    const contextWithoutDealPayload: ExecutionContext = {
      ...baseContext,
      payload: {},
    };

    const result = await handleTransferDeal(baseConfig, contextWithoutDealPayload);

    expect(result.success).toBe(true);
    expect(result.dealId).toBe('deal_transferred_123');
    expect(mockTransferDealCore).toHaveBeenCalledTimes(1);
    expect(mockTransferDealCore.mock.calls[0][1].dealId).toBe('deal_entity_open_1');
  });

  it('3. should gracefully skip if no qualifying deal is found', async () => {
    // Payload deal does not exist
    mockDocGet.mockResolvedValueOnce({
      exists: false,
    });
    // Entity query returns empty
    mockCollectionGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const result = await handleTransferDeal(baseConfig, baseContext);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_qualifying_deal_found');
    expect(mockTransferDealCore).not.toHaveBeenCalled();
  });

  it('4. should guard against infinite loops when move target is identical to current placement', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        workspaceId: 'ws_target_2',
        pipelineId: 'pipe_target_1',
        stageId: 'stage_target_1',
        name: 'Already Here Deal',
      }),
    });

    const result = await handleTransferDeal(baseConfig, baseContext);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_at_destination');
    expect(mockTransferDealCore).not.toHaveBeenCalled();
  });

  it('5. should interpolate template tokens in newName when duplicating deal', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        workspaceId: 'ws_source_1',
        pipelineId: 'pipe_1',
        stageId: 'stage_1',
        name: 'Acme SaaS Deal',
      }),
    });

    const copyConfig: TransferDealAutomationConfig = {
      ...baseConfig,
      mode: 'copy',
      newName: '{{deal_name}} (Clone)',
    };

    const result = await handleTransferDeal(copyConfig, baseContext);

    expect(result.success).toBe(true);
    expect(result.mode).toBe('copy');
    expect(mockTransferDealCore).toHaveBeenCalledTimes(1);
    expect(mockTransferDealCore.mock.calls[0][1].newName).toBe('Acme SaaS Deal (Clone)');
  });

  it('6. should correctly pass specific user assignment configuration', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        workspaceId: 'ws_source_1',
        pipelineId: 'pipe_1',
        stageId: 'stage_1',
        name: 'Assigned Deal',
      }),
    });

    const assignConfig: TransferDealAutomationConfig = {
      ...baseConfig,
      assignmentMode: 'specific_user',
      targetUserId: 'user_456',
      targetUserName: 'Sarah Connor',
      targetUserEmail: 'sarah@example.com',
    };

    const result = await handleTransferDeal(assignConfig, baseContext);

    expect(result.success).toBe(true);
    expect(mockTransferDealCore).toHaveBeenCalledTimes(1);
    expect(mockTransferDealCore.mock.calls[0][1].assignedTo).toEqual({
      userId: 'user_456',
      name: 'Sarah Connor',
      email: 'sarah@example.com',
    });
  });

  it('7. should skip payload deal if it does not match configured pipeline and stage filters', async () => {
    // Deal is in stage_different
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        workspaceId: 'ws_source_1',
        pipelineId: 'pipe_1',
        stageId: 'stage_different',
        name: 'Mismatched Stage Deal',
      }),
    });

    // Fallback entity query returns empty
    mockCollectionGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const strictFilterConfig: TransferDealAutomationConfig = {
      ...baseConfig,
      sourcePipelineId: 'pipe_1',
      sourceStageId: 'stage_required',
    };

    const result = await handleTransferDeal(strictFilterConfig, baseContext);

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_qualifying_deal_found');
    expect(mockTransferDealCore).not.toHaveBeenCalled();
  });
});
