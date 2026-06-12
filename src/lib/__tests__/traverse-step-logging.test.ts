// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { traverseNodes } from '../automations/nodes/traverse';

const mockLogStep = vi.fn();
const mockProcessAction = vi.fn();
const mockProcessTagAction = vi.fn();
const mockEvaluateCondition = vi.fn();
const mockEvaluateTagCondition = vi.fn();
const mockHandleDelay = vi.fn();

vi.mock('../automations/step-logger', () => ({
  logStepExecution: (...args: any[]) => mockLogStep(...args),
}));

vi.mock('../automations/actions', () => ({
  processActionNode: (...args: any[]) => mockProcessAction(...args),
}));

vi.mock('../automations/nodes/tag-nodes', () => ({
  evaluateTagConditionNode: (...args: any[]) => mockEvaluateTagCondition(...args),
  processTagActionNode: (...args: any[]) => mockProcessTagAction(...args),
}));

vi.mock('../automation-condition', () => ({
  evaluateConditionNode: (...args: any[]) => mockEvaluateCondition(...args),
}));

vi.mock('../automations/nodes/delay', () => ({
  handleDelayNode: (...args: any[]) => mockHandleDelay(...args),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false }),
      })),
    })),
  },
}));

describe('Traverse Step Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs triggerNode execution and actionNode execution success', async () => {
    const automation = {
      nodes: [
        { id: 't1', type: 'triggerNode', data: { label: 'Contact Created' } },
        { id: 'a1', type: 'actionNode', data: { label: 'Send Welcome Email', actionType: 'SEND_MESSAGE' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'a1' },
      ],
    };

    const context = {
      runId: 'run-1',
      automationId: 'auto-1',
      workspaceId: 'ws-1',
      payload: {},
    };

    mockProcessAction.mockResolvedValue(undefined);

    await traverseNodes('t1', automation, context);

    expect(mockLogStep).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        nodeId: 't1',
        nodeType: 'triggerNode',
        nodeLabel: 'Contact Created',
        status: 'success',
      })
    );

    expect(mockLogStep).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        nodeId: 'a1',
        nodeType: 'actionNode',
        nodeLabel: 'Send Welcome Email',
        status: 'success',
        metadata: { actionType: 'SEND_MESSAGE' },
      })
    );
  });

  it('logs actionNode failure status when processing throws', async () => {
    const automation = {
      nodes: [
        { id: 't1', type: 'triggerNode' },
        { id: 'a1', type: 'actionNode', data: { label: 'Send Webhook', actionType: 'TRIGGER_OUTBOUND_WEBHOOK' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'a1' },
      ],
    };

    const context = {
      runId: 'run-1',
      automationId: 'auto-1',
      workspaceId: 'ws-1',
      payload: {},
    };

    mockProcessAction.mockRejectedValue(new Error('Webhook timeout'));

    await expect(
      traverseNodes('t1', automation, context)
    ).rejects.toThrow('Node [Send Webhook] failed: Webhook timeout');

    expect(mockLogStep).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        nodeId: 'a1',
        status: 'failed',
        error: 'Webhook timeout',
      })
    );
  });

  it('logs conditionNode evaluation outcomes (true handle)', async () => {
    const automation = {
      nodes: [
        { id: 't1', type: 'triggerNode' },
        { id: 'c1', type: 'conditionNode', data: { label: 'Check Status' } },
        { id: 'a1', type: 'actionNode', data: { label: 'Active Action' } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'c1' },
        { id: 'e2', source: 'c1', sourceHandle: 'true', target: 'a1' },
        { id: 'e3', source: 'c1', sourceHandle: 'false', target: 'a2' },
      ],
    };

    const context = {
      runId: 'run-1',
      automationId: 'auto-1',
      workspaceId: 'ws-1',
      payload: {},
    };

    mockEvaluateCondition.mockResolvedValue(true);
    mockProcessAction.mockResolvedValue(undefined);

    await traverseNodes('c1', automation, context);

    expect(mockLogStep).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        nodeId: 'c1',
        nodeType: 'conditionNode',
        status: 'success',
        metadata: { evaluation: 'true' },
      })
    );
  });

  it('logs delayNode wait period as waiting', async () => {
    const automation = {
      nodes: [
        { id: 't1', type: 'triggerNode' },
        { id: 'd1', type: 'delayNode', data: { label: 'Wait 10 mins', config: { value: 10, unit: 'Minutes' } } },
      ],
      edges: [
        { id: 'e1', source: 't1', target: 'd1' },
      ],
    };

    const context = {
      runId: 'run-1',
      automationId: 'auto-1',
      workspaceId: 'ws-1',
      payload: {},
    };

    mockHandleDelay.mockResolvedValue(undefined);

    await traverseNodes('t1', automation, context);

    expect(mockLogStep).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        nodeId: 'd1',
        nodeType: 'delayNode',
        status: 'waiting',
        metadata: expect.objectContaining({
          delayUntil: expect.any(String),
        }),
      })
    );
  });

  it('logs delayNode as success on resumption', async () => {
    const automation = {
      nodes: [
        { id: 'd1', type: 'delayNode', data: { label: 'Wait 10 mins' } },
        { id: 'a1', type: 'actionNode', data: { label: 'Send email' } },
      ],
      edges: [
        { id: 'e1', source: 'd1', target: 'a1' },
      ],
    };

    const context = {
      runId: 'run-1',
      automationId: 'auto-1',
      workspaceId: 'ws-1',
      payload: {},
    };

    mockProcessAction.mockResolvedValue(undefined);

    // Starting traverse from the delay node represents resumption
    await traverseNodes('d1', automation, context);

    expect(mockLogStep).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        nodeId: 'd1',
        nodeType: 'delayNode',
        status: 'success',
        metadata: expect.objectContaining({
          resumedAt: expect.any(String),
        }),
      })
    );
  });
});
