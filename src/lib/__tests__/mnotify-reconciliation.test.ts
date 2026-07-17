import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcilePendingSmsLogs } from '../automations/reconciliation';
import { getSmsStatus } from '../mnotify-service';
import { incrementMessageNodeStat } from '../messaging/message-node-stats';
import { assertAutomationManagePermission } from '../automation-permissions';

// Mock Firebase Admin
const mockCollection = {
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
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

// Mock dependencies
vi.mock('../mnotify-service', () => ({
  getSmsStatus: vi.fn(),
}));

vi.mock('../messaging/message-node-stats', () => ({
  incrementMessageNodeStat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../automation-permissions', () => ({
  assertAutomationManagePermission: vi.fn().mockResolvedValue(undefined),
}));

describe('SMS Delivery Reconciliation Fallback Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.get.mockReset();
    mockTx.get.mockReset();
    mockTx.update.mockReset();
    vi.mocked(getSmsStatus).mockReset();
    vi.mocked(incrementMessageNodeStat).mockReset();
    vi.mocked(assertAutomationManagePermission).mockReset();
  });

  it('checks workspace permissions before executing reconciliation', async () => {
    mockCollection.get.mockResolvedValueOnce({ empty: true } as any);

    await reconcilePendingSmsLogs('auto-1', 'node-1', 'user-1', 'ws-1');

    expect(assertAutomationManagePermission).toHaveBeenCalledWith('user-1', ['ws-1'], 'edit');
  });

  it('skips processing if no pending logs are returned', async () => {
    mockCollection.get.mockResolvedValueOnce({ empty: true } as any);

    const res = await reconcilePendingSmsLogs('auto-1', 'node-1', 'user-1', 'ws-1');
    expect(res).toEqual({ success: true, updatedCount: 0 });
    expect(getSmsStatus).not.toHaveBeenCalled();
  });

  it('deduplicates gateway calls by providerId and transactionally updates status', async () => {
    const mockLog1 = {
      id: 'log-1',
      ref: { id: 'log-1' },
      data: () => ({
        automationId: 'auto-1',
        nodeId: 'node-1',
        recipient: '233241112222',
        providerId: 'sms-abc',
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        channel: 'sms',
        status: 'sent',
      }),
    };

    const mockLog2 = {
      id: 'log-2',
      ref: { id: 'log-2' },
      data: () => ({
        automationId: 'auto-1',
        nodeId: 'node-1',
        recipient: '233243334444',
        providerId: 'sms-abc', // Shares same providerId (batch send)
        workspaceId: 'ws-1',
        organizationId: 'org-1',
        channel: 'sms',
        status: 'sent',
      }),
    };

    mockCollection.get.mockResolvedValueOnce({
      empty: false,
      docs: [mockLog1, mockLog2],
    } as any);

    // Mock API key resolution (return empty organization snapshot)
    mockCollection.get.mockResolvedValueOnce({ exists: false } as any);

    // Mock mNotify API return data with multiple recipient report list
    vi.mocked(getSmsStatus).mockResolvedValueOnce({
      status: 'success',
      report: [
        { recipient: '233241112222', status: 'DELIVRD' },
        { recipient: '233243334444', status: 'FAILED' },
      ],
    } as any);

    // Mock Transaction Gets
    mockTx.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ providerStatus: 'pending' }),
      } as any)
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ providerStatus: 'pending' }),
      } as any);

    const res = await reconcilePendingSmsLogs('auto-1', 'node-1', 'user-1', 'ws-1');
    expect(res).toEqual({ success: true, updatedCount: 2 });

    // Deduplicated call: getSmsStatus called exactly once for 'sms-abc'
    expect(getSmsStatus).toHaveBeenCalledTimes(1);
    expect(getSmsStatus).toHaveBeenCalledWith('sms-abc', undefined);

    // Transaction updates called for each log doc
    expect(mockTx.update).toHaveBeenCalledTimes(2);

    // Verifies status mapping increments correctly
    expect(incrementMessageNodeStat).toHaveBeenCalledWith(
      expect.objectContaining({ counter: 'delivered', nodeId: 'node-1' })
    );
    expect(incrementMessageNodeStat).toHaveBeenCalledWith(
      expect.objectContaining({ counter: 'bounced', nodeId: 'node-1' })
    );
  });
});
