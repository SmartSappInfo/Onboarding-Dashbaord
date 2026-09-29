/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Dedicated Phase 6 Integration & Verification Test Suite:
 * 1. Purpose:
 *    Provides end-to-end integration assertions for Phase 6 enterprise capabilities:
 *    - Chained AST formula evaluation in strict topological dependency order
 *    - Circular dependency detection with accurate cycle path tracing (FM-P6-07)
 *    - Webhook HMAC-SHA256 signature verification and replay-window enforcement (>300s rejection)
 *    - Legal hold deletion barrier preventing destruction of frozen agreements (FM-P6-03)
 *    - Distributed circuit breaker trip and recovery states across simulated containers (FM-P6-05)
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectFormulaCycles,
  recomputeAllFormulasAuthoritative,
  FieldWithFormulaInput,
} from '@/lib/documents/computed-field-service';
import {
  generateWebhookHmacSignature,
  verifyWebhookHmacSignature,
  calculateBackoffDelayMs,
} from '@/lib/documents/document-webhook-service';
import {
  checkContractDeletionEligibility,
  generateEvidencePackageManifest,
} from '@/lib/documents/document-governance-service';
import {
  checkCircuitBreakerStatus,
  recordCircuitBreakerFailure,
} from '@/lib/documents/resilient-outbox-service';

// Mock Firebase Admin
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      })),
      where: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Document Signing Modernization — Phase 6 Dedicated Integration Suite', () => {
  const workspaceId = 'ws_enterprise_phase6';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });
  });

  describe('1. Chained Formula Evaluation & Anti-Tampering (FM-P6-01 & FM-P6-07)', () => {
    it('evaluates a 3-tier chained formula dependency in strict topological order', () => {
      // Tier 1: subtotal = item1 + item2 (100 + 50 = 150)
      // Tier 2: tax = subtotal * 10% (150 * 10 / 100 = 15)
      // Tier 3: total = subtotal + tax (150 + 15 = 165)
      const fields = [
        {
          id: 'item1',
          name: 'item1',
          type: 'number' as const,
          page: 1,
          bounds: { x: 0, y: 0, width: 10, height: 5 },
          value: '100.00',
        },
        {
          id: 'item2',
          name: 'item2',
          type: 'number' as const,
          page: 1,
          bounds: { x: 0, y: 0, width: 10, height: 5 },
          value: '50.00',
        },
        {
          id: 'tax_rate',
          name: 'tax_rate',
          type: 'number' as const,
          page: 1,
          bounds: { x: 0, y: 0, width: 10, height: 5 },
          value: '10',
        },
        {
          id: 'subtotal',
          name: 'subtotal',
          type: 'number' as const,
          page: 1,
          bounds: { x: 0, y: 0, width: 10, height: 5 },
          value: '1.00', // Client spoofed value
          formula: {
            type: 'sum' as const,
            expression: 'SUM(item1, item2)',
            sourceFieldIds: ['item1', 'item2'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'tax',
          name: 'tax',
          type: 'number' as const,
          page: 1,
          bounds: { x: 0, y: 0, width: 10, height: 5 },
          value: '0.10', // Client spoofed value
          formula: {
            type: 'tax' as const,
            expression: 'TAX(subtotal, tax_rate)',
            sourceFieldIds: ['subtotal', 'tax_rate'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'total',
          name: 'total',
          type: 'number' as const,
          page: 1,
          bounds: { x: 0, y: 0, width: 10, height: 5 },
          value: '1.10', // Client spoofed value
          formula: {
            type: 'sum' as const,
            expression: 'SUM(subtotal, tax)',
            sourceFieldIds: ['subtotal', 'tax'],
            decimalPlaces: 2,
          },
        },
      ];

      const authoritativeValues = recomputeAllFormulasAuthoritative(fields);

      // Verify that server authoritative evaluation completely overwrote client tampering
      expect(authoritativeValues['subtotal']).toBe('150.00');
      expect(authoritativeValues['tax']).toBe('15.00');
      expect(authoritativeValues['total']).toBe('165.00');
    });

    it('detects circular formula loops and reports the cycle path', () => {
      const cyclicFields: FieldWithFormulaInput[] = [
        {
          id: 'fieldA',
          formula: {
            type: 'sum',
            expression: 'SUM(fieldB)',
            sourceFieldIds: ['fieldB'],
            decimalPlaces: 2,
          },
        },
        {
          id: 'fieldB',
          formula: {
            type: 'sum',
            expression: 'SUM(fieldA)',
            sourceFieldIds: ['fieldA'],
            decimalPlaces: 2,
          },
        },
      ];

      const check = detectFormulaCycles(cyclicFields);
      expect(check.hasCycle).toBe(true);
      expect(check.cyclePath).toBeDefined();
      expect(check.cyclePath?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Webhook HMAC-SHA256 Signatures & Replay Defenses (FM-P6-02)', () => {
    const payload = JSON.stringify({ event: 'signing.envelope_completed', envelopeId: 'env_999' });
    const secret = 'enterprise_signing_hmac_secret_key_888';

    it('verifies valid HMAC header within timestamp tolerance window', () => {
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const signature = generateWebhookHmacSignature(payload, secret, nowTimestamp);

      const isValid = verifyWebhookHmacSignature(payload, secret, signature, 300);
      expect(isValid).toBe(true);
    });

    it('rejects stale webhook signature exceeding 300 second replay window', () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
      const signature = generateWebhookHmacSignature(payload, secret, staleTimestamp);

      const isValid = verifyWebhookHmacSignature(payload, secret, signature, 300);
      expect(isValid).toBe(false);
    });

    it('computes expected exponential backoff progression and dead-letters after 5 retries', () => {
      expect(calculateBackoffDelayMs(0)).toBe(60000); // 1m
      expect(calculateBackoffDelayMs(1)).toBe(300000); // 5m
      expect(calculateBackoffDelayMs(4)).toBe(21600000); // 6h
      expect(calculateBackoffDelayMs(5)).toBe(-1); // DLQ transition
    });
  });

  describe('3. Litigation Legal Hold Deletion Barrier (FM-P6-03)', () => {
    it('blocks contract deletion when contract is under active legal hold', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          isUnderLegalHold: true,
          legalHoldDetails: {
            reason: 'Department of Justice Subpoena Ref #8821',
          },
        }),
      });

      const eligibility = await checkContractDeletionEligibility(workspaceId, 'con_frozen_123');
      expect(eligibility.canDelete).toBe(false);
      expect(eligibility.reason).toContain('Legal Hold');
    });

    it('permits contract deletion when contract is not under legal hold', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          isUnderLegalHold: false,
        }),
      });

      const eligibility = await checkContractDeletionEligibility(workspaceId, 'con_standard_123');
      expect(eligibility.canDelete).toBe(true);
    });
  });

  describe('4. Cryptographic Evidence Package Manifest (FM-P6-06)', () => {
    it('generates deterministic SHA-256 package manifest for document and certificate buffers', () => {
      const docBuffer = Buffer.from('Final Executed Vector PDF Buffer 2026');
      const certBuffer = Buffer.from('Cryptographic Certificate of Completion Buffer 2026');

      const manifest = generateEvidencePackageManifest({
        workspaceId,
        contractId: 'con_evidence_pkg',
        documentBuffer: docBuffer,
        certificateBuffer: certBuffer,
        auditEvents: [{ type: 'document.completed', timestamp: '2026-09-29T00:00:00.000Z' }],
      });

      expect(manifest.workspaceId).toBe(workspaceId);
      expect(manifest.contractId).toBe('con_evidence_pkg');
      expect(manifest.documentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.certificateSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.overallChecksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('5. Distributed Circuit Breaker State Transition (FM-P6-05 & RSK-02)', () => {
    const serviceKey = 'https://api.external-erp.com/webhooks';

    it('allows execution when circuit is closed with zero failures', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'closed',
          failureCount: 0,
          successCount: 10,
          updatedAt: new Date().toISOString(),
        }),
      });

      const check = await checkCircuitBreakerStatus(workspaceId, serviceKey);
      expect(check.canExecute).toBe(true);
      expect(check.state).toBe('closed');
    });

    it('trips circuit to OPEN after 5 consecutive failures and blocks execution', async () => {
      // Simulate circuit state at 4 failures
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'closed',
          failureCount: 4,
          successCount: 0,
          updatedAt: new Date().toISOString(),
        }),
      });

      // 5th failure trips the breaker
      const trippedState = await recordCircuitBreakerFailure(workspaceId, serviceKey);
      expect(trippedState.state).toBe('open');
      expect(trippedState.failureCount).toBe(5);
      expect(trippedState.nextAllowedAttemptAt).toBeDefined();

      // Now query status when OPEN and cooldown is active
      const futureCooldown = new Date(Date.now() + 60000).toISOString();
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          serviceKey,
          state: 'open',
          failureCount: 5,
          nextAllowedAttemptAt: futureCooldown,
          updatedAt: new Date().toISOString(),
        }),
      });

      const check = await checkCircuitBreakerStatus(workspaceId, serviceKey);
      expect(check.canExecute).toBe(false);
      expect(check.state).toBe('open');
      expect(check.remainingCooldownMs).toBeGreaterThan(0);
    });
  });
});
