/**
 * Developer Platform Server Actions Test Suite
 *
 * Verifies API key generation, revocation, embed origins management,
 * webhook simulation, and offline queue status reporting.
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
  updateAllowedEmbedOriginsAction,
  getAllowedEmbedOriginsAction,
  testWebhookDeliveryAction,
  getOfflineSyncQueueStatusAction,
} from '@/app/actions/developer-platform-actions';
import * as authService from '@/lib/documents/api-key-auth-service';
import { adminDb } from '@/lib/firebase-admin';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'usr_admin', email: 'admin@corp.com' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/documents/api-key-auth-service');

vi.mock('@/lib/firebase-admin', () => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockDoc = vi.fn(() => ({
    get: mockGet,
    set: mockSet,
  }));
  const mockCollection = vi.fn(() => ({
    doc: mockDoc,
    where: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      size: 5,
      docs: [],
    }),
  }));

  return {
    adminDb: {
      collection: mockCollection,
      doc: mockDoc,
    },
  };
});

describe('DeveloperPlatformActions', () => {
  const wsId = 'ws_dev_platform';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Key Management Actions', () => {
    it('creates API key and returns raw secret once', async () => {
      vi.mocked(authService.generateApiKey).mockResolvedValueOnce({
        rawKey: 'sapp_live_abcd1234_secret32characterslongabc12',
        keyRecord: {
          id: 'key_new_01',
          workspaceId: wsId,
          name: 'Partner Integration',
          prefix: 'abcd1234',
          hashedSecret: 'hash...',
          scopes: ['envelopes:create', 'envelopes:read'],
          status: 'active',
          rateLimitTier: 'standard',
          createdAt: '2026-09-29T10:00:00Z',
        },
      });

      const res = await createApiKeyAction(wsId, {
        name: 'Partner Integration',
        scopes: ['envelopes:create', 'envelopes:read'],
        rateLimitTier: 'standard',
      });

      expect(res.success).toBe(true);
      expect(res.rawKey).toBe('sapp_live_abcd1234_secret32characterslongabc12');
      expect(res.keyRecord?.name).toBe('Partner Integration');
    });

    it('lists API keys for workspace', async () => {
      vi.mocked(authService.listApiKeys).mockResolvedValueOnce([
        {
          id: 'key_1',
          workspaceId: wsId,
          name: 'CI Key',
          prefix: '11112222',
          hashedSecret: 'hash...',
          scopes: ['envelopes:read'],
          status: 'active',
          rateLimitTier: 'standard',
          createdAt: '2026-09-29T10:00:00Z',
        },
      ]);

      const res = await listApiKeysAction(wsId);
      expect(res.success).toBe(true);
      expect(res.keys?.length).toBe(1);
      expect(res.keys?.[0].prefix).toBe('11112222');
    });

    it('revokes an API key successfully', async () => {
      vi.mocked(authService.revokeApiKey).mockResolvedValueOnce({
        success: true,
      });

      const res = await revokeApiKeyAction(wsId, 'key_1');
      expect(res.success).toBe(true);
    });

    it('rotates an API key and returns new secret', async () => {
      vi.mocked(authService.rotateApiKey).mockResolvedValueOnce({
        newRawKey: 'sapp_live_newp1234_secretrotatedkey1234567890',
        newKeyRecord: {
          id: 'key_rotated_01',
          workspaceId: wsId,
          name: 'Rotated Key',
          prefix: 'newp1234',
          hashedSecret: 'newhash...',
          scopes: ['envelopes:create'],
          status: 'active',
          rateLimitTier: 'standard',
          createdAt: '2026-09-29T10:00:00Z',
        },
      });

      const res = await rotateApiKeyAction(wsId, 'key_old_01');
      expect(res.success).toBe(true);
      expect(res.rawKey).toContain('sapp_live_newp1234');
    });
  });

  describe('Embed Origins Actions', () => {
    it('updates allowed embed origins after sanitization', async () => {
      const res = await updateAllowedEmbedOriginsAction(wsId, [
        'https://app.crm-partner.com/',
        'https://subdomain.portal.org',
      ]);

      expect(res.success).toBe(true);
      expect(res.origins).toEqual([
        'https://app.crm-partner.com',
        'https://subdomain.portal.org',
      ]);
    });

    it('rejects invalid origin URLs or wildcards', async () => {
      const res = await updateAllowedEmbedOriginsAction(wsId, ['*', 'javascript:alert(1)']);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid origin');
    });

    it('gets allowed embed origins for workspace', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          allowedEmbedOrigins: ['https://partner.com'],
        }),
      };

      vi.mocked(adminDb.doc).mockReturnValue({
        get: vi.fn().mockResolvedValue(mockDoc),
        set: vi.fn(),
      } as unknown as ReturnType<typeof adminDb.doc>);

      const res = await getAllowedEmbedOriginsAction(wsId);
      expect(res.success).toBe(true);
      expect(res.origins).toEqual(['https://partner.com']);
    });
  });

  describe('Webhook & Offline Queue Actions', () => {
    it('simulates webhook delivery with HMAC preview', async () => {
      const res = await testWebhookDeliveryAction(
        wsId,
        'https://webhook.site/test-endpoint',
        'envelope.signed'
      );

      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(res.signatureHeader).toBeDefined();
    });

    it('rejects invalid webhook target URL', async () => {
      const res = await testWebhookDeliveryAction(wsId, 'not-a-url', 'envelope.signed');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid webhook URL');
    });

    it('returns offline sync queue status metrics', async () => {
      const res = await getOfflineSyncQueueStatusAction(wsId);
      expect(res.success).toBe(true);
      expect(typeof res.pendingCount).toBe('number');
      expect(typeof res.syncedCount).toBe('number');
      expect(typeof res.conflictCount).toBe('number');
    });
  });
});
