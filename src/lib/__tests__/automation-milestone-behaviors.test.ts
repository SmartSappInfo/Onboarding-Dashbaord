import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traverseNodes } from '../automations/nodes/traverse';
import { rescheduleMilestoneJobs } from '../automations/reschedule';
import { adminDb } from '../firebase-admin';
import { logStepExecution } from '../automations/step-logger';
import { scheduleDelayTask, cancelDelayTask } from '../gcp-tasks-client';

// Outer mock variables
const mockUpdate = vi.fn().mockResolvedValue(true);
const mockGet = vi.fn();
const mockBatch = {
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(true),
};

// Mock GCP tasks client
vi.mock('../gcp-tasks-client', () => ({
  scheduleDelayTask: vi.fn().mockResolvedValue({ id: 'task_123' }),
  cancelDelayTask: vi.fn().mockResolvedValue(true),
  parseQueueChannel: vi.fn().mockReturnValue('default'),
}));

// Mock Step Logger
vi.mock('../automations/step-logger', () => ({
  logStepExecution: vi.fn(),
}));

// Mock processActionNode to bypass database / external service calls in actionNode
vi.mock('../automations/actions', () => ({
  processActionNode: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Firebase Admin Db
vi.mock('../firebase-admin', () => {
  const mockCollection = vi.fn().mockImplementation((colName: string) => {
    return {
      doc: vi.fn().mockImplementation((docId: string) => {
        return {
          get: mockGet,
          update: mockUpdate,
          ref: { update: mockUpdate },
        };
      }),
      where: vi.fn().mockReturnThis(),
      get: mockGet,
    };
  });

  return {
    adminDb: {
      collection: mockCollection,
      batch: vi.fn(() => mockBatch),
    },
  };
});

// Mock Contact Adapter to avoid Firestore reads during traversal
vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue({
    id: 'ent_123',
    name: 'KAI Test',
    workspaceIds: ['prospect'],
  }),
}));

// Mock Automation Permissions
vi.mock('../automation-permissions', () => ({
  loadAutomationForAuth: vi.fn(),
}));

import { loadAutomationForAuth } from '../automation-permissions';

describe('Milestone Sequential Entry Behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockBatch.update.mockReset();
    mockBatch.commit.mockReset();
  });

  const baseAutomation = {
    id: 'auto_123',
    isActive: true,
    nodes: [
      { id: 'trigger_1', type: 'triggerNode', data: { label: 'Start' } },
      { id: 'milestone_1', type: 'jumpToNode', data: { config: { sequentialBehavior: 'wait' } } },
      { id: 'action_1', type: 'actionNode', data: { actionType: 'SEND_EMAIL' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger_1', target: 'milestone_1' },
      { id: 'e2', source: 'milestone_1', target: 'action_1' },
    ],
  } as any;

  const mockContext = {
    runId: 'run_123',
    automationId: 'auto_123',
    workspaceId: 'prospect',
    entityId: 'ent_123',
    payload: {},
  } as any;

  it('should park the run at milestone node if behavior is "wait"', async () => {
    const automation = { ...baseAutomation };
    automation.nodes[1].data.config.sequentialBehavior = 'wait';

    await traverseNodes('trigger_1', automation, mockContext);

    // Verify it logged 'waiting' on milestone_1
    expect(logStepExecution).toHaveBeenCalledWith(
      'run_123',
      expect.objectContaining({
        nodeId: 'milestone_1',
        nodeType: 'jumpToNode',
        status: 'waiting',
      })
    );

    // Verify it scheduled a far-future delay task for the milestone node
    expect(scheduleDelayTask).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run_123',
        nodeId: 'milestone_1',
      })
    );
  });

  it('should complete the sequence at milestone node if behavior is "exit"', async () => {
    const automation = { ...baseAutomation };
    automation.nodes[1].data.config.sequentialBehavior = 'exit';

    await traverseNodes('trigger_1', automation, mockContext);

    // Verify it logged 'success' on milestone_1 with exitSequence metadata
    expect(logStepExecution).toHaveBeenCalledWith(
      'run_123',
      expect.objectContaining({
        nodeId: 'milestone_1',
        status: 'success',
        metadata: expect.objectContaining({ exitSequence: true }),
      })
    );

    // Verify no delay task is scheduled
    expect(scheduleDelayTask).not.toHaveBeenCalled();
  });

  it('should traverse downstream past milestone node immediately if behavior is "proceed"', async () => {
    const automation = { ...baseAutomation };
    automation.nodes[1].data.config.sequentialBehavior = 'proceed';

    await traverseNodes('trigger_1', automation, mockContext);

    // Verify it traversed downstream and logged action_1 execution
    expect(logStepExecution).toHaveBeenCalledWith(
      'run_123',
      expect.objectContaining({
        nodeId: 'action_1',
        nodeType: 'actionNode',
      })
    );
  });
});

describe('Milestone Behavior Transition Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockBatch.update.mockReset();
    mockBatch.commit.mockReset();
  });

  it('should transition parked contacts downstream when behavior changes to "proceed"', async () => {
    // Mock the pending jobs query to return 1 job
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: 'job_123',
          ref: { update: mockUpdate },
          data: () => ({
            runId: 'run_123',
            workspaceId: 'prospect',
            payload: { email: 'joseph@smartsapp.com' },
          }),
        },
      ],
      size: 1,
    });

    // Mock get run details
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        entityId: 'ent_123',
        entityType: 'institution',
        payload: { email: 'joseph@smartsapp.com' },
        chainDepth: 1,
      }),
    });

    // Mock load automation
    const mockAutomation = {
      id: 'auto_123',
      isActive: true,
      nodes: [
        { id: 'milestone_1', type: 'jumpToNode', data: { config: { sequentialBehavior: 'proceed' } } },
        { id: 'action_1', type: 'actionNode', data: { actionType: 'SEND_EMAIL' } },
      ],
      edges: [
        { id: 'e2', source: 'milestone_1', target: 'action_1' },
      ],
    };
    vi.mocked(loadAutomationForAuth).mockResolvedValueOnce(mockAutomation as any);

    await rescheduleMilestoneJobs('auto_123', 'milestone_1', 'proceed', 'wait');

    // Verify it cancelled the pending job
    expect(cancelDelayTask).toHaveBeenCalledWith('run_123', 'milestone_1', 'default');

    // Verify downstream traverse started (logged action_1 success)
    expect(logStepExecution).toHaveBeenCalledWith(
      'run_123',
      expect.objectContaining({
        nodeId: 'action_1',
        nodeType: 'actionNode',
      })
    );
  });
});
