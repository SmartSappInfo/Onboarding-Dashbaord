// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin
vi.mock('../firebase-admin', () => {
  const getMeetingDocMock = vi.fn();
  const getRegistrantDocMock = vi.fn();
  const updateRegistrantDocMock = vi.fn().mockResolvedValue(undefined);

  const doc = vi.fn((path) => {
    return {
      get: getMeetingDocMock,
      update: vi.fn().mockResolvedValue(undefined),
      collection: vi.fn((subPath) => {
        if (subPath === 'registrants') {
          return {
            doc: vi.fn((regId) => ({
              get: getRegistrantDocMock,
              update: updateRegistrantDocMock,
            })),
          };
        }
      }),
    };
  });

  const collection = vi.fn((path) => {
    if (path === 'meetings') {
      return { doc };
    }
    if (path.includes('registrants')) {
      return {
        doc: vi.fn((regId) => ({
          get: getRegistrantDocMock,
          update: updateRegistrantDocMock,
        })),
      };
    }
  });

  return {
    adminDb: { collection },
    __mocks: {
      collection,
      doc,
      getMeetingDocMock,
      getRegistrantDocMock,
      updateRegistrantDocMock,
    },
  };
});

// Mock messaging-engine
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock template-resolver
vi.mock('../template-resolver', () => ({
  resolveActiveTemplate: vi.fn(),
}));

import { sendRegistrantJoinLinkAction } from '../../app/actions/meeting-registrants-actions';
import * as firebaseAdmin from '../firebase-admin';
import * as messagingEngine from '../messaging-engine';
import * as templateResolver from '../template-resolver';

const mocks = () => (firebaseAdmin as any).__mocks;

describe('sendRegistrantJoinLinkAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock setup: template resolver returns active templates
    templateResolver.resolveActiveTemplate.mockImplementation((trigger, orgId, channel) => {
      return Promise.resolve({ id: `global_fallback_${channel}` });
    });
    
    // Default sendMessage returns success
    messagingEngine.sendMessage.mockResolvedValue({ success: true });
  });

  it('dispatches both Email and SMS when both are configured and registrant has details', async () => {
    // Mock meeting config (no custom templates, fall back to global)
    mocks().getMeetingDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        organizationId: 'org-123',
        workspaceIds: ['ws-123'],
        messagingConfig: {},
      }),
    });

    // Mock registrant details (has email and phone)
    mocks().getRegistrantDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        entityId: 'entity-abc',
      }),
    });

    const result = await sendRegistrantJoinLinkAction(
      'meeting-123',
      'Test Meeting',
      [{ id: 'reg-123', name: 'Jane Doe' }],
      'ws-123'
    );

    expect(result.success).toBe(true);
    expect(templateResolver.resolveActiveTemplate).toHaveBeenCalledWith('meeting_resend_join_link', 'org-123', 'email');
    expect(templateResolver.resolveActiveTemplate).toHaveBeenCalledWith('meeting_resend_join_link', 'org-123', 'sms');

    // Assert two sendMessage dispatches: one email, one sms
    expect(messagingEngine.sendMessage).toHaveBeenCalledTimes(2);
    expect(messagingEngine.sendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      templateId: 'global_fallback_email',
      recipient: 'jane@example.com',
      variables: expect.objectContaining({ contact_name: 'Jane Doe' }),
    }));
    expect(messagingEngine.sendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      templateId: 'global_fallback_sms',
      recipient: '+1234567890',
      variables: expect.objectContaining({ contact_name: 'Jane Doe' }),
    }));

    // Registrant timestamp updated
    expect(mocks().updateRegistrantDocMock).toHaveBeenCalled();
  });

  it('respects custom meeting overrides for Email and SMS templates if configured', async () => {
    // Mock meeting config WITH custom overrides
    mocks().getMeetingDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        organizationId: 'org-123',
        workspaceIds: ['ws-123'],
        messagingConfig: {
          resendLinkEmailTemplateId: 'custom_email_override',
          resendLinkSmsTemplateId: 'custom_sms_override',
        },
      }),
    });

    // Mock registrant details
    mocks().getRegistrantDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        entityId: 'entity-abc',
      }),
    });

    const result = await sendRegistrantJoinLinkAction(
      'meeting-123',
      'Test Meeting',
      [{ id: 'reg-123', name: 'Jane Doe' }],
      'ws-123'
    );

    expect(result.success).toBe(true);
    // Should NOT call resolveActiveTemplate since custom templates are configured
    expect(templateResolver.resolveActiveTemplate).not.toHaveBeenCalled();

    expect(messagingEngine.sendMessage).toHaveBeenCalledTimes(2);
    expect(messagingEngine.sendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      templateId: 'custom_email_override',
      recipient: 'jane@example.com',
    }));
    expect(messagingEngine.sendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      templateId: 'custom_sms_override',
      recipient: '+1234567890',
    }));
  });

  it('sends only email if registrant has no phone number', async () => {
    mocks().getMeetingDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        organizationId: 'org-123',
        workspaceIds: ['ws-123'],
        messagingConfig: {},
      }),
    });

    // Mock registrant details: email only, no phone
    mocks().getRegistrantDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Jane Doe',
        email: 'jane@example.com',
        entityId: 'entity-abc',
      }),
    });

    const result = await sendRegistrantJoinLinkAction(
      'meeting-123',
      'Test Meeting',
      [{ id: 'reg-123', name: 'Jane Doe' }],
      'ws-123'
    );

    expect(result.success).toBe(true);
    expect(messagingEngine.sendMessage).toHaveBeenCalledTimes(1);
    expect(messagingEngine.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'global_fallback_email',
      recipient: 'jane@example.com',
    }));
  });

  it('fails gracefully on registrant with missing channels', async () => {
    mocks().getMeetingDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        organizationId: 'org-123',
        workspaceIds: ['ws-123'],
        messagingConfig: {},
      }),
    });

    // Mock registrant details: empty contact info
    mocks().getRegistrantDocMock.mockResolvedValue({
      exists: true,
      data: () => ({
        name: 'Jane Doe',
      }),
    });

    const result = await sendRegistrantJoinLinkAction(
      'meeting-123',
      'Test Meeting',
      [{ id: 'reg-123', name: 'Jane Doe' }],
      'ws-123'
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('1 failed');
    expect(messagingEngine.sendMessage).not.toHaveBeenCalled();
  });
});
