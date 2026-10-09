import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchQuickDirectMessageAction } from '../quick-message-actions';

// Mock dependencies
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockDoc = vi.fn(() => ({
  get: mockGet,
  set: mockSet,
  delete: mockDelete,
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: mockDoc,
    })),
    runTransaction: vi.fn(async <T>(cb: (tx: { get: typeof mockGet; set: typeof mockSet }) => Promise<T>): Promise<T> => {
      const tx = {
        get: mockGet,
        set: mockSet,
      };
      return cb(tx);
    }),
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (workspaceId: string) => {
    if (!workspaceId || workspaceId === 'unauthorized_ws') {
      throw new Error('Unauthorized workspace access');
    }
    return {
      user: { uid: 'user_123' },
      profile: { organizationId: 'org_test' },
      role: 'admin',
    };
  }),
}));

const mockSendRawMessage = vi.fn();
vi.mock('@/lib/messaging-engine', () => ({
  sendRawMessage: (...args: unknown[]) => mockSendRawMessage(...args),
}));

const mockGetSettings = vi.fn();
vi.mock('../messaging-settings-actions', () => ({
  getWorkspaceMessagingSettingsAction: (...args: unknown[]) => mockGetSettings(...args),
}));

describe('dispatchQuickDirectMessageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: false });
    mockSet.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockSendRawMessage.mockResolvedValue({ success: true, logId: 'log_999' });
    mockGetSettings.mockResolvedValue({
      success: true,
      data: {
        channelKillSwitches: { sms: false, whatsapp: false, email: false },
      },
    });
  });

  it('rejects unauthenticated or unauthorized workspace', async () => {
    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'unauthorized_ws',
      channel: 'sms',
      recipient: '+233244123456',
      body: 'Hello test message',
      clientRequestId: 'req_001',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it('rejects multi-recipient blast attempts (delimiters)', async () => {
    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'sms',
      recipient: '+233244123456, +233201112222',
      body: 'Hello test message',
      clientRequestId: 'req_002',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/single recipient/i);
    expect(mockSendRawMessage).not.toHaveBeenCalled();
  });

  it('rejects multi-recipient blast attempts with slash or pipe delimiters', async () => {
    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'sms',
      recipient: '+233244123456/+233201112222',
      body: 'Hello test message',
      clientRequestId: 'req_002b',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/single recipient/i);
    expect(mockSendRawMessage).not.toHaveBeenCalled();
  });

  it('accepts legitimate spaced phone numbers without false-positive blast error', async () => {
    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'sms',
      recipient: '+233 24 123 4567',
      body: 'Hello test message',
      clientRequestId: 'req_003',
    });

    expect(res.success).toBe(true);
    expect(res.logId).toBe('log_999');
    expect(mockSendRawMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '+233 24 123 4567',
        channel: 'sms',
      })
    );
  });

  it('rejects email dispatches with missing subject line', async () => {
    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'email',
      recipient: 'parent@example.com',
      body: 'Important school update',
      clientRequestId: 'req_004',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/subject is required/i);
    expect(mockSendRawMessage).not.toHaveBeenCalled();
  });

  it('returns cached success for duplicate clientRequestId without re-dispatching (Rule 20)', async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        status: 'completed',
        logId: 'log_cached_123',
      }),
    });

    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'sms',
      recipient: '+233244123456',
      body: 'Hello test message',
      clientRequestId: 'req_duplicate',
    });

    expect(res.success).toBe(true);
    expect(res.logId).toBe('log_cached_123');
    expect(res.isDuplicate).toBe(true);
    expect(mockSendRawMessage).not.toHaveBeenCalled();
  });

  it('maps WhatsApp 24h session closed error to WHATSAPP_SESSION_CLOSED code', async () => {
    mockSendRawMessage.mockResolvedValueOnce({
      success: false,
      error: 'WhatsApp 24-hour customer service window is closed for this contact. You must use an approved WhatsApp template to message them.',
    });

    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'whatsapp',
      recipient: '+233244123456',
      body: 'Hello WhatsApp contact',
      clientRequestId: 'req_wa_closed',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('WHATSAPP_SESSION_CLOSED');
    expect(mockDelete).toHaveBeenCalled(); // Cleans up idempotency so user can retry
  });

  it('maps production WhatsApp engine error without word closed to WHATSAPP_SESSION_CLOSED code', async () => {
    mockSendRawMessage.mockResolvedValueOnce({
      success: false,
      error: 'WhatsApp requires an approved template outside the 24-hour customer-service window.',
    });

    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'whatsapp',
      recipient: '+233244123456',
      body: 'Hello WhatsApp contact',
      clientRequestId: 'req_wa_closed_prod',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('WHATSAPP_SESSION_CLOSED');
  });

  it('dispatches valid email with subject successfully', async () => {
    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'email',
      recipient: 'headmaster@smartsapp.com',
      subject: 'End of Term Report',
      body: 'Please review the attached term report.',
      clientRequestId: 'req_email_valid',
    });

    expect(res.success).toBe(true);
    expect(res.logId).toBe('log_999');
    expect(mockSendRawMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'email',
        recipient: 'headmaster@smartsapp.com',
        subject: 'End of Term Report',
      })
    );
  });

  it('rejects dispatches when channel kill-switch is active (Rules 3, 18 & 21)', async () => {
    mockGetSettings.mockResolvedValueOnce({
      success: true,
      data: {
        channelKillSwitches: { sms: true, whatsapp: false, email: false },
      },
    });

    const res = await dispatchQuickDirectMessageAction({
      workspaceId: 'ws_valid',
      channel: 'sms',
      recipient: '+233244123456',
      body: 'Hello test message',
      clientRequestId: 'req_killswitch',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('CHANNEL_PAUSED');
    expect(res.error).toMatch(/paused for maintenance/i);
    expect(mockSendRawMessage).not.toHaveBeenCalled();
  });
});
