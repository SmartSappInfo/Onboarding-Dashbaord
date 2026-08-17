import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Automation } from '../types';
import type { ExecutionContext } from '../automations/execution-types';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
        update: vi.fn().mockResolvedValue({}),
      }),
      add: vi.fn().mockResolvedValue({ id: 'job_test_123' }),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    }),
  },
}));

const mockLogStepExecution = vi.fn();
vi.mock('../automations/step-logger', () => ({
  logStepExecution: (...args: unknown[]) => mockLogStepExecution(...args),
  getStepNumbers: vi.fn().mockReturnValue({}),
  getNodeLabelWithStep: vi.fn().mockReturnValue('Step #1'),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(true),
}));

vi.mock('../automations/actions', () => ({
  processActionNode: vi.fn().mockImplementation(async (node) => {
    if (node.id === 'action_email_1') {
      throw new Error('Email dispatch failed: Recipient bounced');
    }
    return { success: true };
  }),
}));

vi.mock('../automations/nodes/delay', () => ({
  handleDelayNode: vi.fn().mockResolvedValue(true),
  calculateExecuteAt: vi.fn().mockResolvedValue(new Date(Date.now() + 86400000)),
}));

import { traverseNodes } from '../automations/nodes/traverse';

describe('Non-blocking Messaging Traversal Protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow traversal to proceed downstream when action node throws non-fatal error', async () => {
    const mockAutomation: Automation = {
      id: 'auto_test_123',
      name: 'Test Non-Blocking Automation',
      workspaceIds: ['ws_test'],
      triggerTypes: ['ENTITY_CREATED'],
      triggers: [{ id: 'trig_1', type: 'ENTITY_CREATED', config: {} }],
      isActive: true,
      createdBy: 'user_1',
      nodes: [
        { id: 'trigger_1', type: 'triggerNode', data: { label: 'Trigger' }, position: { x: 0, y: 0 } },
        { id: 'action_email_1', type: 'actionNode', data: { actionType: 'send_email', label: 'Send Email' }, position: { x: 0, y: 100 } },
        { id: 'delay_1', type: 'delayNode', data: { label: 'Wait 1 Day' }, position: { x: 0, y: 200 } },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'action_email_1' },
        { id: 'e2', source: 'action_email_1', target: 'delay_1' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const context: ExecutionContext = {
      runId: 'run_test_123',
      automationId: mockAutomation.id,
      workspaceId: 'ws_test',
      entityId: 'entity_test_123',
      entityType: 'person',
      payload: {},
    };

    // Traversal should NOT throw when action_email_1 fails!
    await expect(traverseNodes('action_email_1', mockAutomation, context, true)).resolves.not.toThrow();

    // Verify step logging recorded failed status for action_email_1
    const failedCall = mockLogStepExecution.mock.calls.find(
      (call) => (call[1] as { nodeId?: string; status?: string }).nodeId === 'action_email_1'
    );
    expect(failedCall).toBeDefined();
    expect((failedCall![1] as { status: string }).status).toBe('failed');
    expect((failedCall![1] as { error?: string }).error).toContain('Recipient bounced');

    // Verify run context was NOT terminated
    expect(context.isTerminated).not.toBe(true);
  });
});
