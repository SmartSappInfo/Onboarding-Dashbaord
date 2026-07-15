import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerAutomationProtocols } from '../automations/orchestrator';
import { scheduleBulkTriggerTask } from '../gcp-tasks-client';

const mockFindActiveAutomations = vi.fn();
const mockWorkspaceGet = vi.fn();

vi.mock('../automations/repository', () => ({
  findActiveAutomationsByTrigger: (...args: unknown[]) => mockFindActiveAutomations(...args),
}));

vi.mock('../gcp-tasks-client', () => ({
  scheduleBulkTriggerTask: vi.fn().mockResolvedValue('task-mock'),
  getQueueName: () => 'default-delivery-queue',
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'workspaces') {
        return {
          doc: vi.fn(() => ({
            get: mockWorkspaceGet,
          })),
        };
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      };
    }),
  },
}));

vi.mock('../automations/executor', () => ({
  executeAutomation: vi.fn().mockResolvedValue(undefined),
}));

describe('Automation Ingestion Trigger Scaling', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate production environment to test queueing logic
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('queues bulk triggers when the batch size exceeds 5 items', async () => {
    const mockAutomation = {
      id: 'auto-456',
      name: 'Bulk Welcomer',
      nodes: [{ id: 'start-1', type: 'triggerNode' }],
      edges: [],
    };
    mockFindActiveAutomations.mockResolvedValue([mockAutomation]);
    mockWorkspaceGet.mockResolvedValue({
      exists: true,
      data: () => ({ organizationId: 'org-123' }),
    });

    const triggerPromises = [];
    // Trigger 10 times in rapid succession
    for (let i = 0; i < 10; i++) {
      triggerPromises.push(
        triggerAutomationProtocols('ENTITY_CREATED', {
          entityId: `contact-${i}`,
          entityType: 'contact',
          workspaceId: 'ws-123',
        })
      );
    }

    await Promise.all(triggerPromises);

    // Verify scheduleBulkTriggerTask was called
    expect(scheduleBulkTriggerTask).toHaveBeenCalled();
    const callArgs = vi.mocked(scheduleBulkTriggerTask).mock.calls[0][0];
    expect(callArgs.automationId).toBe('auto-456');
    expect(callArgs.workspaceId).toBe('ws-123');
    expect(callArgs.trigger).toBe('ENTITY_CREATED');
    expect(callArgs.targets.length).toBe(10);
    expect(callArgs.targets[0].entityId).toBe('contact-0');
  });
});
