import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/webhooks/messaging/mnotify/route';
import { incrementMessageNodeStat } from '../messaging/message-node-stats';

// Mock Firebase Admin
const mockCollection = {
  where: vi.fn().mockReturnThis(),
  get: vi.fn(),
};

const mockTx = {
  get: vi.fn(),
  update: vi.fn(),
};

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(() => mockCollection),
      runTransaction: vi.fn((cb) => cb(mockTx)),
    },
  };
});

// Mock message node stats increment
vi.mock('../messaging/message-node-stats', () => ({
  incrementMessageNodeStat: vi.fn().mockResolvedValue(undefined),
}));

describe('mNotify Delivery Status Callback Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.get.mockReset();
    mockTx.get.mockReset();
    mockTx.update.mockReset();
    vi.mocked(incrementMessageNodeStat).mockReset();
  });

  it('returns 401 if secret handshake is missing or invalid', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/messaging/mnotify', {
      method: 'POST',
      body: JSON.stringify({ sms_id: '123', to: '0241234567', status: 'DELIVRD' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 if required parameters are missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/messaging/mnotify?secret=local-secret', {
      method: 'POST',
      body: JSON.stringify({ sms_id: '', to: '0241234567', status: 'DELIVRD' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('updates message log and increments stats on DELIVRD status callback', async () => {
    const mockLog = {
      id: 'log-1',
      ref: { id: 'log-1' },
      data: () => ({
        automationId: 'auto-1',
        nodeId: 'node-msg-1',
        recipient: '233241234567',
        providerId: 'sms-123',
        workspaceId: 'onboarding',
      }),
    };

    mockCollection.get.mockResolvedValueOnce({
      empty: false,
      docs: [mockLog],
    } as any);

    mockTx.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        providerStatus: 'pending',
      }),
    } as any);

    const req = new NextRequest(
      'http://localhost/api/webhooks/messaging/mnotify?secret=local-secret',
      {
        method: 'POST',
        body: JSON.stringify({ sms_id: 'sms-123', to: '233241234567', status: 'DELIVRD' }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify transaction update is called with delivered status
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'log-1' }),
      expect.objectContaining({
        providerStatus: 'delivered',
        status: 'delivered',
      })
    );

    // Verify message stats counter increment is called
    expect(incrementMessageNodeStat).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: 'auto-1',
        nodeId: 'node-msg-1',
        channel: 'sms',
        counter: 'delivered',
      })
    );
  });

  it('normalizes recipient phone number formats to match suffixes', async () => {
    const mockLog = {
      id: 'log-1',
      ref: { id: 'log-1' },
      data: () => ({
        automationId: 'auto-1',
        nodeId: 'node-msg-1',
        recipient: '0241234567', // local number
        providerId: 'sms-123',
      }),
    };

    mockCollection.get.mockResolvedValueOnce({
      empty: false,
      docs: [mockLog],
    } as any);

    mockTx.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        providerStatus: 'pending',
      }),
    } as any);

    // Callback has +233 prefix, but the suffix matches
    const req = new NextRequest(
      'http://localhost/api/webhooks/messaging/mnotify?secret=local-secret',
      {
        method: 'POST',
        body: JSON.stringify({ sms_id: 'sms-123', to: '+233241234567', status: 'FAILED' }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'log-1' }),
      expect.objectContaining({
        providerStatus: 'bounced',
        status: 'failed',
      })
    );

    expect(incrementMessageNodeStat).toHaveBeenCalledWith(
      expect.objectContaining({
        counter: 'bounced',
      })
    );
  });
});
