/**
 * Dedicated Phase 8 Integration & End-to-End Test Suite
 *
 * Verifies the complete developer platform, embedded SDK, offline PWA engine,
 * and security barriers:
 * 1. API key generation, timing-safe verification, scope checks, and rate-limiting.
 * 2. Developer REST API helpers and response formatting.
 * 3. Embed origin whitelisting and frame-ancestors CSP generation.
 * 4. postMessage bi-directional payload validation.
 * 5. Debounced height clamping with 8px deadband.
 * 6. High-resolution biometric stroke capture and entropy calculation.
 * 7. Offline package packaging with device fingerprint and document SHA-256.
 * 8. Replay of offline signing packages onto active envelopes.
 * 9. Conflict quarantine of offline packages when envelope is voided/expired.
 * 10. Conflict quarantine when recipient has already signed online.
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateApiKey,
  authenticateApiKey,
  revokeApiKey,
  rotateApiKey,
} from '@/lib/documents/api-key-auth-service';
import {
  checkApiRateLimit,
  resetRateLimitForTesting,
} from '@/lib/documents/api-rate-limiter-service';
import {
  formatSuccessResponse,
  formatErrorResponse,
  authenticateDeveloperRequest,
} from '@/lib/documents/developer-api-helper';
import {
  validateEmbedOrigin,
  generateEmbedCspHeader,
  parseEmbedMessage,
  calculateClampedEmbedHeight,
} from '@/lib/documents/embedded-signing-service';
import {
  calculateBiometricEntropy,
  createOfflineSigningPackage,
  replayOfflineSigningPackage,
} from '@/lib/documents/offline-signing-service';
import { adminDb } from '@/lib/firebase-admin';
import type { OfflineBiometricStroke, SigningEnvelope } from '@/lib/types/document-signing';

vi.mock('@/lib/firebase-admin', () => {
  const store = new Map<string, Record<string, unknown>>();
  const conflicts: Record<string, unknown>[] = [];

  const mockDocRef = (path: string) => ({
    id: path.split('/').pop() || 'doc',
    get: vi.fn(async () => {
      const data = store.get(path);
      return {
        exists: Boolean(data),
        id: path.split('/').pop() || 'doc',
        data: () => data,
      };
    }),
    set: vi.fn(async (data: Record<string, unknown>) => {
      store.set(path, data);
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      const existing = store.get(path) || {};
      store.set(path, { ...existing, ...data });
    }),
  });

  type Filter = { field: string; op: string; val: unknown };

  interface MockQuery {
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  }

  const createQuery = (colOrGroup: string, filters: Filter[] = []): MockQuery => {
    const q: MockQuery = {
      where: vi.fn((field: string, op: string, val: unknown) => {
        return createQuery(colOrGroup, [...filters, { field, op, val }]);
      }),
      orderBy: vi.fn(() => q),
      limit: vi.fn(() => q),
      get: vi.fn(async () => {
        const docs: { id: string; data: () => Record<string, unknown>; update: (d: Record<string, unknown>) => Promise<void> }[] = [];
        for (const [key, value] of store.entries()) {
          const matchesCollection = key.includes(colOrGroup);
          if (matchesCollection) {
            let passes = true;
            for (const f of filters) {
              if (f.op === '==' && value[f.field] !== f.val) {
                passes = false;
                break;
              }
            }
            if (passes) {
              docs.push({
                id: key.split('/').pop() || 'doc',
                data: () => value,
                update: async (d: Record<string, unknown>) => {
                  store.set(key, { ...value, ...d });
                },
              });
            }
          }
        }
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
        };
      }),
    };
    return q;
  };

  const mockCollection = (colPath: string) => {
    const groupName = colPath.split('/').pop() || colPath;
    const query = createQuery(groupName);
    return {
      doc: vi.fn((docId: string) => mockDocRef(`${colPath}/${docId}`)),
      add: vi.fn(async (data: Record<string, unknown>) => {
        conflicts.push(data);
        return { id: `conf_${Date.now()}` };
      }),
      where: query.where,
      orderBy: query.orderBy,
      limit: query.limit,
      get: query.get,
    };
  };

  return {
    adminDb: {
      collection: vi.fn((path: string) => mockCollection(path)),
      collectionGroup: vi.fn((group: string) => createQuery(group)),
      doc: vi.fn((path: string) => mockDocRef(path)),
    },
    __store: store,
    __conflicts: conflicts,
  };
});

describe('Phase 8: Developer Platform & Embedded SDK Integration Suite', () => {
  const wsId = 'ws_integration_p8';

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitForTesting();
  });

  describe('1. API Key Lifecycle & Verification Engine', () => {
    it('generates, authenticates, and validates scopes for a key', async () => {
      const { rawKey, keyRecord } = await generateApiKey({
        workspaceId: wsId,
        name: 'Integration Key',
        scopes: ['envelopes:create', 'envelopes:read'],
        rateLimitTier: 'standard',
      });

      expect(rawKey).toMatch(/^sapp_live_[a-f0-9]{8}_[a-f0-9]{32}$/);
      expect(keyRecord.status).toBe('active');
      expect(keyRecord.hashedSecret).not.toBe(rawKey);

      // Authenticate with required scope
      const authSuccess = await authenticateApiKey(rawKey, 'envelopes:create');
      expect(authSuccess.authenticated).toBe(true);
      expect(authSuccess.keyRecord?.id).toBe(keyRecord.id);

      // Reject with insufficient scope
      const authForbidden = await authenticateApiKey(rawKey, 'envelopes:void');
      expect(authForbidden.authenticated).toBe(false);
      expect(authForbidden.reason).toContain('Insufficient scope');
    });

    it('rotates API key and verifies old key is revoked while new key works', async () => {
      const { rawKey: oldRawKey, keyRecord: oldRecord } = await generateApiKey({
        workspaceId: wsId,
        name: 'To Rotate',
        scopes: ['templates:read'],
      });

      const { newRawKey, newKeyRecord } = await rotateApiKey(wsId, oldRecord.id);

      // Old key revoked
      const oldAuth = await authenticateApiKey(oldRawKey);
      expect(oldAuth.authenticated).toBe(false);
      expect(oldAuth.reason).toContain('revoked');

      // New key active
      const newAuth = await authenticateApiKey(newRawKey, 'templates:read');
      expect(newAuth.authenticated).toBe(true);
      expect(newAuth.keyRecord?.id).toBe(newKeyRecord.id);
    });
  });

  describe('2. Rate Limiting Guard & Header Injection', () => {
    it('allows requests within standard tier limit and blocks upon exhaustion', () => {
      const keyPrefix = 'ratelimit_p8_test';

      // 60 allowed requests
      for (let i = 0; i < 60; i++) {
        const check = checkApiRateLimit(keyPrefix, 'standard');
        expect(check.isAllowed).toBe(true);
      }

      // 61st request blocked
      const blocked = checkApiRateLimit(keyPrefix, 'standard');
      expect(blocked.isAllowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.headers['Retry-After']).toBeDefined();
    });
  });

  describe('3. Developer REST API Request Interceptor', () => {
    it('authenticates incoming Request and injects rate limit headers', async () => {
      const { rawKey } = await generateApiKey({
        workspaceId: wsId,
        name: 'REST Interceptor Key',
        scopes: ['envelopes:read'],
      });

      const request = new Request('http://localhost:3000/api/v1/envelopes', {
        headers: {
          authorization: `Bearer ${rawKey}`,
        },
      });

      const authResult = await authenticateDeveloperRequest(request, 'envelopes:read');
      expect(authResult.authenticated).toBe(true);
      if (authResult.authenticated) {
        expect(authResult.rateLimitHeaders['X-RateLimit-Limit']).toBe('60');
      }
    });

    it('formats standardized error responses with request IDs', async () => {
      const errorResponse = formatErrorResponse(
        'INVALID_REQUEST',
        'Payload failed schema validation',
        400
      );
      const json = await errorResponse.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('INVALID_REQUEST');
      expect(json.error.requestId).toMatch(/^err_/);
    });
  });

  describe('4. Embedded SDK & CSP Protection', () => {
    it('generates frame-ancestors CSP directive for whitelisted partner origins', () => {
      const csp = generateEmbedCspHeader([
        'https://partner-portal.com',
        'https://crm.institution.edu',
      ]);
      expect(csp).toBe(
        "frame-ancestors 'self' https://partner-portal.com https://crm.institution.edu;"
      );
    });

    it('enforces height bounds and 8px deadband for resize requests', () => {
      // Clamps under 500
      expect(calculateClampedEmbedHeight(450).height).toBe(500);
      // Clamps over 2400
      expect(calculateClampedEmbedHeight(2600).height).toBe(2400);

      // Deadband: 4px difference ignored
      const deadband = calculateClampedEmbedHeight(804, 800);
      expect(deadband.shouldUpdate).toBe(false);

      // Beyond deadband: 12px difference accepted
      const activeResize = calculateClampedEmbedHeight(812, 800);
      expect(activeResize.shouldUpdate).toBe(true);
      expect(activeResize.height).toBe(812);
    });

    it('validates and discriminates all postMessage events', () => {
      expect(parseEmbedMessage({ type: 'handshake_init', token: 'tok_1' })?.type).toBe(
        'handshake_init'
      );
      expect(
        parseEmbedMessage({
          type: 'recipient_signed',
          envelopeId: 'env_1',
          recipientId: 'rec_1',
          timestamp: '2026-09-29T12:00:00Z',
        })?.type
      ).toBe('recipient_signed');
      expect(parseEmbedMessage({ type: 'untrusted_malicious_event' })).toBeNull();
    });
  });

  describe('5. Offline Biometrics & Conflict-Isolated Replay', () => {
    const sampleStrokes: OfflineBiometricStroke[] = [
      {
        points: [
          { x: 10, y: 15, time: 2000, pressure: 0.7, velocity: 1.1 },
          { x: 20, y: 25, time: 2040, pressure: 0.8, velocity: 1.4 },
        ],
      },
      {
        points: [
          { x: 50, y: 60, time: 2100, pressure: 0.5, velocity: 0.9 },
          { x: 90, y: 100, time: 2200, pressure: 0.9, velocity: 2.0 },
        ],
      },
    ];

    it('computes positive biometric entropy and bounding box from strokes', () => {
      const entropy = calculateBiometricEntropy(sampleStrokes);
      expect(entropy.pointCount).toBe(4);
      expect(entropy.durationMs).toBe(200);
      expect(entropy.entropyScore).toBeGreaterThan(0);
      expect(entropy.boundingBox.width).toBe(80);
      expect(entropy.boundingBox.height).toBe(85);
    });

    it('replays offline package and advances active envelope to completed', async () => {
      const envelopeId = 'env_offline_integration';
      const envelopeData: SigningEnvelope = {
        id: envelopeId,
        workspaceId: wsId,
        title: 'Partnership Agreement',
        status: 'sent',
        routingMode: 'sequential',
        currentRoutingOrder: 1,
        preExecutionSha256: 'b'.repeat(64),
        documentStoragePath: 'storage/doc.pdf',
        expiresAt: '2026-10-30T00:00:00Z',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
        createdBy: 'usr_creator',
        recipients: [
          {
            id: 'rec_partner',
            name: 'Partner VP',
            email: 'vp@partner.com',
            role: 'signer',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'hash...',
            tokenExpiresAt: '2026-10-30T00:00:00Z',
            workspaceId: wsId,
            envelopeId,
          },
        ],
      };

      await adminDb.collection('signing_envelopes').doc(envelopeId).set(envelopeData);

      const pkg = createOfflineSigningPackage({
        envelopeId,
        recipientId: 'rec_partner',
        strokes: sampleStrokes,
        deviceFingerprint: 'tablet_ipad_air_04',
        documentSha256: 'b'.repeat(64),
      });

      const replayResult = await replayOfflineSigningPackage(wsId, pkg);
      expect(replayResult.success).toBe(true);
      expect(replayResult.status).toBe('synced');

      // Verify envelope completed
      const updatedEnvelope = (
        await adminDb.collection('signing_envelopes').doc(envelopeId).get()
      ).data() as SigningEnvelope;
      expect(updatedEnvelope.status).toBe('completed');
      expect(updatedEnvelope.recipients[0].status).toBe('signed');
    });

    it('quarantines payload when envelope was voided during the offline period (FM-P8-07)', async () => {
      const envelopeId = 'env_voided_integration';
      const voidedEnvelope: SigningEnvelope = {
        id: envelopeId,
        workspaceId: wsId,
        title: 'Voided Agreement',
        status: 'voided',
        routingMode: 'sequential',
        currentRoutingOrder: 1,
        preExecutionSha256: 'c'.repeat(64),
        documentStoragePath: 'storage/doc.pdf',
        expiresAt: '2026-10-30T00:00:00Z',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
        createdBy: 'usr_creator',
        voidReason: 'Sender cancelled agreement terms',
        recipients: [
          {
            id: 'rec_void_signer',
            name: 'Signer',
            email: 'signer@example.com',
            role: 'signer',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'hash...',
            tokenExpiresAt: '2026-10-30T00:00:00Z',
            workspaceId: wsId,
            envelopeId,
          },
        ],
      };

      await adminDb.collection('signing_envelopes').doc(envelopeId).set(voidedEnvelope);

      const pkg = createOfflineSigningPackage({
        envelopeId,
        recipientId: 'rec_void_signer',
        strokes: sampleStrokes,
        deviceFingerprint: 'tablet_samsung_01',
        documentSha256: 'c'.repeat(64),
      });

      const replayResult = await replayOfflineSigningPackage(wsId, pkg);
      expect(replayResult.success).toBe(false);
      expect(replayResult.status).toBe('conflict');
      expect(replayResult.reason).toContain('voided');
    });

    it('quarantines payload when recipient already executed online during offline window (FM-P8-08)', async () => {
      const envelopeId = 'env_doublesign_integration';
      const envelopeData: SigningEnvelope = {
        id: envelopeId,
        workspaceId: wsId,
        title: 'Concurrent Signed Agreement',
        status: 'sent',
        routingMode: 'sequential',
        currentRoutingOrder: 1,
        preExecutionSha256: 'd'.repeat(64),
        documentStoragePath: 'storage/doc.pdf',
        expiresAt: '2026-10-30T00:00:00Z',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
        createdBy: 'usr_creator',
        recipients: [
          {
            id: 'rec_already_signed',
            name: 'Alice Cooper',
            email: 'alice@example.com',
            role: 'signer',
            routingOrder: 1,
            status: 'signed', // Already marked signed on server
            signedAt: '2026-09-29T01:00:00Z',
            tokenHash: 'hash...',
            tokenExpiresAt: '2026-10-30T00:00:00Z',
            workspaceId: wsId,
            envelopeId,
          },
        ],
      };

      await adminDb.collection('signing_envelopes').doc(envelopeId).set(envelopeData);

      const pkg = createOfflineSigningPackage({
        envelopeId,
        recipientId: 'rec_already_signed',
        strokes: sampleStrokes,
        deviceFingerprint: 'tablet_offline_02',
        documentSha256: 'd'.repeat(64),
      });

      const replayResult = await replayOfflineSigningPackage(wsId, pkg);
      expect(replayResult.success).toBe(false);
      expect(replayResult.status).toBe('conflict');
      expect(replayResult.reason).toContain('already executed this agreement online');
    });

    it('quarantines payload when document digest has diverged from preExecutionSha256 (FM-P8-09)', async () => {
      const envelopeId = 'env_tampered_digest_integration';
      const envelopeData: SigningEnvelope = {
        id: envelopeId,
        workspaceId: wsId,
        title: 'Divergent Digest Agreement',
        status: 'sent',
        routingMode: 'sequential',
        currentRoutingOrder: 1,
        preExecutionSha256: 'e'.repeat(64),
        documentStoragePath: 'storage/doc.pdf',
        expiresAt: '2026-10-30T00:00:00Z',
        createdAt: '2026-09-29T00:00:00Z',
        updatedAt: '2026-09-29T00:00:00Z',
        createdBy: 'usr_creator',
        recipients: [
          {
            id: 'rec_divergent_signer',
            name: 'Bob Marley',
            email: 'bob@example.com',
            role: 'signer',
            routingOrder: 1,
            status: 'invited',
            tokenHash: 'hash...',
            tokenExpiresAt: '2026-10-30T00:00:00Z',
            workspaceId: wsId,
            envelopeId,
          },
        ],
      };

      await adminDb.collection('signing_envelopes').doc(envelopeId).set(envelopeData);

      const pkg = createOfflineSigningPackage({
        envelopeId,
        recipientId: 'rec_divergent_signer',
        strokes: sampleStrokes,
        deviceFingerprint: 'tablet_offline_03',
        documentSha256: 'f'.repeat(64), // Mismatch with server 'e'.repeat(64)
      });

      const replayResult = await replayOfflineSigningPackage(wsId, pkg);
      expect(replayResult.success).toBe(false);
      expect(replayResult.status).toBe('conflict');
      expect(replayResult.reason).toContain('hash mismatch');
    });
  });
});
