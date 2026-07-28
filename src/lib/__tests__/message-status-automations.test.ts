import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMessageStatusAutomations } from '../automations/message-status-automations';

// Mocks
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
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
            create: mockCreate,
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

// CAUTION: FieldsVariablesService must be mocked before message-status-automations
// imports it at the module level, otherwise tests will fail on initialization.
vi.mock('../services/fields-variables-service-impl', () => ({
  FieldsVariablesService: {
    resolveTemplateVariables: vi.fn((text: string) => Promise.resolve(text)),
  },
}));

const mockUpdateDealStageAction = vi.fn();
vi.mock('../../app/actions/deal-actions', () => ({
  updateDealStageAction: (...args: unknown[]) => mockUpdateDealStageAction(...args),
}));

const mockBulkCreateDealsAction = vi.fn();
vi.mock('../../app/actions/bulk-deal-actions', () => ({
  bulkCreateDealsAction: (...args: unknown[]) => mockBulkCreateDealsAction(...args),
}));

const mockBulkCreateTasksAction = vi.fn();
vi.mock('../../app/actions/bulk-task-actions', () => ({
  bulkCreateTasksAction: (...args: unknown[]) => mockBulkCreateTasksAction(...args),
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

  // ATOMIC DEDUP LOCK TESTS
  // The new pattern uses dedupRef.create() which throws error code 6 (ALREADY_EXISTS)
  // if the document exists. This is more robust than the old get()+set() pattern.
  it('skips execution when atomic create throws ALREADY_EXISTS (code 6)', async () => {
    // Simulate Firestore create() throwing ALREADY_EXISTS
    mockCreate.mockRejectedValueOnce({ code: 6, message: 'ALREADY_EXISTS' });

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
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('propagates non-ALREADY_EXISTS errors from atomic create', async () => {
    // Simulate a non-dedup Firestore error (e.g. permission denied)
    mockCreate.mockRejectedValueOnce({ code: 7, message: 'PERMISSION_DENIED' });

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-1',
      eventStatus: 'opened',
      entityId: 'ent-1',
      workspaceId: 'ws-1',
      runId: 'run-err',
    });

    // Non-dedup errors should propagate and return as error
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('transitions existing open deal to target stage on move_deal action', async () => {
    // 1. Atomic dedup create succeeds (no duplicate)
    mockCreate.mockResolvedValueOnce(undefined);

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
    mockUpdate.mockResolvedValue(undefined);

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-msg-1',
      eventStatus: 'clicked',
      entityId: 'ent-contact-42',
      workspaceId: 'ws-1',
      organizationId: 'org-abc',
      runId: 'run-555',
    });

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(mockUpdateDealStageAction).toHaveBeenCalledWith('deal-active-99', 'stage-demo-booked');
    // Verify dedup record was updated to 'completed' (not created again)
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('creates new deal at target stage when no open deal exists and forwards organizationId', async () => {
    // 1. Atomic dedup create succeeds
    mockCreate.mockResolvedValueOnce(undefined);

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
    mockUpdate.mockResolvedValue(undefined);

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-msg-1',
      eventStatus: 'opened',
      entityId: 'ent-new-101',
      workspaceId: 'ws-1',
      organizationId: 'org-xyz',
      runId: 'run-777',
      messageSubject: 'Welcome Email',
    });

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    // CRITICAL ASSERTION: organizationId must be forwarded, not hardcoded as ''
    expect(mockBulkCreateDealsAction).toHaveBeenCalledWith({
      entityIds: ['ent-new-101'],
      workspaceId: 'ws-1',
      organizationId: 'org-xyz',
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

  it('forwards organizationId to bulkCreateTasksAction on create_task action', async () => {
    // 1. Atomic dedup create succeeds
    mockCreate.mockResolvedValueOnce(undefined);

    // 2. Automation node config with create_task rule
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
                    id: 'rule-bounce',
                    event: 'bounced',
                    enabled: true,
                    actions: [
                      {
                        id: 'act-task',
                        type: 'create_task',
                        taskTitle: 'Follow up: {{entityName}} delivery failed',
                        taskDescription: 'Message bounced',
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

    mockBulkCreateTasksAction.mockResolvedValue({ success: true, count: 1 });
    mockUpdate.mockResolvedValue(undefined);

    const result = await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-msg-1',
      eventStatus: 'bounced',
      entityId: 'ent-bounce-1',
      workspaceId: 'ws-1',
      organizationId: 'org-tenant-5',
      runId: 'run-bounce',
    });

    expect(result.success).toBe(true);
    expect(result.executedCount).toBe(1);
    // CRITICAL: organizationId must be forwarded, not hardcoded as ''
    expect(mockBulkCreateTasksAction).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-tenant-5',
        workspaceId: 'ws-1',
      })
    );
  });

  it('defaults organizationId to empty string when not provided', async () => {
    // 1. Atomic dedup create succeeds
    mockCreate.mockResolvedValueOnce(undefined);

    // 2. Automation node config with move_deal
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
                        stageId: 'stage-q',
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

    // 3. No open deals
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    mockBulkCreateDealsAction.mockResolvedValue({ success: true, count: 1 });
    mockUpdate.mockResolvedValue(undefined);

    await executeMessageStatusAutomations({
      automationId: 'auto-1',
      nodeId: 'node-msg-1',
      eventStatus: 'opened',
      entityId: 'ent-1',
      workspaceId: 'ws-1',
      // NOTE: organizationId intentionally omitted to test default behavior
      runId: 'run-default',
    });

    // Should default to '' when omitted
    expect(mockBulkCreateDealsAction).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '',
      })
    );
  });
});
