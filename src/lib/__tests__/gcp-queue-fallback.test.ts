import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleBulkTriggerTask } from '../gcp-tasks-client';

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({
        set: vi.fn().mockResolvedValue(true),
      }),
    }),
  },
}));

vi.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: class {
    queuePath() {
      return 'projects/test/locations/us-central1/queues/bulk';
    }
    taskPath() {
      return 'projects/test/locations/us-central1/queues/bulk/tasks/123';
    }
    createTask() {
      const err = new Error('5 NOT_FOUND: Queue does not exist. If you just created the queue, wait at least a minute for the queue to initialize.');
      (err as any).code = 5;
      return Promise.reject(err);
    }
  },
}));

describe('GCP Tasks Client Queue Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to local HTTP dispatch when GCP queue returns 5 NOT_FOUND', async () => {
    const taskKey = await scheduleBulkTriggerTask({
      automationId: 'auto-123',
      workspaceId: 'ws-123',
      organizationId: 'org-123',
      trigger: 'MANUAL_ENROLLMENT',
      targets: [
        {
          entityId: 'ent-1',
          entityType: 'institution',
          payload: {
            workspaceId: 'ws-123',
            startedBy: 'user-1',
            manualEnrollment: true,
            contactId: 'c-1',
            contactName: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            name: 'John Doe',
          },
        },
      ],
    });

    expect(taskKey).toBeDefined();
    expect(typeof taskKey).toBe('string');
    expect(taskKey.startsWith('bulk_trigger_')).toBe(true);
  });
});
