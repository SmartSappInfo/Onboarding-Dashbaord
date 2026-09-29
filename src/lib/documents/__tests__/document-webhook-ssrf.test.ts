// @vitest-environment node
/**
 * @fileOverview Webhook SSRF regression tests (PR-0 review, 2026-09-29; Rules 33–34).
 *
 * Subscriptions used to accept any `z.string().url()` and deliveries used plain `fetch`, so a
 * subscriber URL like http://169.254.169.254/… made the server call cloud metadata / internal hosts.
 * Now: private, loopback and link-local targets are refused at subscribe time, and the DEFAULT
 * delivery fetcher is `safeUrlFetch` (no network access is attempted for a blocked target).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookSubscription, dispatchWebhookDelivery } from '@/lib/documents/document-webhook-service';
import type { WebhookDeliveryLog, WebhookSubscription } from '@/lib/types/document-signing';

const mockGet = vi.fn();
const mockSet = vi.fn();
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      get: mockGet,
      doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: vi.fn() })),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ exists: false, data: () => ({}) });
});

const subscriptionInput: Omit<WebhookSubscription, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'url'> = {
  events: ['document.completed'],
  secret: 'super_secret_webhook_key_12345678',
  isActive: true,
  retryLimit: 5,
};

describe('createWebhookSubscription', () => {
  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:8080/hook',
    'http://10.0.0.5/hook',
    'http://[::1]/hook',
    'http://localhost/hook',
  ])('refuses internal target %s and stores nothing', async (url) => {
    await expect(createWebhookSubscription('ws_1', { ...subscriptionInput, url })).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });
});

describe('dispatchWebhookDelivery default fetcher', () => {
  it('blocks a stored internal URL instead of calling it (safeUrlFetch is the default)', async () => {
    const subscription: WebhookSubscription = {
      ...subscriptionInput,
      id: 'wh_1',
      workspaceId: 'ws_1',
      url: 'http://169.254.169.254/latest/meta-data/',
      createdAt: '2026-09-29T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
    };
    const log: WebhookDeliveryLog = {
      id: 'dl_1',
      workspaceId: 'ws_1',
      subscriptionId: 'wh_1',
      event: 'document.completed',
      payload: { contractId: 'c1' },
      status: 'pending',
      attemptCount: 0,
      createdAt: '2026-09-29T00:00:00.000Z',
    };

    const result = await dispatchWebhookDelivery(log, subscription);
    expect(result.status).not.toBe('delivered');
    // The guard's own message: no connection was attempted (plain fetch would give a network error).
    expect(result.errorMessage).toMatch(/SSRF Blocked/);
  });
});
