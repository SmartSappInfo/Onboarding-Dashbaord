/**
 * Developer Platform, Scoped API Keys, Embedded SDK & Offline Biometrics Schemas Test Suite
 *
 * Verifies strict runtime type safety, Zod schema validation, payload bounds,
 * and zero-any compliance for Phase 8 Developer Platform additions.
 *
 * @maintainer Antigravity Pair Programming
 */

import { describe, it, expect } from 'vitest';
import {
  ApiKeyScopeSchema,
  ApiKeyRecordSchema,
  CreateApiKeyRequestSchema,
  CreateEnvelopeApiRequestSchema,
  EmbedMessageSchema,
  OfflineBiometricStrokeSchema,
  OfflineSigningPayloadSchema,
  OfflineSyncRecordSchema,
  RateLimitConfigSchema,
  DeveloperWebhookSubscriptionSchema,
} from '@/lib/types/document-signing';

describe('Developer Platform Domain Schemas', () => {
  describe('ApiKeyScopeSchema', () => {
    it('validates supported permission scopes', () => {
      expect(ApiKeyScopeSchema.parse('envelopes:create')).toBe('envelopes:create');
      expect(ApiKeyScopeSchema.parse('envelopes:read')).toBe('envelopes:read');
      expect(ApiKeyScopeSchema.parse('envelopes:void')).toBe('envelopes:void');
      expect(ApiKeyScopeSchema.parse('templates:read')).toBe('templates:read');
      expect(ApiKeyScopeSchema.parse('webhooks:manage')).toBe('webhooks:manage');
    });

    it('rejects unsupported scopes', () => {
      expect(() => ApiKeyScopeSchema.parse('admin:root')).toThrow();
      expect(() => ApiKeyScopeSchema.parse('')).toThrow();
    });
  });

  describe('ApiKeyRecordSchema & CreateApiKeyRequestSchema', () => {
    it('validates a valid API key record', () => {
      const validKey = {
        id: 'key_123',
        workspaceId: 'ws_demo',
        name: 'Zapier ERP Integration',
        prefix: 'sapp_live_abcd1234',
        hashedSecret: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        scopes: ['envelopes:create', 'envelopes:read'],
        status: 'active' as const,
        rateLimitTier: 'standard' as const,
        createdAt: '2026-09-29T10:00:00Z',
      };
      const parsed = ApiKeyRecordSchema.parse(validKey);
      expect(parsed.name).toBe('Zapier ERP Integration');
      expect(parsed.rateLimitTier).toBe('standard');
    });

    it('validates create API key request and applies defaults', () => {
      const req = {
        name: 'Test Partner Key',
        scopes: ['templates:read'],
      };
      const parsed = CreateApiKeyRequestSchema.parse(req);
      expect(parsed.rateLimitTier).toBe('standard');
      expect(parsed.scopes).toEqual(['templates:read']);
    });

    it('rejects empty scopes in create API key request', () => {
      expect(() =>
        CreateApiKeyRequestSchema.parse({
          name: 'Invalid Key',
          scopes: [],
        })
      ).toThrow();
    });
  });

  describe('CreateEnvelopeApiRequestSchema', () => {
    it('validates a valid programmatic envelope dispatch request', () => {
      const payload = {
        title: 'Enterprise Master Services Agreement',
        templateId: 'tpl_msa_01',
        recipients: [
          {
            role: 'client_signatory',
            displayName: 'Alice Johnson',
            email: 'alice@partner.com',
            routingOrder: 1,
            verificationPolicy: 'email' as const,
          },
        ],
        metadata: {
          externalAccountId: 'ACC-9988',
        },
        externalReferenceId: 'EXT-1234',
      };
      const parsed = CreateEnvelopeApiRequestSchema.parse(payload);
      expect(parsed.title).toBe('Enterprise Master Services Agreement');
      expect(parsed.recipients.length).toBe(1);
    });

    it('rejects payload exceeding recipient ceiling (> 10 recipients)', () => {
      const invalidRecipients = Array.from({ length: 11 }, (_, i) => ({
        role: `signer_${i}`,
        displayName: `Signer ${i}`,
        email: `signer${i}@example.com`,
      }));

      expect(() =>
        CreateEnvelopeApiRequestSchema.parse({
          title: 'Bulk Overload',
          recipients: invalidRecipients,
        })
      ).toThrow();
    });
  });

  describe('EmbedMessageSchema', () => {
    it('validates handshake_init message', () => {
      const parsed = EmbedMessageSchema.parse({
        type: 'handshake_init',
        token: 'sig_token_xyz987',
      });
      expect(parsed.type).toBe('handshake_init');
    });

    it('validates recipient_signed event message', () => {
      const parsed = EmbedMessageSchema.parse({
        type: 'recipient_signed',
        envelopeId: 'env_456',
        recipientId: 'rec_789',
        timestamp: '2026-09-29T10:05:00Z',
      });
      expect(parsed.type).toBe('recipient_signed');
    });

    it('validates resize_request message', () => {
      const parsed = EmbedMessageSchema.parse({
        type: 'resize_request',
        height: 850,
      });
      expect(parsed.type).toBe('resize_request');
    });

    it('rejects untrusted or unknown postMessage types', () => {
      expect(() =>
        EmbedMessageSchema.parse({
          type: 'eval_arbitrary_code',
          payload: 'alert(1)',
        })
      ).toThrow();
    });
  });

  describe('OfflineBiometricStrokeSchema & OfflineSigningPayloadSchema', () => {
    it('validates biometric stroke vectors with coordinates, timestamps, and pressure', () => {
      const stroke = {
        points: [
          { x: 10.5, y: 20.2, time: 1000, pressure: 0.65, velocity: 1.2 },
          { x: 12.0, y: 22.1, time: 1016, pressure: 0.72, velocity: 1.5 },
        ],
      };
      const parsed = OfflineBiometricStrokeSchema.parse(stroke);
      expect(parsed.points.length).toBe(2);
      expect(parsed.points[0].pressure).toBe(0.65);
    });

    it('validates complete offline signing payload', () => {
      const payload = {
        envelopeId: 'env_offline_01',
        recipientId: 'rec_offline_01',
        signedAt: '2026-09-29T10:10:00Z',
        strokes: [
          {
            points: [{ x: 5, y: 10, time: 500, pressure: 0.5 }],
          },
        ],
        deviceFingerprint: 'device_ipad_pro_arm64_ios18',
        documentSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        nonce: 'nonce_987654321',
      };
      const parsed = OfflineSigningPayloadSchema.parse(payload);
      expect(parsed.deviceFingerprint).toContain('ipad');
    });
  });

  describe('OfflineSyncRecordSchema & RateLimitConfigSchema', () => {
    it('validates offline sync queue record', () => {
      const syncRecord = {
        id: 'sync_001',
        workspaceId: 'ws_demo',
        envelopeId: 'env_001',
        recipientId: 'rec_001',
        status: 'pending' as const,
        payload: {
          envelopeId: 'env_001',
          recipientId: 'rec_001',
          signedAt: '2026-09-29T10:10:00Z',
          strokes: [],
          deviceFingerprint: 'device_01',
          documentSha256: 'sha_test',
          nonce: 'nonce_123',
        },
      };
      const parsed = OfflineSyncRecordSchema.parse(syncRecord);
      expect(parsed.status).toBe('pending');
    });

    it('validates rate limit configuration', () => {
      const config = {
        windowMs: 60000,
        maxRequests: 60,
      };
      const parsed = RateLimitConfigSchema.parse(config);
      expect(parsed.maxRequests).toBe(60);
    });

    it('validates developer webhook subscription schema', () => {
      const webhook = {
        id: 'wh_123',
        workspaceId: 'ws_demo',
        url: 'https://webhook.site/unique-uuid',
        events: ['envelope.completed', 'recipient.signed'],
        secret: 'whsec_abcdef1234567890',
        status: 'active' as const,
        createdAt: '2026-09-29T10:15:00Z',
      };
      const parsed = DeveloperWebhookSubscriptionSchema.parse(webhook);
      expect(parsed.events.length).toBe(2);
    });
  });
});
