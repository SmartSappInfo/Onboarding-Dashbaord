import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
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

const mockGetAll = vi.fn().mockResolvedValue([]);

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
    getAll: (...args: unknown[]) => mockGetAll(...args),
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

describe('Bulk Trigger API Endpoint', () => {
  const SECRET = process.env.CLOUD_TASKS_SECRET || 'local-secret';

  it('rejects requests with invalid secret signature', async () => {
    const req = new NextRequest('http://localhost/api/automations/bulk-trigger', {
      method: 'POST',
      headers: {
        'x-cloud-tasks-secret': 'invalid',
      },
      body: JSON.stringify({}),
    });
    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('verifies automation tenant mapping and blocks execution if mismatch', async () => {
    const mockAutomationData = {
      organizationId: 'org-auto',
      workspaceIds: ['ws-correct'],
      nodes: [{ id: 'start-1', type: 'triggerNode' }],
      edges: [],
    };
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'auto-111',
      data: () => mockAutomationData,
    });
    
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation((name: string) => {
      if (name === 'automations') {
        return {
          doc: vi.fn(() => ({
            get: mockGet,
          })),
        } as any;
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      } as any;
    });

    const req = new NextRequest('http://localhost/api/automations/bulk-trigger', {
      method: 'POST',
      headers: {
        'x-cloud-tasks-secret': SECRET,
      },
      body: JSON.stringify({
        automationId: 'auto-111',
        workspaceId: 'ws-correct',
        organizationId: 'org-different',
        trigger: 'ENTITY_CREATED',
        targets: [{ entityId: 'entity-1', entityType: 'contact', payload: {} }],
      }),
    });

    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized automation-workspace mapping');
  });

  it('filters out targets that do not exist or belong to a different workspace', async () => {
    vi.clearAllMocks();
    const mockAutomationData = {
      workspaceIds: ['ws-correct'],
      nodes: [{ id: 'start-1', type: 'triggerNode' }],
      edges: [],
    };
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      id: 'auto-111',
      data: () => mockAutomationData,
    });
    
    const { adminDb } = await import('../firebase-admin');
    vi.mocked(adminDb.collection).mockImplementation((name: string) => {
      if (name === 'automations') {
        return {
          doc: vi.fn(() => ({
            get: mockGet,
          })),
        } as any;
      }
      if (name === 'workspace_entities') {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue({
            forEach: (cb: any) => {
              cb({ data: () => ({ entityId: 'entity-correct', workspaceId: 'ws-correct' }) });
            },
          }),
        } as any;
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      } as any;
    });

    mockGetAll.mockResolvedValue([
      { exists: true, data: () => ({ workspaceId: 'ws-correct' }) },
      { exists: true, data: () => ({ workspaceId: 'ws-mismatch' }) },
    ]);

    const req = new NextRequest('http://localhost/api/automations/bulk-trigger', {
      method: 'POST',
      headers: {
        'x-cloud-tasks-secret': SECRET,
      },
      body: JSON.stringify({
        automationId: 'auto-111',
        workspaceId: 'ws-correct',
        organizationId: 'org-123',
        trigger: 'ENTITY_CREATED',
        targets: [
          { entityId: 'entity-correct', entityType: 'contact', payload: {} },
          { entityId: 'entity-mismatch', entityType: 'contact', payload: {} },
        ],
      }),
    });

    const { POST } = await import('../../app/api/automations/bulk-trigger/route');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const { executeAutomation } = await import('../automations/executor');
    expect(executeAutomation).toHaveBeenCalledTimes(1);
    expect(vi.mocked(executeAutomation).mock.calls[0][1].entityId).toBe('entity-correct');
  });
});
