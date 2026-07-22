import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: 'test-doc-id',
          data: () => ({
            automationId: 'auto-123',
            workspaceId: 'ws-123',
            status: 'running',
            nodes: [
              { id: 'node-trigger', type: 'triggerNode', data: { label: 'Trigger' } },
              { id: 'node-email', type: 'messageNode', data: { label: 'Send Email' } },
              { id: 'node-delay', type: 'delayNode', data: { label: 'Wait 1 Day' } },
            ],
          }),
          ref: {
            update: vi.fn().mockResolvedValue(true),
          },
        }),
      })),
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        })),
        get: vi.fn().mockResolvedValue({
          empty: true,
          docs: [],
        }),
      })),
    })),
    batch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(true),
    })),
  },
  FieldValue: {
    delete: vi.fn(() => 'FIELD_DELETE'),
  },
}));

vi.mock('@/lib/automations/reschedule', () => ({
  purgeAllPendingJobsForRun: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/automations/engine', () => ({
  traverseNodes: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/automations/logging', () => ({
  logAutomationEvent: vi.fn(),
}));

vi.mock('@/lib/gcp-tasks-client', () => ({
  scheduleDelayTask: vi.fn().mockResolvedValue(true),
  cancelDelayTask: vi.fn().mockResolvedValue(true),
  parseQueueChannel: vi.fn().mockReturnValue('standard'),
}));

import {
  jumpRunToStep,
  rescheduleWaitJob,
  updateRunPayload,
  cleanAndVerifyRunContact,
  createContactFollowupTask,
} from '../automations/run-management';

describe('12 Contact Automation Operations Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('jumpRunToStep', () => {
    it('throws error if userId or targetNodeId is missing', async () => {
      const res = await jumpRunToStep('', 'node-email', '');
      expect(res.success).toBe(false);
      expect(res.error).toContain('User ID is required');
    });

    it('successfully jumps run to target node', async () => {
      const res = await jumpRunToStep('run-123', 'node-email', 'user-123');
      expect(res.success).toBe(true);
    });
  });

  describe('rescheduleWaitJob', () => {
    it('throws error if new execution time is missing', async () => {
      const res = await rescheduleWaitJob('job-123', '', 'user-123');
      expect(res.success).toBe(false);
      expect(res.error).toContain('New execution time is required');
    });

    it('reschedules wait job to new ISO timestamp', async () => {
      const futureIso = new Date(Date.now() + 86400000).toISOString();
      const res = await rescheduleWaitJob('job-123', futureIso, 'user-123');
      expect(res.success).toBe(true);
    });
  });

  describe('updateRunPayload', () => {
    it('updates run JSON payload', async () => {
      const res = await updateRunPayload('run-123', { first_name: 'Jane' }, 'user-123');
      expect(res.success).toBe(true);
    });
  });

  describe('cleanAndVerifyRunContact', () => {
    it('updates email and phone for contact', async () => {
      const res = await cleanAndVerifyRunContact(
        'run-123',
        'jane@gmail.com',
        '+1234567890',
        'user-123'
      );
      expect(res.success).toBe(true);
    });
  });

  describe('createContactFollowupTask', () => {
    it('creates follow-up task for contact', async () => {
      const res = await createContactFollowupTask(
        'ws-123',
        'contact-123',
        'assignee-123',
        'Manual Followup Required',
        'Failed step email delivery',
        'user-123'
      );
      expect(res.success).toBe(true);
    });
  });
});
