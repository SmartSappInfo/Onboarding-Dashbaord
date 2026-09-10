import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resendFailedMessageAction, bulkResendFailedMessagesAction } from '../automation-actions';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            workspaceId: 'ws-123',
            automationId: 'auto-123',
            status: 'failed',
            recipient: 'test@example.com',
            body: 'Hello',
          }),
        }),
      })),
    })),
  },
}));

vi.mock('@/lib/automation-permissions', () => ({
  assertAutomationManagePermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/automations/run-management', () => ({
  resendFailedMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/gcp-tasks-client', () => ({
  scheduleBulkResendMessagesTask: vi.fn().mockResolvedValue({ success: true, taskId: 'task-123' }),
}));

describe('Message Retry & Bulk Actions Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // This used to assert that the action rejected an empty userId ARGUMENT. That check
  // was never a security control: a caller who could omit the id could equally supply
  // someone else's. The action now derives identity from the verified session and
  // discards whatever the caller passed (audit F2), so an empty argument is simply
  // irrelevant — which is what this asserts.
  it('resendFailedMessageAction ignores a caller-supplied identity', async () => {
    const res = await resendFailedMessageAction('log-123', '');
    expect(res.success).toBe(true);
  });

  it('resendFailedMessageAction successfully executes retry', async () => {
    const res = await resendFailedMessageAction('log-123', 'user-123');
    expect(res.success).toBe(true);
  });

  it('bulkResendFailedMessagesAction schedules background task', async () => {
    const res = await bulkResendFailedMessagesAction('auto-123', 'ws-123', 'user-123', ['log-1', 'log-2']);
    expect(res.success).toBe(true);
  });
});
