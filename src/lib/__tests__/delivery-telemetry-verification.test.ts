import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMessageDeliveryLogs } from '../services/delivery-telemetry';

const mockGet = vi.fn();

vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: mockGet,
      })),
    },
  };
});

describe('checkMessageDeliveryLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return status verified and score 100 on positive delivery logs', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          data: () => ({
            recipient: 'test@example.com',
            deliveredAt: '2026-07-13T09:00:00Z',
            status: 'sent',
          }),
        },
      ],
    });

    const result = await checkMessageDeliveryLogs('test@example.com', 'email');
    expect(result).toEqual({ status: 'verified', score: 100 });
  });

  it('should return status bounced and score 10 on bounced logs if no positive delivery logs exist', async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          data: () => ({
            recipient: 'test@example.com',
            bouncedAt: '2026-07-13T09:00:00Z',
            status: 'failed',
          }),
        },
      ],
    });

    const result = await checkMessageDeliveryLogs('test@example.com', 'email');
    expect(result).toEqual({ status: 'bounced', score: 10 });
  });

  it('should return null status and score when no logs exist', async () => {
    mockGet.mockResolvedValueOnce({
      empty: true,
      docs: [],
    });

    const result = await checkMessageDeliveryLogs('test@example.com', 'email');
    expect(result).toEqual({ status: null, score: null });
  });
});
