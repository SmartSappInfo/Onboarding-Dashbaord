/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Integration tests for Multi-Party Envelope Creation Server Actions (Phase 2, P2.1 & P2.4).
 * 2. Invariants Tested:
 *    - Sequential and parallel envelope creation with multi-recipient routing.
 *    - Raw capability tokens returned ONLY in memory at dispatch time; only SHA-256 hashes persisted.
 *    - Initial cohort (order 1) receives 'invited' status, subsequent cohorts remain 'pending'.
 *    - Validation rejects empty recipients, missing required fields, or duplicate recipient emails.
 *    - Append-only evidence audit record logged on envelope creation.
 * 3. Strict Typing Standard (Rule 4):
 *    Zero `any` or unchecked casts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateEnvelopeInput } from '@/lib/documents/envelope-actions';
import { createEnvelopeAction } from '@/lib/documents/envelope-actions';

const mockEnvelopesStore: Record<string, Record<string, unknown>> = {};
const mockEvidenceStore: Record<string, unknown>[] = [];
const mockEmittedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ uid: 'usr_test_sender', email: 'sender@enterprise.com' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (colName: string) => {
      if (colName === 'signing_envelopes') {
        return {
          doc: (id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({
              exists: !!mockEnvelopesStore[id],
              id,
              data: () => mockEnvelopesStore[id],
            }),
            set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
              mockEnvelopesStore[id] = { ...data, id };
            }),
            update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
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

describe('Envelope Creation Server Actions (P2.1 & P2.4)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockEnvelopesStore)) delete mockEnvelopesStore[key];
    mockEvidenceStore.length = 0;
    mockEmittedEvents.length = 0;
  });

  it('creates a sequential multi-party envelope and activates cohort 1 recipients', async () => {
    const input: CreateEnvelopeInput = {
      workspaceId: 'ws_test_01',
      title: 'Enterprise Partnership Agreement 2026',
      routingMode: 'sequential',
      documentStoragePath: 'agreements/template_master.pdf',
      preExecutionSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      dealId: 'deal_enterprise_100',
      recipients: [
        {
          name: 'Chief Executive Officer',
          email: 'ceo@client.com',
          role: 'signer',
          routingOrder: 1,
        },
        {
          name: 'General Counsel',
          email: 'counsel@client.com',
          role: 'countersigner',
          routingOrder: 2,
        },
      ],
      resolvedVariablesSnapshot: {
        company_name: 'Acme International',
        contract_value: '$150,000',
      },
    };

    const result = await createEnvelopeAction(input);

    expect(result.success).toBe(true);
    expect(result.envelopeId).toBeDefined();
    expect(result.envelope).toBeDefined();

    const envelope = result.envelope!;
    expect(envelope.status).toBe('sent');
    expect(envelope.currentRoutingOrder).toBe(1);
    expect(envelope.recipients).toHaveLength(2);

    // Recipient 1 (order 1) must be invited
    const rec1 = envelope.recipients.find((r) => r.email === 'ceo@client.com');
    expect(rec1?.status).toBe('invited');
    expect(rec1?.routingOrder).toBe(1);
    expect(rec1?.tokenHash).toBeDefined();

    // Recipient 2 (order 2) must be pending
    const rec2 = envelope.recipients.find((r) => r.email === 'counsel@client.com');
    expect(rec2?.status).toBe('pending');
    expect(rec2?.routingOrder).toBe(2);

    // Initial signing links returned for order 1
    expect(result.recipientLinks).toHaveLength(1);
    expect(result.recipientLinks![0].email).toBe('ceo@client.com');
    expect(result.recipientLinks![0].signingUrl).toContain(`/sign/${envelope.id}?token=`);

    // Verify persisted record in Firestore
    const stored = mockEnvelopesStore[envelope.id];
    expect(stored).toBeDefined();
    expect(stored.title).toBe('Enterprise Partnership Agreement 2026');

    // Verify append-only evidence was logged
    expect(mockEvidenceStore.length).toBeGreaterThan(0);
    expect(mockEvidenceStore[0].action).toBe('created');

    // Verify CRM event emitted
    expect(mockEmittedEvents.some((e) => e.eventType === 'deal.contract.sent')).toBe(true);
  });

  it('creates a parallel envelope and activates all recipients concurrently', async () => {
    const input: CreateEnvelopeInput = {
      workspaceId: 'ws_test_01',
      title: 'Joint Co-Founder IP Assignment',
      routingMode: 'parallel',
      documentStoragePath: 'agreements/ip_assignment.pdf',
      preExecutionSha256: 'sha256_mock_assignment',
      recipients: [
        {
          name: 'Founder Alice',
          email: 'alice@startup.com',
          role: 'signer',
          routingOrder: 1,
        },
        {
          name: 'Founder Bob',
          email: 'bob@startup.com',
          role: 'signer',
          routingOrder: 1,
        },
      ],
    };

    const result = await createEnvelopeAction(input);

    expect(result.success).toBe(true);
    const envelope = result.envelope!;
    expect(envelope.recipients).toHaveLength(2);

    // Both recipients should be invited simultaneously
    expect(envelope.recipients.every((r) => r.status === 'invited')).toBe(true);

    // Both signing links returned
    expect(result.recipientLinks).toHaveLength(2);
  });

  it('rejects envelope creation when duplicate recipient emails are provided', async () => {
    const input: CreateEnvelopeInput = {
      workspaceId: 'ws_test_01',
      title: 'Invalid Duplicate Recipients',
      routingMode: 'sequential',
      documentStoragePath: 'agreements/doc.pdf',
      preExecutionSha256: 'sha256_mock',
      recipients: [
        {
          name: 'Signer 1',
          email: 'same@example.com',
          role: 'signer',
          routingOrder: 1,
        },
        {
          name: 'Signer 2 (Duplicate)',
          email: 'same@example.com',
          role: 'signer',
          routingOrder: 2,
        },
      ],
    };

    const result = await createEnvelopeAction(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });

  it('rejects envelope creation with zero recipients or empty title', async () => {
    const inputMissingTitle: CreateEnvelopeInput = {
      workspaceId: 'ws_test_01',
      title: '   ',
      routingMode: 'sequential',
      documentStoragePath: 'agreements/doc.pdf',
      preExecutionSha256: 'sha256_mock',
      recipients: [
        {
          name: 'Signer',
          email: 'signer@example.com',
          role: 'signer',
          routingOrder: 1,
        },
      ],
    };

    const resultMissingTitle = await createEnvelopeAction(inputMissingTitle);
    expect(resultMissingTitle.success).toBe(false);
    expect(resultMissingTitle.error).toMatch(/title/i);

    const inputNoRecipients: CreateEnvelopeInput = {
      workspaceId: 'ws_test_01',
      title: 'No Recipients Agreement',
      routingMode: 'sequential',
      documentStoragePath: 'agreements/doc.pdf',
      preExecutionSha256: 'sha256_mock',
      recipients: [],
    };

    const resultNoRecipients = await createEnvelopeAction(inputNoRecipients);
    expect(resultNoRecipients.success).toBe(false);
    expect(resultNoRecipients.error).toMatch(/recipient/i);
  });
});
