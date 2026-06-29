import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSendNotification } from '../automations/actions/notification-actions';
import type { ExecutionContext } from '../automations/execution-types';

/**
 * Behavior coverage for the SEND_NOTIFICATION_* automation steps
 * (handleSendNotification). These guard the two bugs fixed previously:
 *  - in-app notifications must be written to `in_app_notifications` with the
 *    canonical shape consumed by NotificationCenter (NOT the dead `notifications`
 *    collection, NOT `message`/`status` fields)
 *  - push must dispatch via OneSignal (NOT the unconsumed `push_queue`)
 * plus: email/sms route through sendMessage, and failures are logged (not thrown).
 */

const mockSendMessage = vi.fn().mockResolvedValue({ success: true, logId: 'log-1' });
const mockSendPush = vi.fn().mockResolvedValue({ id: 'os-1', recipients: 1 });
const mockResolveContact = vi.fn().mockResolvedValue(null);
const mockLogAutomationEvent = vi.fn();

vi.mock('../messaging-engine', () => ({
  sendMessage: (args: Record<string, unknown>) => mockSendMessage(args),
}));

vi.mock('../onesignal-service', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPush(...args),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: (id: string, wsId: string) => mockResolveContact(id, wsId),
}));

vi.mock('../automation-log', () => ({
  logAutomationEvent: (...args: unknown[]) => mockLogAutomationEvent(...args),
}));

// Firestore mock — records add() per collection so we can assert routing.
const inAppAdd = vi.fn().mockResolvedValue({ id: 'notif-1' });
const pushQueueAdd = vi.fn().mockResolvedValue({ id: 'pq-1' });
const legacyNotificationsAdd = vi.fn().mockResolvedValue({ id: 'legacy-1' });

const TEMPLATE = { subject: 'Heads up {{name}}', body: 'Body for {{name}}', channel: 'email' };
const USERS: Record<string, { email?: string; phone?: string }> = {
  'user-1': { email: 'u1@team.com', phone: '+233200000001' },
  'user-2': { email: 'u2@team.com', phone: '+233200000002' },
};

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'message_templates') {
        return { doc: () => ({ get: async () => ({ exists: true, data: () => TEMPLATE }) }) };
      }
      if (name === 'workspaces') {
        return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ organizationId: 'org-1' }) }) }) };
      }
      if (name === 'users') {
        return { doc: (uid: string) => ({ get: async () => ({ exists: !!USERS[uid], data: () => USERS[uid] }) }) };
      }
      if (name === 'in_app_notifications') return { add: inAppAdd };
      if (name === 'push_queue') return { add: pushQueueAdd };
      if (name === 'notifications') return { add: legacyNotificationsAdd };
      return { doc: () => ({ get: async () => ({ exists: false }) }), add: vi.fn() };
    }),
  },
}));

const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  automationId: 'auto-1',
  runId: 'run-1',
  workspaceId: 'ws-1',
  entityId: 'ent-1',
  entityType: 'institution',
  organizationId: 'org-1',
  payload: { name: 'Kofi' },
  ...overrides,
});

describe('handleSendNotification (SEND_NOTIFICATION_*)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, logId: 'log-1' });
    mockSendPush.mockResolvedValue({ id: 'os-1', recipients: 1 });
    mockResolveContact.mockResolvedValue(null);
  });

  it('returns early (no template fetch) when templateId is missing', async () => {
    await handleSendNotification('SEND_NOTIFICATION_EMAIL', { notificationTargets: ['users'], notificationUserIds: ['user-1'] }, ctx());
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('returns early when no targets are selected', async () => {
    await handleSendNotification('SEND_NOTIFICATION_EMAIL', { templateId: 'tmpl-1', notificationTargets: [] }, ctx());
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('EMAIL: sends to selected team members via sendMessage with the org default sender', async () => {
    await handleSendNotification(
      'SEND_NOTIFICATION_EMAIL',
      { templateId: 'tmpl-1', notificationTargets: ['users'], notificationUserIds: ['user-1', 'user-2'] },
      ctx(),
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'tmpl-1', senderProfileId: 'default', organizationId: 'org-1', recipient: 'u1@team.com' }),
    );
  });

  it('EMAIL: resolves the workspace assignee through resolveContact', async () => {
    mockResolveContact.mockResolvedValueOnce({ assignedTo: { userId: 'user-2', name: null, email: null } });
    await handleSendNotification(
      'SEND_NOTIFICATION_EMAIL',
      { templateId: 'tmpl-1', notificationTargets: ['assignee'] },
      ctx(),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'u2@team.com' }));
  });

  it('IN_APP: writes to in_app_notifications with the canonical shape (regression guard)', async () => {
    await handleSendNotification(
      'SEND_NOTIFICATION_IN_APP',
      { templateId: 'tmpl-1', notificationTargets: ['users'], notificationUserIds: ['user-1'] },
      ctx(),
    );
    expect(inAppAdd).toHaveBeenCalledTimes(1);
    expect(legacyNotificationsAdd).not.toHaveBeenCalled(); // never the dead `notifications` collection
    const doc = inAppAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(doc).toMatchObject({
      userId: 'user-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      category: 'automations',
      isRead: false,
    });
    expect(doc.body).toBeDefined();   // canonical `body`, not `message`
    expect(doc.title).toBeDefined();
    expect(doc).not.toHaveProperty('message');
    expect(doc).not.toHaveProperty('status');
  });

  it('PUSH: dispatches via OneSignal and never touches the unconsumed push_queue (regression guard)', async () => {
    await handleSendNotification(
      'SEND_NOTIFICATION_PUSH',
      { templateId: 'tmpl-1', notificationTargets: ['users'], notificationUserIds: ['user-1', 'user-2'] },
      ctx(),
    );
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    const [userIds] = mockSendPush.mock.calls[0];
    expect(userIds).toEqual(['user-1', 'user-2']);
    expect(pushQueueAdd).not.toHaveBeenCalled();
  });

  it('SMS: routes phone recipients through sendMessage', async () => {
    await handleSendNotification(
      'SEND_NOTIFICATION_SMS',
      { templateId: 'tmpl-1', notificationTargets: ['users'], notificationUserIds: ['user-1'] },
      ctx(),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ recipient: '+233200000001' }));
  });

  it('CUSTOM: routes a custom email destination', async () => {
    await handleSendNotification(
      'SEND_NOTIFICATION_EMAIL',
      { templateId: 'tmpl-1', notificationTargets: ['custom'], customRecipient: 'ext@partner.com' },
      ctx(),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'ext@partner.com' }));
  });

  it('logs (does not throw) when an email notification send fails', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: 'no EMAIL sender configured' });
    await expect(
      handleSendNotification(
        'SEND_NOTIFICATION_EMAIL',
        { templateId: 'tmpl-1', notificationTargets: ['users'], notificationUserIds: ['user-1'] },
        ctx(),
      ),
    ).resolves.toBeUndefined();
    expect(mockLogAutomationEvent).toHaveBeenCalledWith(
      'error',
      'notification_dispatch_failed',
      expect.objectContaining({ channel: 'email', error: 'no EMAIL sender configured' }),
    );
  });

  it('logs (does not throw) when push dispatch fails', async () => {
    mockSendPush.mockResolvedValueOnce({ errors: 'OneSignal credentials missing' });
    await expect(
      handleSendNotification(
        'SEND_NOTIFICATION_PUSH',
        { templateId: 'tmpl-1', notificationTargets: ['users'], notificationUserIds: ['user-1'] },
        ctx(),
      ),
    ).resolves.toBeUndefined();
    expect(mockLogAutomationEvent).toHaveBeenCalledWith(
      'error',
      'notification_dispatch_failed',
      expect.objectContaining({ channel: 'push' }),
    );
  });
});
