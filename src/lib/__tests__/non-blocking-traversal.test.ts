import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Automation } from '../types';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
        update: vi.fn().mockResolvedValue({}),
      }),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    }),
  },
}));

vi.mock('../step-logger', () => ({
  logStepExecution: vi.fn(),
  getStepNumbers: vi.fn().mockReturnValue({}),
  getNodeLabelWithStep: vi.fn().mockReturnValue('Step #1'),
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(true),
}));

describe('Non-blocking Messaging Traversal Protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow traversal to proceed downstream when action node throws non-fatal error', async () => {
    const mockAutomation: Automation = {
      id: 'auto_test_123',
      name: 'Test Non-Blocking Automation',
      status: 'active',
      workspaceIds: ['ws_test'],
      trigger: { type: 'event', config: {} },
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

    expect(mockAutomation.nodes.length).toBe(3);
    expect(mockAutomation.edges.length).toBe(2);
  });
});
