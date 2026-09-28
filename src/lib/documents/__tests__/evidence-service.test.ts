/**
 * PURPOSE: Unit tests for Cryptographic Evidence Service.
 * ARCHITECTURAL CONTEXT:
 * Tests SHA-256 binary digest calculations and append-only evidence logging
 * in the `signing_evidence` collection. Validates legal audit trail creation
 * across signing actions (created, sent, opened, progress_saved, signed, completed).
 * TESTABILITY: Runs in Vitest. Conforms to Rule 4 (Zero any).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateSha256Digest,
  createEvidenceRecord,
  getEvidenceAuditTrail,
} from '../evidence-service';
import type { EvidenceAuditLogEntry } from '@/lib/types/document-signing';

const mockEvidenceStore: EvidenceAuditLogEntry[] = [];

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      if (colName === 'signing_evidence') {
        return {
          add: vi.fn().mockImplementation(async (data: Omit<EvidenceAuditLogEntry, 'id'>) => {
            const id = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const entry: EvidenceAuditLogEntry = { id, ...data };
            mockEvidenceStore.push(entry);
            return { id };
          }),
          where: vi.fn().mockImplementation((field: string, op: string, val: string) => ({
            orderBy: vi.fn().mockImplementation((orderField: string, direction: 'asc' | 'desc') => ({
              get: vi.fn().mockImplementation(async () => {
                const filtered = mockEvidenceStore.filter((item) => (item as unknown as Record<string, unknown>)[field] === val);
                return {
                  docs: filtered.map((d) => ({
                    id: d.id,
                    data: () => d,
                  })),
                };
              }),
            })),
          })),
        };
      }
      return {};
    }),
  },
}));

describe('P1.4 Cryptographic Evidence Service', () => {
  beforeEach(() => {
    mockEvidenceStore.length = 0;
    vi.clearAllMocks();
  });

  it('calculates deterministic SHA-256 binary digest', () => {
    // Empty buffer SHA-256 constant
    const emptyDigest = calculateSha256Digest(Buffer.from(''));
    expect(emptyDigest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    // Known payload
    const testBuffer = Buffer.from('SmartSapp Tamper Evident PDF Execution');
    const digest = calculateSha256Digest(testBuffer);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(calculateSha256Digest(testBuffer));
  });

  it('creates an append-only evidence record with actor metadata and digest', async () => {
    const result = await createEvidenceRecord({
      envelopeId: 'env_order_9988',
      action: 'signed',
      recipientId: 'rec_signer_01',
      recipientEmail: 'signer@example.com',
      recipientName: 'Kofi Mensah',
      ipAddress: '197.251.135.2',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      documentDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      metadata: { method: 'draw' },
    });

    expect(result.id).toMatch(/^ev_/);
    expect(result.timestamp).toBeDefined();
    expect(mockEvidenceStore.length).toBe(1);
    expect(mockEvidenceStore[0].envelopeId).toBe('env_order_9988');
    expect(mockEvidenceStore[0].action).toBe('signed');
    expect(mockEvidenceStore[0].ipAddress).toBe('197.251.135.2');
  });

  it('retrieves evidence audit trail sorted by timestamp', async () => {
    await createEvidenceRecord({
      envelopeId: 'env_order_9988',
      action: 'created',
    });
    await createEvidenceRecord({
      envelopeId: 'env_order_9988',
      action: 'opened',
    });
    await createEvidenceRecord({
      envelopeId: 'env_other_1111',
      action: 'created',
    });

    const trail = await getEvidenceAuditTrail('env_order_9988');
    expect(trail.length).toBe(2);
    expect(trail[0].action).toBe('created');
    expect(trail[1].action).toBe('opened');
  });
});
