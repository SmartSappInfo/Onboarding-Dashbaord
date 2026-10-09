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

describe('dispatchQuickDirectMessageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: false });
    mockSet.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockSendRawMessage.mockResolvedValue({ success: true, logId: 'log_999' });
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
});
