import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resumeAutomationRun } from '../automations/resume';
import { adminDb } from '../firebase-admin';
import { traverseNodes } from '../automations/nodes/traverse';

// Mock traverseNodes
vi.mock('../automations/nodes/traverse', () => ({
  traverseNodes: vi.fn().mockResolvedValue(undefined),
}));

// Mock permissions
vi.mock('../automation-permissions', () => ({
  loadAutomationForAuth: vi.fn().mockResolvedValue({
    id: 'auto-1',
    isActive: true,
    nodes: [
      { id: 'node-msg', type: 'actionNode', data: { label: 'Send Email' } }
    ],
    edges: []
  }),
}));

// Mock firebase admin
const mockCollection = {
  doc: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ status: 'running', entityId: 'ent-1', entityType: 'person' })
    }),
    update: vi.fn().mockResolvedValue(undefined)
  }),
  where: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue({
    empty: true,
    docs: []
  })
};

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => mockCollection)
  }
}));

describe('resumeAutomationRun Resend Rerouting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves __resend_check__ to the message nodeId and invokes traverseNodes', async () => {
    const job = {
      id: 'job-1',
      automationId: 'auto-1',
      runId: 'run-1',
      targetNodeId: '__resend_check__',
      payload: {
        __resend: {
          nodeId: 'node-msg'
        }
      },
      status: 'pending' as const,
      executeAt: new Date().toISOString()
    };

    const success = await resumeAutomationRun(job);
    expect(success).toBe(true);

    // Verify traverseNodes was called with the resolved nodeId
    expect(traverseNodes).toHaveBeenCalledWith('node-msg', expect.any(Object), expect.any(Object));
  });
});
