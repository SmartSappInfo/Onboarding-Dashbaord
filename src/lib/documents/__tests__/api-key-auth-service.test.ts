/**
 * Scoped API Key Authentication & Timing-Safe Verification Engine Test Suite
 *
 * Verifies cryptographic key generation, prefix indexing, SHA-256 hashing,
 * constant-time verification (crypto.timingSafeEqual), scope gating,
 * key rotation, and revocation.
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateApiKey,
  authenticateApiKey,
  revokeApiKey,
  rotateApiKey,
  listApiKeys,
} from '@/lib/documents/api-key-auth-service';
import type { ApiKeyRecord } from '@/lib/types/document-signing';

// In-memory Firestore mock store
const mockApiKeyStore = new Map<string, ApiKeyRecord>();

vi.mock('@/lib/firebase-admin', () => {
  const mockAdminDb = {
    collection: vi.fn((path: string) => {
      return {
        doc: vi.fn((docId?: string) => {
          const actualDocId = docId || `key_mock_${Math.random().toString(36).substring(7)}`;
          return {
            id: actualDocId,
            get: vi.fn(async () => {
              const record = mockApiKeyStore.get(actualDocId);
              return {
                exists: !!record,
                id: actualDocId,
                data: () => record,
              };
            }),
            set: vi.fn(async (data: ApiKeyRecord) => {
              mockApiKeyStore.set(actualDocId, data);
            }),
            update: vi.fn(async (partial: Partial<ApiKeyRecord>) => {
              const existing = mockApiKeyStore.get(actualDocId);
              if (existing) {
                mockApiKeyStore.set(actualDocId, { ...existing, ...partial });
              }
            }),
          };
        }),
        where: vi.fn((field: string, op: string, val: unknown) => {
          return {
            limit: vi.fn(() => ({
              get: vi.fn(async () => {
                const docs = Array.from(mockApiKeyStore.values())
                  .filter((rec) => {
                    if (field === 'prefix') return rec.prefix === val;
                    if (field === 'status') return rec.status === val;
                    return true;
                  })
                  .map((rec) => ({
                    id: rec.id,
                    exists: true,
                    data: () => rec,
                  }));
                return {
                  empty: docs.length === 0,
                  docs,
                };
              }),
            })),
            get: vi.fn(async () => {
              const docs = Array.from(mockApiKeyStore.values()).map((rec) => ({
                id: rec.id,
                exists: true,
                data: () => rec,
              }));
              return { docs };
            }),
          };
        }),
        get: vi.fn(async () => {
          const docs = Array.from(mockApiKeyStore.values()).map((rec) => ({
            id: rec.id,
            exists: true,
            data: () => rec,
          }));
          return { docs };
        }),
      };
    }),
    collectionGroup: vi.fn((_collectionId: string) => {
      return {
        where: vi.fn((field: string, op: string, val: unknown) => {
          return {
            limit: vi.fn(() => ({
              get: vi.fn(async () => {
                const docs = Array.from(mockApiKeyStore.values())
                  .filter((rec) => {
                    if (field === 'prefix') return rec.prefix === val;
                    if (field === 'status') return rec.status === val;
                    return true;
                  })
                  .map((rec) => ({
                    id: rec.id,
                    exists: true,
                    data: () => rec,
                    update: vi.fn(async (partial: Partial<ApiKeyRecord>) => {
                      const existing = mockApiKeyStore.get(rec.id);
                      if (existing) {
                        mockApiKeyStore.set(rec.id, { ...existing, ...partial });
                      }
                    }),
                  }));
                return {
                  empty: docs.length === 0,
                  docs,
                };
              }),
            })),
          };
        }),
      };
    }),
  };
  return { adminDb: mockAdminDb };
});

describe('ApiKeyAuthService', () => {
  beforeEach(() => {
    mockApiKeyStore.clear();
    vi.clearAllMocks();
  });

  describe('generateApiKey', () => {
    it('generates a formatted raw key and stores hashed secret in Firestore', async () => {
      const result = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Zapier ERP Sync',
        scopes: ['envelopes:create', 'envelopes:read'],
        rateLimitTier: 'standard',
      });

      expect(result.rawKey).toMatch(/^sapp_live_[a-f0-9]{8}_[a-f0-9]{32}$/);
      expect(result.keyRecord.prefix).toBe(result.rawKey.split('_')[2]);
      expect(result.keyRecord.hashedSecret.length).toBe(64); // SHA-256
      // Ensure raw key secret is NOT in stored record
      expect(result.keyRecord.hashedSecret).not.toBe(result.rawKey.split('_')[3]);

      expect(mockApiKeyStore.has(result.keyRecord.id)).toBe(true);
    });

    it('sets optional expiration timestamp when expiresInDays is provided', async () => {
      const result = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Temporary Script',
        scopes: ['templates:read'],
        expiresInDays: 30,
      });

      expect(result.keyRecord.expiresAt).toBeDefined();
    });
  });

  describe('authenticateApiKey', () => {
    it('authenticates valid raw key and checks scope correctly', async () => {
      const { rawKey } = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Accounting Portal',
        scopes: ['envelopes:create', 'envelopes:read'],
      });

      const authResult = await authenticateApiKey(rawKey, 'envelopes:create');
      expect(authResult.authenticated).toBe(true);
      expect(authResult.keyRecord?.name).toBe('Accounting Portal');
      expect(authResult.keyRecord?.workspaceId).toBe('ws_prod');
    });

    it('denies authentication if raw key is forged or secret does not match', async () => {
      const { rawKey } = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'CRM Webhook Key',
        scopes: ['webhooks:manage'],
      });

      const parts = rawKey.split('_');
      const forgedKey = `sapp_live_${parts[2]}_00000000000000000000000000000000`;

      const authResult = await authenticateApiKey(forgedKey);
      expect(authResult.authenticated).toBe(false);
      expect(authResult.reason).toContain('Invalid key');
    });

    it('denies authentication if key lacks required scope', async () => {
      const { rawKey } = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Read Only Key',
        scopes: ['envelopes:read'],
      });

      const authResult = await authenticateApiKey(rawKey, 'envelopes:create');
      expect(authResult.authenticated).toBe(false);
      expect(authResult.reason).toContain('Insufficient scope');
    });

    it('denies authentication if key is revoked', async () => {
      const { rawKey, keyRecord } = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Deprecating Key',
        scopes: ['envelopes:read'],
      });

      await revokeApiKey('ws_prod', keyRecord.id);

      const authResult = await authenticateApiKey(rawKey);
      expect(authResult.authenticated).toBe(false);
      expect(authResult.reason).toContain('Key revoked');
    });

    it('denies authentication if key is expired', async () => {
      const { rawKey, keyRecord } = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Expired Key',
        scopes: ['templates:read'],
      });

      // Set expiration in past
      mockApiKeyStore.set(keyRecord.id, {
        ...keyRecord,
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
      });

      const authResult = await authenticateApiKey(rawKey);
      expect(authResult.authenticated).toBe(false);
      expect(authResult.reason).toContain('Key expired');
    });
  });

  describe('rotateApiKey', () => {
    it('revokes existing key and generates a new active key with identical scopes', async () => {
      const { rawKey: oldRawKey, keyRecord: oldKeyRecord } = await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Rotate Target',
        scopes: ['envelopes:create', 'webhooks:manage'],
        rateLimitTier: 'enterprise',
      });

      const rotationResult = await rotateApiKey('ws_prod', oldKeyRecord.id);
      expect(rotationResult.newRawKey).not.toBe(oldRawKey);
      expect(rotationResult.newKeyRecord.scopes).toEqual(['envelopes:create', 'webhooks:manage']);
      expect(rotationResult.newKeyRecord.rateLimitTier).toBe('enterprise');

      // Old key must now be revoked
      const oldAuth = await authenticateApiKey(oldRawKey);
      expect(oldAuth.authenticated).toBe(false);

      // New key must be active
      const newAuth = await authenticateApiKey(rotationResult.newRawKey);
      expect(newAuth.authenticated).toBe(true);
    });
  });

  describe('listApiKeys', () => {
    it('returns masked key list for workspace', async () => {
      await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Key 1',
        scopes: ['envelopes:read'],
      });
      await generateApiKey({
        workspaceId: 'ws_prod',
        name: 'Key 2',
        scopes: ['templates:read'],
      });

      const keys = await listApiKeys('ws_prod');
      expect(keys.length).toBe(2);
      expect(keys[0].name).toBeDefined();
    });
  });
});
