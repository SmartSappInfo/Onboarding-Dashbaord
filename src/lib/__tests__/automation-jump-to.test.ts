import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traverseNodes } from '../automations/nodes/traverse';
import { evaluateContactJumps } from '../automations/jump-engine';
import { adminDb } from '../firebase-admin';
import { logStepExecution } from '../automations/step-logger';

// Mock Tag Enrichment
vi.mock('../automations/tag-enrichment', () => ({
  fetchLiveEntityTags: vi.fn().mockResolvedValue(['tag_hot']),
  nodeChecksTags: vi.fn().mockReturnValue(true),
}));

// Mock Dependencies
vi.mock('../firebase-admin', () => {
  const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(true),
  };
  const mockCollection = vi.fn().mockImplementation(() => ({
    doc: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ status: 'running', automationId: 'auto_123', payload: { tags: ['tag_hot'] } }),
      }),
      update: vi.fn().mockResolvedValue(true),
    })),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      empty: false,
      docs: [
        {
          id: 'run_123',
          data: () => ({
            status: 'running',
            automationId: 'auto_123',
            entityId: 'ent_123',
            entityType: 'institution',
            currentNodeId: 'node_1',
            payload: { tags: ['tag_hot'] },
          }),
        },
      ],
    }),
  }));

  return {
    adminDb: {
      collection: mockCollection,
      batch: vi.fn(() => mockBatch),
    },
  };
});

vi.mock('../automations/step-logger', () => ({
  logStepExecution: vi.fn(),
}));

vi.mock('../automations/nodes/delay', () => ({
  handleDelayNode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../automation-permissions', () => ({
  loadAutomationForAuth: vi.fn().mockResolvedValue({
    id: 'auto_123',
    isActive: true,
    nodes: [
      { id: 'node_1', type: 'triggerNode', data: { label: 'Trigger' } },
      {
        id: 'node_goal',
        type: 'jumpToNode',
        data: {
          label: 'Goal Met',
          config: {
            relation: 'and',
            groups: [
              {
                id: 'grp_1',
                relation: 'and',
                conditions: [
                  {
                    id: 'c_1',
                    field: 'tags',
                    operator: 'any_of',
                    value: ['tag_hot'],
                  },
                ],
              },
            ],
            jumpFromAnywhere: true,
            sequentialBehavior: 'wait',
          },
        },
      },
      { id: 'node_end', type: 'actionNode', data: { label: 'Action Node', actionType: 'SEND_NOTIFICATION_PUSH' } },
    ],
    edges: [
      { id: 'e1', source: 'node_1', target: 'node_goal' },
      { id: 'e2', source: 'node_goal', target: 'node_end' },
    ],
  }),
}));

describe('Automation Jump To Milestone Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('teleports contact to goal when conditions are met', async () => {
    const mockUpdate = vi.fn();
    const mockCommit = vi.fn().mockResolvedValue(true);
    
    vi.mocked(adminDb.batch).mockReturnValue({
      update: mockUpdate,
      commit: mockCommit,
    } as any);

    // Mock query result for evaluateContactJumps: returns active runs
    vi.mocked(adminDb.collection).mockImplementation((collectionName: string) => {
      if (collectionName === 'automation_runs') {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: 'run_123',
                ref: { id: 'run_123' },
                data: () => ({
                  status: 'running',
                  automationId: 'auto_123',
                  entityId: 'ent_123',
                  entityType: 'institution',
                  currentNodeId: 'node_1',
                  payload: { tags: ['tag_hot'] },
                }),
              },
            ],
          }),
        } as any;
      }
      if (collectionName === 'automation_jobs') {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: 'job_123',
                ref: { id: 'job_123' },
                data: () => ({ targetNodeId: 'node_goal' }),
              },
            ],
          }),
        } as any;
      }
      return {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      } as any;
    });

    await evaluateContactJumps('ent_123', 'ws_123');

    // Should update pending jobs to cancelled, update run doc currentNodeId to node_goal
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockCommit).toHaveBeenCalled();
    expect(logStepExecution).toHaveBeenCalledWith('run_123', expect.objectContaining({
      nodeId: 'node_goal',
      nodeType: 'jumpToNode',
      status: 'success',
    }));
  });

  it('holds contact at goal node sequentially if conditions are not met and behavior is wait', async () => {
    const mockUpdate = vi.fn();
    vi.mocked(adminDb.collection).mockImplementation(() => ({
      doc: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    }) as any);

    const automation = {
      id: 'auto_123',
      isActive: true,
      name: 'Test Automation',
      triggers: [],
      triggerTypes: [],
      workspaceIds: ['ws_123'],
      organizationId: 'org_123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user_123',
      nodes: [
        { id: 'node_1', type: 'triggerNode', data: { label: 'Trigger' } },
        {
          id: 'node_goal',
          type: 'jumpToNode',
          data: {
            label: 'Goal Met',
            config: {
              relation: 'and',
              groups: [
                {
                  id: 'grp_1',
                  relation: 'and',
                  conditions: [
                    {
                      id: 'c_1',
                      field: 'tags',
                      operator: 'any_of',
                      value: ['tag_cold'], // Payload does not match
                    },
                  ],
                },
              ],
              sequentialBehavior: 'wait',
            },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'node_1', target: 'node_goal' }],
    };

    const context = {
      entityId: 'ent_123',
      entityType: 'institution' as const,
      workspaceId: 'ws_123',
      payload: { tags: ['tag_hot'] }, // conditions not met since it checks tag_cold
      automationId: 'auto_123',
      runId: 'run_123',
      chainDepth: 0,
    };

    await traverseNodes('node_1', automation, context);

    // Step should be logged as waiting, and run document current node updated
    expect(logStepExecution).toHaveBeenCalledWith('run_123', expect.objectContaining({
      nodeId: 'node_goal',
      status: 'waiting',
    }));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      currentNodeId: 'node_goal',
    }));
  });
});
