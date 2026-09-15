import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleDirectNotification,
  parseManualRecipients,
  handleSendNotification,
} from '../automations/actions/notification-actions';
import type { ExecutionContext } from '../automations/execution-types';

const mockSendRawMessage = vi.fn().mockResolvedValue({ success: true, messageId: 'msg-1' });
const mockSendMessage = vi.fn().mockResolvedValue({ success: true, logId: 'log-1' });
const mockResolveContact = vi.fn().mockResolvedValue(null);
const mockLogAutomationEvent = vi.fn();

vi.mock('../messaging-engine', () => ({
  sendRawMessage: (args: Record<string, unknown>) => mockSendRawMessage(args),
  sendMessage: (args: Record<string, unknown>) => mockSendMessage(args),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: (id: string, wsId: string) => mockResolveContact(id, wsId),
}));

vi.mock('../automation-log', () => ({
  logAutomationEvent: (...args: unknown[]) => mockLogAutomationEvent(...args),
}));

vi.mock('../template-resolver', () => ({
  buildVariableMap: vi.fn().mockImplementation((_type, opts) =>
    Promise.resolve({
      organization_name: 'SmartSapp University',
      brand_primary_color: '#10B981',
      user_name: 'Dr. Jane',
      ...(opts?.extraVars || {}),
    })
  ),
}));

vi.mock('../template-utils', () => ({
  renderTemplate: vi.fn((tmpl: string, vars: Record<string, unknown>) => {
    return tmpl.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
      const trimmed = (key as string).trim();
      return trimmed in vars ? String(vars[trimmed]) : `{{${trimmed}}}`;
    });
  }),
}));

const USERS: Record<string, { email?: string; phone?: string }> = {
  'user-1': { email: 'admin1@smartsapp.com', phone: '+233201111111' },
  'user-2': { email: 'admin2@smartsapp.com', phone: '+233202222222' },
  'assignee-user': { email: 'assignee@smartsapp.com', phone: '+233203333333' },
};

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === 'workspaces') {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({ organizationId: 'org-test-1', name: 'Main Campus' }),
            }),
          }),
        };
      }
      if (name === 'users') {
        return {
          doc: (uid: string) => ({
            get: async () => ({
              exists: !!USERS[uid],
              data: () => USERS[uid],
            }),
          }),
        };
      }
      if (name === 'message_templates') {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => ({ subject: 'Alert: {{name}}', body: 'Message for {{name}}', channel: 'email' }),
            }),
          }),
        };
      }
      return {
        doc: () => ({ get: async () => ({ exists: false }) }),
        add: vi.fn(),
      };
    }),
  },
}));

const createCtx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  automationId: 'auto-notif-1',
  runId: 'run-notif-1',
  workspaceId: 'ws-100',
  entityId: 'ent-100',
  entityType: 'institution',
  organizationId: 'org-test-1',
  payload: {
    name: 'Kofi Mensah',
    manager_email: 'external-manager@domain.com',
    custom_phone: '+233244444444',
  },
  ...overrides,
});

describe('parseManualRecipients helper', () => {
  it('parses comma-, semicolon-, and newline-separated emails and filters invalid tokens', () => {
    const raw = 'alice@smartsapp.com, bob@smartsapp.com; charlie@smartsapp.com\ndave@smartsapp.com, not-an-email';
    const parsed = parseManualRecipients(raw, {}, false);
    expect(parsed).toEqual([
      'alice@smartsapp.com',
      'bob@smartsapp.com',
      'charlie@smartsapp.com',
      'dave@smartsapp.com',
    ]);
  });

  it('interpolates template variables in manual emails', () => {
    const raw = 'alerts@smartsapp.com, {{manager_email}}';
    const parsed = parseManualRecipients(raw, { manager_email: 'finance@org.com' }, false);
    expect(parsed).toEqual(['alerts@smartsapp.com', 'finance@org.com']);
  });

  it('parses and normalizes phone numbers for SMS', () => {
    const raw = '+233 20 123 4567, 0244 888 999; {{custom_phone}}';
    const parsed = parseManualRecipients(raw, { custom_phone: '+1 (555) 019-2831' }, true);
    expect(parsed).toEqual(['+233201234567', '0244888999', '+15550192831']);
  });

  it('returns empty array when input is null, undefined, or empty', () => {
    expect(parseManualRecipients(null, {}, false)).toEqual([]);
    expect(parseManualRecipients('', {}, true)).toEqual([]);
  });
});

describe('handleDirectNotification (DIRECT_NOTIFICATION_EMAIL & DIRECT_NOTIFICATION_SMS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendRawMessage.mockResolvedValue({ success: true, messageId: 'msg-1' });
    mockResolveContact.mockResolvedValue(null);
  });

  it('DIRECT_NOTIFICATION_EMAIL: dispatches un-templated email with brand wrapper to selected users and manual addresses', async () => {
    await handleDirectNotification(
      'DIRECT_NOTIFICATION_EMAIL',
      {
        senderProfileId: 'profile-email-1',
        directSubject: 'Internal Alert: {{user_name}}',
        directBody: 'Please review updates regarding {{name}}.',
        useBrandLayout: true,
        notificationTargets: ['users', 'custom'],
        notificationUserIds: ['user-1', 'user-2'],
        customRecipient: 'director@external.org, {{manager_email}}',
      },
      createCtx()
    );

    // Should dispatch to 4 recipients: user-1, user-2, director@external.org, and resolved manager_email
    expect(mockSendRawMessage).toHaveBeenCalledTimes(4);

    const calls = mockSendRawMessage.mock.calls;
    const recipients = calls.map((c: any) => c[0].recipient);
    expect(recipients).toContain('admin1@smartsapp.com');
    expect(recipients).toContain('admin2@smartsapp.com');
    expect(recipients).toContain('director@external.org');
    expect(recipients).toContain('external-manager@domain.com');

    // Verify channel, subject, senderProfileId, and brand wrapper
    const firstCall = calls[0][0];
    expect(firstCall.channel).toBe('email');
    expect(firstCall.senderProfileId).toBe('profile-email-1');
    expect(firstCall.subject).toBe('Internal Alert: Dr. Jane');
    expect(firstCall.body).toContain('SmartSapp University');
    expect(firstCall.body).toContain('Please review updates regarding Kofi Mensah.');
  });

  it('DIRECT_NOTIFICATION_EMAIL: supports raw plain email without brand wrapper when useBrandLayout is false', async () => {
    await handleDirectNotification(
      'DIRECT_NOTIFICATION_EMAIL',
      {
        directSubject: 'Plain Subject',
        directBody: 'Raw body content',
        useBrandLayout: false,
        notificationTargets: ['users'],
        notificationUserIds: ['user-1'],
      },
      createCtx()
    );

    expect(mockSendRawMessage).toHaveBeenCalledTimes(1);
    const callArg = mockSendRawMessage.mock.calls[0][0];
    expect(callArg.body).toBe('Raw body content');
    expect(callArg.body).not.toContain('<!DOCTYPE html>');
  });

  it('DIRECT_NOTIFICATION_SMS: dispatches un-templated SMS alert to assignee and custom phone numbers', async () => {
    mockResolveContact.mockResolvedValue({
      assignedTo: 'assignee-user',
    });

    await handleDirectNotification(
      'DIRECT_NOTIFICATION_SMS',
      {
        senderProfileId: 'sms-profile-1',
        directBody: 'URGENT: Alert for {{name}}',
        notificationTargets: ['assignee', 'custom'],
        customRecipient: '+1234567890, {{custom_phone}}',
      },
      createCtx()
    );

    expect(mockSendRawMessage).toHaveBeenCalledTimes(3);

    const calls = mockSendRawMessage.mock.calls;
    const recipients = calls.map((c: any) => c[0].recipient);
    expect(recipients).toContain('+233203333333'); // Assignee's phone
    expect(recipients).toContain('+1234567890');
    expect(recipients).toContain('+233244444444');

    const firstCall = calls[0][0];
    expect(firstCall.channel).toBe('sms');
    expect(firstCall.senderProfileId).toBe('sms-profile-1');
    expect(firstCall.body).toBe('URGENT: Alert for Kofi Mensah');
    expect(firstCall.subject).toBeUndefined();
  });

  it('deduplicates recipients if the assignee is also explicitly included in selected team members', async () => {
    mockResolveContact.mockResolvedValue({
      assignedTo: 'user-1',
    });

    await handleDirectNotification(
      'DIRECT_NOTIFICATION_EMAIL',
      {
        directSubject: 'Duplicate Test',
        directBody: 'Testing deduplication',
        notificationTargets: ['assignee', 'users'],
        notificationUserIds: ['user-1'], // Same user as assignee
      },
      createCtx()
    );

    // user-1 must be dispatched to exactly once
    expect(mockSendRawMessage).toHaveBeenCalledTimes(1);
    expect(mockSendRawMessage.mock.calls[0][0].recipient).toBe('admin1@smartsapp.com');
  });

  it('non-blocking failure: logs event to automation-log without throwing if sendRawMessage fails', async () => {
    mockSendRawMessage.mockResolvedValueOnce({
      success: false,
      error: 'Invalid recipient gateway rejection',
    });

    // Should not throw
    await expect(
      handleDirectNotification(
        'DIRECT_NOTIFICATION_EMAIL',
        {
          directSubject: 'Failure Test',
          directBody: 'Testing non-blocking failure',
          notificationTargets: ['custom'],
          customRecipient: 'bad-email@broken.com',
        },
        createCtx()
      )
    ).resolves.not.toThrow();

    expect(mockLogAutomationEvent).toHaveBeenCalledWith(
      'warn',
      'direct_notification_delivery_failed',
      expect.objectContaining({
        recipient: 'bad-email@broken.com',
        channel: 'email',
        actionType: 'DIRECT_NOTIFICATION_EMAIL',
        error: 'Invalid recipient gateway rejection',
      })
    );
  });

  it('handles multi-delimiter custom recipient in existing handleSendNotification as well', async () => {
    await handleSendNotification(
      'SEND_NOTIFICATION_EMAIL',
      {
        templateId: 'tmpl-1',
        notificationTargets: ['custom'],
        customRecipient: 'ext1@domain.com, ext2@domain.com; ext3@domain.com',
      },
      createCtx()
    );

    expect(mockSendMessage).toHaveBeenCalledTimes(3);
    const recipients = mockSendMessage.mock.calls.map((c: any) => c[0].recipient);
    expect(recipients).toContain('ext1@domain.com');
    expect(recipients).toContain('ext2@domain.com');
    expect(recipients).toContain('ext3@domain.com');
  });
});
