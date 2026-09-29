/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Integration tests for Multi-Party Step Signing & Dynamic Height Certificate Action (Phase 2, P2.4 & P1.2).
 * 2. Invariants Tested:
 *    - Sequential advancement: Step 1 (Recipient 1 signs) -> status 'signed', advances order to 2, Recipient 2 invited.
 *    - Terminal sealing: Step 2 (Final Recipient signs) -> envelope status 'completed', CRM 'deal.contract.signed' emitted.
 *    - Idempotent re-submission: Calling submit signature again on an already-signed recipient returns gracefully.
 *    - Dynamic height / multi-page certificate generation when 3+ signers are present.
 * 3. Strict Typing Standard (Rule 4):
 *    Zero tolerance for `any` or unchecked casts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { SigningEnvelope } from '@/lib/types/document-signing';
import {
  submitRecipientSignatureAction,
  declineEnvelopeAction,
} from '@/lib/documents/envelope-actions';
import { generateAuditCertificate } from '@/lib/documents/audit-certificate-service';
import { hashSigningToken } from '@/lib/documents/signing-token-service';

const mockEnvelopesStore: Record<string, SigningEnvelope> = {};
const mockEvidenceStore: Record<string, unknown>[] = [];
const mockEmittedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'signing_envelopes') {
        return {
          doc: (id: string) => ({
            id,
            get: vi.fn().mockImplementation(async () => ({
              exists: !!mockEnvelopesStore[id],
              id,
              data: () => mockEnvelopesStore[id],
            })),
            set: vi.fn().mockImplementation(async (data: SigningEnvelope) => {
              mockEnvelopesStore[id] = { ...data, id };
            }),
            update: vi.fn().mockImplementation(async (updates: Partial<SigningEnvelope>) => {
              if (mockEnvelopesStore[id]) Object.assign(mockEnvelopesStore[id], updates);
            }),
          }),
        };
      }

      if (colName === 'signing_evidence') {
        return {
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            mockEvidenceStore.push({ ...data, id: `ev_${Date.now()}` });
            return { id: `ev_${Date.now()}` };
          }),
        };
      }

      return {
        doc: (id: string) => ({
          id,
          get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        }),
      };
    },
  },
}));

vi.mock('@/lib/deals/deal-event-bus', () => ({
  emitDealDomainEvent: vi.fn().mockImplementation((eventType: string, payload: Record<string, unknown>) => {
    mockEmittedEvents.push({ eventType, payload });
    return { eventId: 'evt_test', eventType, payload, timestamp: new Date().toISOString() };
  }),
}));

vi.mock('@/lib/documents/signature-storage-service', () => ({
  uploadSignatureImage: vi.fn().mockResolvedValue({
    storagePath: 'signatures/mock_offloaded_sig.png',
    signatureHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  }),
  isBase64DataUrl: vi.fn().mockReturnValue(true),
}));


describe('Multi-Party Step Finalization & Dynamic Certificate (P2.4 & P1.2)', () => {
  const rawToken1 = 'token_secret_raw_1_abcdef1234567890abcdef1234567890abcdef1234567890';
  const rawToken2 = 'token_secret_raw_2_abcdef1234567890abcdef1234567890abcdef1234567890';
  const tokenHash1 = hashSigningToken(rawToken1);
  const tokenHash2 = hashSigningToken(rawToken2);

  beforeEach(() => {
    for (const key of Object.keys(mockEnvelopesStore)) delete mockEnvelopesStore[key];
    mockEvidenceStore.length = 0;
    mockEmittedEvents.length = 0;

    // Seed mock multi-party sequential envelope
    const envelope: SigningEnvelope = {
      id: 'env_step_test',
      workspaceId: 'ws_demo',
      title: 'Institutional Joint Venture Agreement',
      status: 'sent',
      dealId: 'deal_step_100',
      routingMode: 'sequential',
      currentRoutingOrder: 1,
      documentStoragePath: 'agreements/source.pdf',
      preExecutionSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      expiresAt: new Date(Date.now() + 864000000).toISOString(),
      createdBy: 'usr_admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recipients: [
        {
          id: 'rec_signer_1',
          workspaceId: 'ws_demo',
          envelopeId: 'env_step_test',
          role: 'signer',
          name: 'First Signer',
          email: 'first@test.com',
          routingOrder: 1,
          status: 'invited',
          tokenHash: tokenHash1,
          tokenExpiresAt: new Date(Date.now() + 864000000).toISOString(),
        },
        {
          id: 'rec_signer_2',
          workspaceId: 'ws_demo',
          envelopeId: 'env_step_test',
          role: 'countersigner',
          name: 'Second Signer',
          email: 'second@test.com',
          routingOrder: 2,
          status: 'pending',
          tokenHash: tokenHash2,
          tokenExpiresAt: new Date(Date.now() + 864000000).toISOString(),
        },
      ],
    };

    mockEnvelopesStore[envelope.id] = envelope;
  });

  it('progresses sequential envelope: Recipient 1 signs, advancing order to 2 and inviting Recipient 2', async () => {
    const result = await submitRecipientSignatureAction({
      envelopeId: 'env_step_test',
      recipientId: 'rec_signer_1',
      rawToken: rawToken1,
      signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      ipAddress: '192.168.1.50',
      userAgent: 'Mozilla/5.0 Vitest',
    });

    expect(result.success).toBe(true);
    expect(result.isTerminal).toBe(false);

    // Verify envelope in Firestore
    const updated = mockEnvelopesStore['env_step_test'];
    expect(updated.status).toBe('in_progress');
    expect(updated.currentRoutingOrder).toBe(2);

    // Recipient 1 must be signed
    const rec1 = updated.recipients.find((r) => r.id === 'rec_signer_1');
    expect(rec1?.status).toBe('signed');
    expect(rec1?.signedAt).toBeDefined();
    expect(rec1?.signatureStoragePath).toBe('signatures/mock_offloaded_sig.png');

    // Recipient 2 must be invited
    const rec2 = updated.recipients.find((r) => r.id === 'rec_signer_2');
    expect(rec2?.status).toBe('invited');
    expect(rec2?.invitedAt).toBeDefined();

    // Verify CRM event emitted
    expect(mockEmittedEvents.some((e) => e.eventType === 'deal.contract.in_progress')).toBe(true);

    // Verify evidence logged
    expect(mockEvidenceStore.some((e) => e.action === 'signed')).toBe(true);
  });

  it('terminal completion: Recipient 2 signs, completing the agreement and emitting deal.contract.signed', async () => {
    // Fast-forward envelope to order 2
    mockEnvelopesStore['env_step_test'].currentRoutingOrder = 2;
    mockEnvelopesStore['env_step_test'].recipients[0].status = 'signed';
    mockEnvelopesStore['env_step_test'].recipients[0].signedAt = new Date().toISOString();
    mockEnvelopesStore['env_step_test'].recipients[1].status = 'invited';

    const result = await submitRecipientSignatureAction({
      envelopeId: 'env_step_test',
      recipientId: 'rec_signer_2',
      rawToken: rawToken2,
      signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      ipAddress: '192.168.1.60',
      userAgent: 'Mozilla/5.0 Vitest',
    });

    expect(result.success).toBe(true);
    expect(result.isTerminal).toBe(true);

    const updated = mockEnvelopesStore['env_step_test'];
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeDefined();

    // Both recipients signed
    expect(updated.recipients.every((r) => r.status === 'signed')).toBe(true);

    // Verify terminal CRM event emitted
    expect(mockEmittedEvents.some((e) => e.eventType === 'deal.contract.signed')).toBe(true);

    // Verify terminal evidence logged
    expect(mockEvidenceStore.some((e) => e.action === 'completed')).toBe(true);
  });

  it('handles idempotent replay gracefully when already signed', async () => {
    // Set recipient 1 as already signed
    mockEnvelopesStore['env_step_test'].recipients[0].status = 'signed';

    const result = await submitRecipientSignatureAction({
      envelopeId: 'env_step_test',
      recipientId: 'rec_signer_1',
      rawToken: rawToken1,
    });

    expect(result.success).toBe(true);
    expect(result.alreadySigned).toBe(true);
  });

  it('rejects action if raw capability token is invalid', async () => {
    const result = await submitRecipientSignatureAction({
      envelopeId: 'env_step_test',
      recipientId: 'rec_signer_1',
      rawToken: 'invalid_raw_token_xyz',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid or tampered/i);
  });

  it('handles decline to sign: marks envelope declined and notifies CRM', async () => {
    const result = await declineEnvelopeAction({
      envelopeId: 'env_step_test',
      recipientId: 'rec_signer_1',
      rawToken: rawToken1,
      reason: 'Unacceptable indemnification clause',
    });

    expect(result.success).toBe(true);
    const updated = mockEnvelopesStore['env_step_test'];
    expect(updated.status).toBe('declined');
    expect(updated.recipients[0].status).toBe('declined');
    expect(updated.recipients[0].declineReason).toBe('Unacceptable indemnification clause');

    expect(mockEmittedEvents.some((e) => e.eventType === 'deal.contract.declined')).toBe(true);
  });

  describe('Dynamic Multi-Page Certificate Generation', () => {
    it('generates multi-page certificate when 3+ signers are present without canvas overflow', async () => {
      const multiSignerData = {
        envelopeId: 'env_multi_4_parties',
        title: 'Syndicated Multi-Party Facility Agreement',
        status: 'completed',
        createdAt: '2026-09-01T00:00:00Z',
        completedAt: '2026-09-02T12:00:00Z',
        preExecutionSha256: 'a'.repeat(64),
        postExecutionSha256: 'b'.repeat(64),
        verificationUrl: 'https://app.smartsapp.com/verify/env_multi_4_parties',
        signers: [
          { recipientId: 'r1', name: 'Lead Arranger', email: 'lead@bank.com', signedAt: '2026-09-01T10:00:00Z', signatureHash: '1'.repeat(64) },
          { recipientId: 'r2', name: 'Borrower CEO', email: 'ceo@borrower.com', signedAt: '2026-09-01T12:00:00Z', signatureHash: '2'.repeat(64) },
          { recipientId: 'r3', name: 'Co-Lender One', email: 'lender1@fund.com', signedAt: '2026-09-01T14:00:00Z', signatureHash: '3'.repeat(64) },
          { recipientId: 'r4', name: 'Co-Lender Two', email: 'lender2@fund.com', signedAt: '2026-09-02T09:00:00Z', signatureHash: '4'.repeat(64) },
        ],
        auditTrail: [
          { id: '1', envelopeId: 'env_multi_4_parties', action: 'created' as const, timestamp: '2026-09-01T08:00:00Z' },
          { id: '2', envelopeId: 'env_multi_4_parties', action: 'sent' as const, timestamp: '2026-09-01T08:05:00Z' },
          { id: '3', envelopeId: 'env_multi_4_parties', action: 'signed' as const, timestamp: '2026-09-01T10:00:00Z' },
          { id: '4', envelopeId: 'env_multi_4_parties', action: 'signed' as const, timestamp: '2026-09-01T12:00:00Z' },
          { id: '5', envelopeId: 'env_multi_4_parties', action: 'signed' as const, timestamp: '2026-09-01T14:00:00Z' },
          { id: '6', envelopeId: 'env_multi_4_parties', action: 'signed' as const, timestamp: '2026-09-02T09:00:00Z' },
          { id: '7', envelopeId: 'env_multi_4_parties', action: 'completed' as const, timestamp: '2026-09-02T09:01:00Z' },
        ],
      };

      const certificatePdfBytes = await generateAuditCertificate(multiSignerData);
      const parsedDoc = await PDFDocument.load(certificatePdfBytes);

      // Must budget vertical space across multiple pages (e.g. 2 pages)
      expect(parsedDoc.getPageCount()).toBeGreaterThanOrEqual(2);
    });
  });
});
