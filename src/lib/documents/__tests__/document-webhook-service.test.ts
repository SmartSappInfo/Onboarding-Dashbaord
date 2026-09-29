import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateBackoffDelayMs,
  generateWebhookHmacSignature,
  verifyWebhookHmacSignature,
  dispatchWebhookDelivery,
  scheduleWebhookDeliveriesForEvent,
} from '@/lib/documents/document-webhook-service';
import { WebhookSubscription, WebhookDeliveryLog } from '@/lib/types/document-signing';

// Mock Firestore
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      get: mockGet,
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      })),
    })),
  },
}));

describe('Self-Healing Webhook Dispatch & Dead-Letter Queue (Phase 6)', () => {
  const secret = 'super_secret_webhook_key_12345678';
  const workspaceId = 'ws_enterprise_01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateBackoffDelayMs (FM-P6-02)', () => {
    it('calculates deterministic exponential backoff delays', () => {
      expect(calculateBackoffDelayMs(0)).toBe(60 * 1000); // 1m
      expect(calculateBackoffDelayMs(1)).toBe(5 * 60 * 1000); // 5m
      expect(calculateBackoffDelayMs(2)).toBe(15 * 60 * 1000); // 15m
      expect(calculateBackoffDelayMs(3)).toBe(60 * 60 * 1000); // 1h
      expect(calculateBackoffDelayMs(4)).toBe(6 * 60 * 60 * 1000); // 6h
      expect(calculateBackoffDelayMs(5)).toBe(-1); // Exceeded -> Dead-Letter
    });
  });

  describe('HMAC-SHA256 Signatures and Verification', () => {
    const payload = JSON.stringify({ event: 'document.completed', contractId: 'con_123' });
    const nowTimestamp = Math.floor(Date.now() / 1000);

    it('generates valid X-DocSigning-Signature and verifies it successfully', () => {
      const header = generateWebhookHmacSignature(payload, secret, nowTimestamp);
      expect(header).toContain(`t=${nowTimestamp},v1=`);

      const isValid = verifyWebhookHmacSignature(payload, secret, header, 300);
      expect(isValid).toBe(true);
    });

    it('rejects signature if payload is tampered', () => {
      const header = generateWebhookHmacSignature(payload, secret, nowTimestamp);
      const tamperedPayload = JSON.stringify({ event: 'document.completed', contractId: 'con_tampered' });

      const isValid = verifyWebhookHmacSignature(tamperedPayload, secret, header, 300);
      expect(isValid).toBe(false);
    });

    it('rejects signature if timestamp is expired (replay attack defense)', () => {
      const expiredTimestamp = nowTimestamp - 600; // 10 minutes ago
      const header = generateWebhookHmacSignature(payload, secret, expiredTimestamp);

      const isValid = verifyWebhookHmacSignature(payload, secret, header, 300); // 5 min tolerance
      expect(isValid).toBe(false);
    });
  });

  describe('dispatchWebhookDelivery with Dead-Letter Handling', () => {
    const subscription: WebhookSubscription = {
      id: 'sub_001',
      workspaceId,
      url: 'https://webhook.site/test-endpoint',
      secret,
      events: ['document.completed'],
      isActive: true,
      retryLimit: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const baseDeliveryLog: WebhookDeliveryLog = {
      id: 'del_001',
      subscriptionId: 'sub_001',
      workspaceId,
      event: 'document.completed',
      payload: { contractId: 'con_123' },
      status: 'pending',
      attemptCount: 0,
      createdAt: new Date().toISOString(),
    };

    it('marks delivery as delivered upon HTTP 200 response', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValueOnce('OK'),
      });

      const result = await dispatchWebhookDelivery(baseDeliveryLog, subscription, mockFetch as unknown as typeof fetch);
      expect(result.status).toBe('delivered');
      expect(result.responseStatusCode).toBe(200);
      expect(result.attemptCount).toBe(1);
    });

    it('schedules retry with exponential backoff on HTTP 500 error', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValueOnce('Internal Server Error'),
      });

      const result = await dispatchWebhookDelivery(baseDeliveryLog, subscription, mockFetch as unknown as typeof fetch);
      expect(result.status).toBe('failed');
      expect(result.attemptCount).toBe(1);
      expect(result.nextRetryAt).toBeDefined();
    });

    it('transitions to dead_letter state when retryLimit is reached', async () => {
      const nearExhaustionLog: WebhookDeliveryLog = {
        ...baseDeliveryLog,
        attemptCount: 4, // 5th attempt will fail
      };

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValueOnce('Service Unavailable'),
      });

      const result = await dispatchWebhookDelivery(nearExhaustionLog, subscription, mockFetch as unknown as typeof fetch);
      expect(result.status).toBe('dead_letter');
      expect(result.attemptCount).toBe(5);
      expect(result.nextRetryAt).toBeNull();
      expect(result.errorMessage).toContain('Exceeded maximum retry limit');
    });
  });

  describe('scheduleWebhookDeliveriesForEvent (FM-P6-08 Tenant Scoping)', () => {
    it('creates pending deliveries only for active subscriptions belonging to the target workspace', async () => {
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({
              id: 'sub_active_1',
              workspaceId,
              url: 'https://partner.com/wh',
              secret,
              events: ['document.completed'],
              isActive: true,
              retryLimit: 5,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
          },
        ],
      });

      const deliveries = await scheduleWebhookDeliveriesForEvent(workspaceId, 'document.completed', {
        contractId: 'con_abc',
      });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].status).toBe('pending');
      expect(deliveries[0].workspaceId).toBe(workspaceId);
    });
  });
});
