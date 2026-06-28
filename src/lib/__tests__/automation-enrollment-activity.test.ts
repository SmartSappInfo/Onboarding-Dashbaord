// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAutomation } from '../automations/executor';
import { adminDb } from '../firebase-admin';

const { mockLogActivity } = vi.hoisted(() => ({
  mockLogActivity: vi.fn(),
}));

vi.mock('../activity-logger', () => ({
  logActivity: mockLogActivity,
}));

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockRunRef = {
  id: 'run-123',
  update: mockUpdate,
};
const mockAdd = vi.fn().mockResolvedValue(mockRunRef);
const mockWorkspaceGet = vi.fn();
const mockJobsGet = vi.fn();

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
      if (name === 'automation_runs') {
        return {
          add: mockAdd,
        };
      }
      if (name === 'automation_jobs') {
        return {
          where: vi.fn(() => ({
            where: vi.fn(() => ({
              get: mockJobsGet,
            })),
          })),
        };
      }
      return {
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue(undefined),
          update: vi.fn().mockResolvedValue(undefined),
        })),
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            })),
          })),
        })),
      };
    }),
  },
}));

vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./nodes/traverse', () => ({
  traverseNodes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./automation-lifecycle-notify', () => ({
  notifyAutomationStarted: vi.fn().mockResolvedValue(undefined),
  notifyAutomationCompleted: vi.fn().mockResolvedValue(undefined),
}));

describe('Automation Ingestion Activity Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs an activity of type automation_entered when a contact is added to an automation', async () => {
    mockWorkspaceGet.mockResolvedValue({
      exists: true,
      data: () => ({ organizationId: 'org-456' }),
    });

    mockJobsGet.mockResolvedValue({
      empty: true,
      docs: [],
    });

    const mockAutomation = {
      id: 'auto-123',
      name: 'Welcome Sequence',
      nodes: [
        { id: 'start-1', type: 'triggerNode', data: { trigger: 'TAG_ADDED' } }
      ],
      edges: [],
    };

    const triggerPayload = {
      entityId: 'contact-789',
      entityType: 'contact',
      workspaceId: 'ws-123',
      displayName: 'Jane Doe',
      _firingTrigger: 'TAG_ADDED',
    };

    await executeAutomation(mockAutomation, triggerPayload);

    // Verify workspace was looked up
    expect(mockWorkspaceGet).toHaveBeenCalled();
    
    // Verify run record was created in automation_runs
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      automationId: 'auto-123',
      automationName: 'Welcome Sequence',
      entityId: 'contact-789',
      workspaceId: 'ws-123',
    }));

    // Verify activity-logger was triggered for contact added to automation
    expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'automation_entered',
      description: 'Added to automation: "Welcome Sequence"',
      organizationId: 'org-456',
      workspaceId: 'ws-123',
      entityId: 'contact-789',
      entityType: 'contact',
      userId: 'system',
      displayName: 'Jane Doe',
      metadata: expect.objectContaining({
        isAutomation: true,
        automationId: 'auto-123',
        automationName: 'Welcome Sequence',
        runId: 'run-123',
        trigger: 'TAG_ADDED',
      }),
    }));
  });
});
