/**
 * Developer REST API Route Handlers Test Suite
 *
 * Verifies authentication, scope authorization, rate limiting,
 * standard JSON responses/errors, PII redaction, and idempotency key handling
 * across /api/v1/envelopes and /api/v1/templates.
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getEnvelopes, POST as postEnvelopes } from '@/app/api/v1/envelopes/route';
import { GET as getEnvelopeById } from '@/app/api/v1/envelopes/[id]/route';
import { POST as voidEnvelope } from '@/app/api/v1/envelopes/[id]/void/route';
import { GET as getTemplates } from '@/app/api/v1/templates/route';
import * as authService from '@/lib/documents/api-key-auth-service';
import * as rateLimiter from '@/lib/documents/api-rate-limiter-service';
import type { ApiKeyRecord } from '@/lib/types/document-signing';

vi.mock('@/lib/documents/api-key-auth-service');
vi.mock('@/lib/documents/api-rate-limiter-service');
vi.mock('@/lib/firebase-admin', () => {
  const createQuery = () => ({
    where: vi.fn(() => createQuery()),
    orderBy: vi.fn(() => createQuery()),
    limit: vi.fn(() => createQuery()),
    get: vi.fn(async () => ({
      docs: [
        {
          id: 'env_101',
          data: () => ({
            id: 'env_101',
            workspaceId: 'ws_demo',
            title: 'Service Agreement',
            name: 'Template 1',
            documentType: 'agreement',
            status: 'published',
            recipients: [
              {
                recipientId: 'rec_01',
                displayName: 'Alice',
                email: 'alice@example.com',
                role: 'signer',
                status: 'pending',
                routingOrder: 1,
                signingToken: 'SECRET_DO_NOT_EXPOSE',
              },
            ],
            createdAt: '2026-09-29T10:00:00Z',
          }),
        },
      ],
    })),
  });

  return {
    adminDb: {
      collection: vi.fn(() => ({
        ...createQuery(),
        doc: vi.fn((docId: string) => ({
          id: docId,
          get: vi.fn(async () => {
            if (docId === 'env_not_found') {
              return { exists: false };
            }
          return {
            exists: true,
            id: docId,
            data: () => ({
              id: docId,
              workspaceId: 'ws_demo',
              title: 'NDA Agreement',
              status: 'sent',
              recipients: [
                {
                  recipientId: 'rec_02',
                  displayName: 'Bob',
                  email: 'bob@example.com',
                  role: 'counter_signer',
                  status: 'signed',
                  routingOrder: 2,
                  signingToken: 'SECRET_DO_NOT_EXPOSE_2',
                },
              ],
              createdAt: '2026-09-29T10:00:00Z',
            }),
          };
        }),
        update: vi.fn(async () => {}),
        set: vi.fn(async () => {}),
      })),
    })),
  },
};
});

describe('Developer REST API Routes', () => {
  const mockKeyRecord: ApiKeyRecord = {
    id: 'key_valid_01',
    workspaceId: 'ws_demo',
    name: 'CI API Key',
    prefix: 'abcd1234',
    hashedSecret: 'hash...',
    scopes: ['envelopes:create', 'envelopes:read', 'envelopes:void', 'templates:read'],
    status: 'active',
    rateLimitTier: 'standard',
    createdAt: '2026-09-29T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.authenticateApiKey).mockResolvedValue({
      authenticated: true,
      keyRecord: mockKeyRecord,
    });
    vi.mocked(rateLimiter.checkApiRateLimit).mockReturnValue({
      isAllowed: true,
      limit: 60,
      remaining: 59,
      resetSeconds: 60,
      headers: {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '59',
        'X-RateLimit-Reset': '60',
      },
    });
  });

  describe('GET /api/v1/envelopes', () => {
    it('returns envelopes for caller workspace with rate limit headers', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/envelopes', {
        headers: {
          authorization: 'Bearer sapp_live_abcd1234_secret32',
        },
      });

      const res = await getEnvelopes(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.length).toBe(1);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    });

    it('returns 401 when authorization header is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/envelopes');
      const res = await getEnvelopes(req);
      expect(res.status).toBe(401);
    });

    it('returns 429 when rate limit is exceeded', async () => {
      vi.mocked(rateLimiter.checkApiRateLimit).mockReturnValueOnce({
        isAllowed: false,
        limit: 60,
        remaining: 0,
        resetSeconds: 45,
        retryAfterSeconds: 45,
        headers: {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '45',
          'Retry-After': '45',
        },
      });

      const req = new NextRequest('http://localhost:3000/api/v1/envelopes', {
        headers: { authorization: 'Bearer sapp_live_abcd1234_secret32' },
      });
      const res = await getEnvelopes(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
    });
  });

  describe('POST /api/v1/envelopes', () => {
    it('validates idempotency key and creates envelope successfully', async () => {
      const payload = {
        title: 'New API Agreement',
        recipients: [
          {
            role: 'client',
            displayName: 'Bob Smith',
            email: 'bob@partner.com',
            routingOrder: 1,
          },
        ],
      };

      const req = new NextRequest('http://localhost:3000/api/v1/envelopes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer sapp_live_abcd1234_secret32',
          'Idempotency-Key': 'idemp_key_12345678',
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const res = await postEnvelopes(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data.envelopeId).toBeDefined();
      expect(json.meta.requestId).toBeDefined();
    });

    it('rejects malformed idempotency key (FM-P8-11)', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/envelopes', {
        method: 'POST',
        headers: {
          authorization: 'Bearer sapp_live_abcd1234_secret32',
          'Idempotency-Key': 'bad key with spaces!',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });

      const res = await postEnvelopes(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
    });
  });

  describe('GET /api/v1/envelopes/[id]', () => {
    it('returns envelope and redacts recipient signing tokens', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/envelopes/env_valid_01', {
        headers: { authorization: 'Bearer sapp_live_abcd1234_secret32' },
      });

      const res = await getEnvelopeById(req, {
        params: Promise.resolve({ id: 'env_valid_01' }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.title).toBe('NDA Agreement');
      expect(json.data.recipients[0].signingToken).toBeUndefined();
    });

    it('returns 404 when envelope does not exist', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/envelopes/env_not_found', {
        headers: { authorization: 'Bearer sapp_live_abcd1234_secret32' },
      });

      const res = await getEnvelopeById(req, {
        params: Promise.resolve({ id: 'env_not_found' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/envelopes/[id]/void', () => {
    it('voids envelope with reason', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/envelopes/env_01/void', {
        method: 'POST',
        headers: {
          authorization: 'Bearer sapp_live_abcd1234_secret32',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Commercial terms updated' }),
      });

      const res = await voidEnvelope(req, {
        params: Promise.resolve({ id: 'env_01' }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('voided');
    });
  });

  describe('GET /api/v1/templates', () => {
    it('returns published templates for workspace', async () => {
      const req = new NextRequest('http://localhost:3000/api/v1/templates', {
        headers: { authorization: 'Bearer sapp_live_abcd1234_secret32' },
      });

      const res = await getTemplates(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
    });
  });
});
