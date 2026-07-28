import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMessageStatusAutomations } from '../automations/message-status-automations';

// Mocks
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      mockCollection(colName);
      return {
        doc: (docId: string) => {
          mockDoc(docId);
          return {
            get: mockGet,
            set: mockSet,
            update: mockUpdate,
            ref: { update: mockUpdate },
          };
        },
        where: (...args: unknown[]) => {
          mockWhere(...args);
          return {
            where: (...args2: unknown[]) => {
              mockWhere(...args2);
              return {
                where: (...args3: unknown[]) => {
                  mockWhere(...args3);
                  return {
                    where: (...args4: unknown[]) => {
                      mockWhere(...args4);
                      return {
                        orderBy: (...ordArgs: unknown[]) => {
                          mockOrderBy(...ordArgs);
                          return {
                            limit: (lim: number) => {
                              mockLimit(lim);
                              return { get: mockGet };
                            },
                          };
                        },
                        get: mockGet,
                      };
                    },
                    orderBy: (...ordArgs: unknown[]) => {
                      mockOrderBy(...ordArgs);
                      return {
                        limit: (lim: number) => {
                          mockLimit(lim);
                          return { get: mockGet };
                        },
                      };
                    },
                    get: mockGet,
                  };
                },
                get: mockGet,
              };
            },
            get: mockGet,
          };
        },
      };
    },
  },
}));

vi.mock('../automation-log', () => ({
  logAutomationEvent: vi.fn(),
}));

const mockUpdateDealStageAction = vi.fn();
vi.mock('../../app/actions/deal-actions', () => ({
  updateDealStageAction: (...args: unknown[]) => mockUpdateDealStageAction(...args),
}));

const mockBulkCreateDealsAction = vi.fn();
vi.mock('../../app/actions/bulk-deal-actions', () => ({
  bulkCreateDealsAction: (...args: unknown[]) => mockBulkCreateDealsAction(...args),
}));

describe('executeMessageStatusAutomations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error if missing required parameters', async () => {
    const result = await executeMessageStatusAutomations({
      automationId: '',
      nodeId: 'node-1',
      eventStatus: 'opened',
      entityId: 'ent-1',
      workspaceId: 'ws-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required parameters.');
  });

  it('skips execution if idempotency document marks it as completed', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'completed' }),
    });

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-1',
      eventStatus: 'opened',
      entityId: 'ent-1',
      workspaceId: 'ws-1',
      runId: 'run-123',
    });

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(0);
    expect(result.skippedDuplicate).toBe(true);
  });

  it('transitions existing open deal to target stage on move_deal action', async () => {
    // 1. Idempotency record does not exist
    mockGet.mockResolvedValueOnce({ exists: false });

    // 2. Automation doc query returns matching node with move_deal status rule
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        nodes: [
          {
            id: 'node-msg-1',
            type: 'actionNode',
            data: {
              config: {
                statusRules: [
                  {
                    id: 'rule-click',
                    event: 'clicked',
                    enabled: true,
                    actions: [
                      {
                        id: 'act-move',
                        type: 'move_deal',
                        pipelineId: 'pipe-sales',
                        stageId: 'stage-demo-booked',
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      }),
    });

    // 3. Open deal query returns existing open deal in stage-initial
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'deal-active-99',
          data: () => ({ stageId: 'stage-initial', status: 'open' }),
        },
      ],
    });

    mockUpdateDealStageAction.mockResolvedValue({ success: true });
    mockSet.mockResolvedValue(undefined);

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-msg-1',
      eventStatus: 'clicked',
      entityId: 'ent-contact-42',
      workspaceId: 'ws-1',
      runId: 'run-555',
    });

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(mockUpdateDealStageAction).toHaveBeenCalledWith('deal-active-99', 'stage-demo-booked');
  });

  it('creates new deal at target stage when no open deal exists for entity on move_deal action', async () => {
    // 1. Idempotency record does not exist
    mockGet.mockResolvedValueOnce({ exists: false });

    // 2. Automation node config
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        nodes: [
          {
            id: 'node-msg-1',
            type: 'actionNode',
            data: {
              config: {
                statusRules: [
                  {
                    id: 'rule-open',
                    event: 'opened',
                    enabled: true,
                    actions: [
                      {
                        id: 'act-move',
                        type: 'move_deal',
                        pipelineId: 'pipe-sales',
                        stageId: 'stage-qualified',
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      }),
    });

    // 3. Open deal query returns empty
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    mockBulkCreateDealsAction.mockResolvedValue({ success: true, count: 1 });
    mockSet.mockResolvedValue(undefined);

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-msg-1',
      eventStatus: 'opened',
      entityId: 'ent-new-101',
      workspaceId: 'ws-1',
      runId: 'run-777',
      messageSubject: 'Welcome Email',
    });

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(mockBulkCreateDealsAction).toHaveBeenCalledWith({
      entityIds: ['ent-new-101'],
      workspaceId: 'ws-1',
      organizationId: '',
      pipelineId: 'pipe-sales',
      stageId: 'stage-qualified',
      dealNamePattern: '{{entityName}} - Opened Email',
      value: 0,
      assignmentStrategy: 'unassigned',
      contactId: 'ent-new-101',
      messageSubject: 'Welcome Email',
      messagePreviewText: undefined,
    });
  });
});
