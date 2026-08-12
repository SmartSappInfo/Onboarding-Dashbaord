import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNodeDisabled, processActionNode } from '../automations/actions';
import { traverseNodes } from '../automations/nodes/traverse';
import type { Automation } from '../types';
import type { ExecutionContext } from '../automations/execution-types';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
        update: vi.fn().mockResolvedValue({}),
      })),
      add: vi.fn().mockResolvedValue({ id: 'mock-run-id' }),
    })),
  },
}));

vi.mock('../automations/step-logger', () => ({
  logStepExecution: vi.fn(),
}));

describe('Disabling Messaging Steps in Automations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly identifies disabled nodes via isNodeDisabled helper', () => {
    expect(isNodeDisabled({ data: { isDisabled: true } })).toBe(true);
    expect(isNodeDisabled({ data: { config: { isDisabled: true } } })).toBe(true);
    expect(isNodeDisabled({ data: { config: { disabled: true } } })).toBe(true);
    expect(isNodeDisabled({ data: { isDisabled: false } })).toBe(false);
    expect(isNodeDisabled({ data: {} })).toBe(false);
  });

  it('bypasses message firing when processActionNode encounters a disabled messaging node', async () => {
    const disabledNode = {
      id: 'node-send-sms',
      data: {
        label: 'Send SMS',
        actionType: 'SEND_SMS',
        isDisabled: true,
        config: {
          isDisabled: true,
          channel: 'sms',
          templateId: 'tmpl-123',
        },
      },
    };

    const context: ExecutionContext = {
      automationId: 'auto-test-1',
      workspaceId: 'onboarding',
      entityId: 'ent-1',
      runId: 'run-123',
      payload: { entityId: 'ent-1' },
      isTerminated: false,
    };

    const result = await processActionNode(disabledNode, context);

    expect(result).toBeDefined();
    expect(result?.skipped).toBe(true);
    expect(result?.isDisabled).toBe(true);
    expect(result?.messageId).toBeNull();
    expect(result?.status).toBe('bypassed');
  });

  it('traverses through disabled messaging nodes seamlessly without crashing downstream flow', async () => {
    const automation = {
      id: 'auto-test-1',
      name: 'Test Automation',
      isActive: true,
      workspaceIds: ['onboarding'],
      triggers: [{ id: 'trig-1', type: 'ENTITY_CREATED', config: {} }],
      nodes: [
        {
          id: 'node-trig',
          type: 'triggerNode',
          position: { x: 0, y: 0 },
          data: { label: 'Trigger' },
        },
        {
          id: 'node-msg-disabled',
          type: 'actionNode',
          position: { x: 0, y: 100 },
          data: {
            label: 'Send SMS',
            actionType: 'SEND_SMS',
            isDisabled: true,
          },
        },
        {
          id: 'node-next-action',
          type: 'actionNode',
          position: { x: 0, y: 200 },
          data: {
            label: 'Add Note',
            actionType: 'ADD_NOTE',
            config: { content: 'Auto-added note' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'node-trig', target: 'node-msg-disabled' },
        { id: 'e2', source: 'node-msg-disabled', target: 'node-next-action' },
      ],
    } as unknown as Automation;

    const context: ExecutionContext = {
      automationId: 'auto-test-1',
      workspaceId: 'onboarding',
      entityId: 'ent-1',
      runId: 'run-123',
      payload: { entityId: 'ent-1' },
      isTerminated: false,
    };

    await traverseNodes('node-msg-disabled', automation, context, true);

    expect(context.isTerminated).toBe(false);
    expect(context.payload['node-msg-disabled.skipped']).toBe(true);
    expect(context.payload['node-msg-disabled.isDisabled']).toBe(true);
  });
});
